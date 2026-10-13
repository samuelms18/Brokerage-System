# Data Model

Status: **Draft v0.2** (brokerage model per D-04/D-15). The DDL in `db/schema.sql` is the source of truth;
this document explains it. Rule tests: `db/tests/schema_rules_test.sql`.

## 1. Entity overview

```
users ─┬─ students ── shortlists ── properties
       ├─ brokers ─┬─ broker_area_authorizations ── areas
       │           ├─ broker_property_authorizations ── properties
       │           └─ broker_unavailability
       └─ owners (PRIVATE; user_id only for the future Owner portal)

areas ── colleges          amenities ── property_amenities ── properties

properties (PUBLIC-SAFE) ──1:1── property_private_details (PRIVATE: owner_id, exact address/pin)
    ├─ property_photos (is_public + privacy_checked)
    ├─ property_college_distances
    └─ rooms ─┬─ beds
              └─ rent_history

leads ─┬─ lead_status_history
       ├─ lead_assignments   (broker allocation history)
       ├─ follow_ups
       ├─ visits
       └─ assignments (bed-level)
              ├─ brokerage_disclosures      (amount shown to each party)
              └─ brokerages (one per paying party) ─┬─ payments
                                                    ├─ brokerage_refunds
                                                    └─ brokerage_credit_changes
brokerage_policies (scope → payer + per-party calc)
brokerage_overrides (property- or assignment-level, per party)

documents (polymorphic: student/owner/property/assignment/payment)
notifications · audit_logs · system_settings · otp_challenges · user_sessions
```

## 2. Tables at a glance

| Area | Tables |
|---|---|
| Identity | `users`, `otp_challenges`, `user_sessions` |
| Actors | `students`, `brokers`, `owners` |
| Broker availability | `broker_unavailability`, `broker_area_authorizations`, `broker_property_authorizations` |
| Lookups | `areas`, `colleges`, `amenities`, `system_settings` |
| Inventory | `properties`, `property_private_details`, `property_amenities`, `property_college_distances`, `property_photos`, `rooms`, `beds`, `rent_history` |
| CRM | `shortlists`, `leads`, `lead_status_history`, `lead_assignments`, `follow_ups`, `visits` |
| Commercial | `assignments`, `brokerage_policies`, `brokerage_overrides`, `brokerage_disclosures`, `brokerages`, `brokerage_credit_changes`, `payments`, `brokerage_refunds` |
| Platform | `documents`, `notifications`, `audit_logs` |
| Student read model | views `student_property_listings`, `student_room_availability` |

## 3. Privacy boundary (owner data and exact location)

The core rule is that students must not be able to bypass the broker. Three
layers protect it:

1. **Storage split.** Everything that identifies the owner or the exact
   house is kept out of `properties`:
   - `owners`: name, phone, email, address
   - `property_private_details`: `owner_id`, address lines, landmark,
     pincode, exact lat/long, owner commercial notes

   `properties` holds only listing data plus an **approximate** location
   (`approx_latitude/longitude`) and a non-identifying `locality_label`.
2. **Read model.** Student and public endpoints read only the views
   `student_property_listings` and `student_room_availability`. They contain
   no owner, address, exact-coordinate or internal-user columns, and a test
   checks this. In production these reads should use a database role granted
   SELECT on the views only. That role *cannot* read `owners` or
   `property_private_details`, even if application code makes a mistake.
3. **Response DTOs.** The API uses dedicated student schemas
   (`StudentListingCard`, `StudentListingDetail`) with
   `additionalProperties: false`. Contract tests fail the build if a student
   response contains any field outside that list. Nothing is hidden with CSS.

Additional rules:

- **Approximate location is fixed.** Compute it once when the exact location
  is saved (snap to a ~300–500 m grid or apply a fixed offset). If it were
  re-randomised on every request, averaging many requests would reveal the
  real point.
- **Photos** reach students only when `is_public` is true, and `is_public`
  requires `privacy_checked` (DB CHECK): no house number, gate signboard or
  owner visible.
- **College distances** are computed from the exact pin but published only
  rounded to 0.1 km.
- **WhatsApp share text** is generated from the student read model only.
- **Every view of owner details** by staff writes an `owner.viewed` audit row.

## 4. Rooms and beds

- `rooms.sharing` = number of beds. Each bed is a `beds` row with its own
  status: `available`, `reserved`, `occupied`, `maintenance`, `blocked`.
- `rooms.status` covers room-wide conditions only (`active`, `maintenance`,
  `blocked`). Availability is always **derived from beds**, so it never
  drifts out of sync.
- Prices are **per bed** on the room. `rent_history` records every change
  with `effective_from`. `rooms.rent_per_bed` is the current price.
- `properties.status` values `partially_occupied` and `fully_occupied`, and
  `properties.min_rent/max_rent/min_deposit`, are maintained by the
  application whenever beds or rooms change (one service method).

## 5. Status lists (canonical for all documents)

**Lead** (`leads.status`): `new → contacted → requirement_confirmed →
properties_suggested → visit_scheduled → visited → interested → negotiation →
assigned → brokerage_pending → brokerage_paid → move_in_complete`.
Unsuccessful terminal states: `not_interested`, `lost`, `student_cancelled`,
`property_unavailable`, `duplicate`.
*Active* = every status except `move_in_complete` and the five terminal ones
(the generated column `is_active`). Every change writes `lead_status_history`.

**Lead allocation** (`leads.allocation_status`): `unassigned`, `offered`,
`accepted`. See `docs/broker-allocation.md`.

**Visit**: `requested`, `proposed`, `confirmed`, `rescheduled`, `completed`,
`cancelled`, `no_show`. A completed visit requires an `outcome`.

**Assignment**: `draft`, `pending_confirmation`, `reserved`, `confirmed`,
`cancelled`, `completed` (= moved in). When the tenant leaves, `vacated_at`
is set and the bed becomes `available` again.

**Bed status updates with the assignment status:**

| Assignment status | Bed status |
|---|---|
| `pending_confirmation`, `reserved` | `reserved` |
| `confirmed`, `completed` (vacated_at NULL) | `occupied` |
| `cancelled`, or `vacated_at` set | `available` |

**Property**: `draft`, `verification`, `published`, `partially_occupied`,
`fully_occupied`, `unavailable`, `archived`. Students see `published` and
`partially_occupied`.

**Brokerage** (per party): `pending`, `partially_paid`, `paid`, `waived`,
`cancelled`, `refund_pending`, `refunded`. **Refund**: `pending`,
`completed`, `cancelled`.
**Payment**: `recorded`, `voided` (a payment is voided, never deleted).

## 6. Integrity rules enforced by the database

| Rule | Mechanism |
|---|---|
| One active lead per student + property | unique partial index `leads_one_active_per_student_property` |
| One live assignment per bed | unique partial index `assignments_one_live_per_bed` |
| Allocation fields consistent (offered ⇒ broker + deadline, unassigned ⇒ queued) | CHECK constraints on `leads` |
| Manual reassignment has an actor and a reason | CHECK on `lead_assignments` |
| One brokerage per assignment per party; refunded ≤ paid ≤ amount; `paid` only when fully paid; waive/cancel need a reason | UNIQUE + CHECKs on `brokerages` |
| Policy: paying parties have a calculation, others none; % ≤ 100; months ≥ 1 | CHECKs on `brokerage_policies` |
| Override: reason required; one active per party per level; revocation needs a reason | CHECK + partial unique indexes on `brokerage_overrides` |
| Credit change after the initial credit needs an authorizer | CHECK on `brokerage_credit_changes` |
| MVP payment methods are manual only | CHECK on `payments.method` |
| Non-cash payments carry a reference; voids carry a reason | CHECK on `payments` |
| Public photos must be privacy-checked | CHECK on `property_photos` |
| Snoozed follow-ups need a reason | CHECK on `follow_ups` |

Rules that need the application (each one is a single service method):

- recompute `brokerages.paid_amount` and `status` from non-voided payments;
- move bed status with the assignment status (table above);
- on **confirmation**: refuse unless every line of `brokerage_quote()` has a
  disclosure with the same amount; then insert one `brokerages` row per line
  (with `calc_snapshot` and `credited_broker_id` = the assignment's broker)
  and the initial `brokerage_credit_changes` row (see `brokerage.md`);
- recompute `brokerages.status` from payments, refunds, waivers;
- every active lead has at least one open `follow_up` (also checked by a
  nightly report).

## 7. Commercial snapshot

When an assignment is confirmed, `rent_snapshot`, `deposit_snapshot` and
`maintenance_snapshot` are copied from the room's price **effective on the
move-in date** (from `rent_history`). They never change afterwards. Brokerage
amounts are calculated from the snapshot (`brokerage_quote()`), never from
the current room price.

## 8. Documents and DPDP

- Files live in a **private** bucket. `documents.storage_key` is never
  public; downloads go through short-lived signed URLs issued after an
  authorization check.
- Each document records its **purpose** and a **retention_until** date. A
  daily job deletes expired objects and soft-deletes the row.
- `government_id` is collected only when an assignment requires it.
- **Who can read** a student document: the student; the broker holding an
  active lead or assignment with that student; Super Admin. Every read is
  audited (`document.viewed`).
- Retention periods and consent text need review against the DPDP Act 2023
  and its rules before launch (see decisions D-12).

## 9. Not yet modelled (deliberately deferred)

- Owner portal permissions (`owners.user_id` is reserved for it).
- Online payment collection (MVP is manual, D-08; `online_gateway` will be
  added to `payments.method` by migration).
- Multi-city / multi-tenant brokerages.
