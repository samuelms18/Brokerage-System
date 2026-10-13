# Software Requirements Specification — v1.1

Student Rental Brokerage Platform: functional, technical, security and data
requirements.

| | |
|---|---|
| Version | **v1.1**: supersedes v1.0 (October 2026) |
| Source of truth | Schema `db/schema.sql`; API `api/openapi.yaml`; decisions `decisions.md` |

## 1. Scope

Functional, technical, security, data and interface requirements for the
MVP: one responsive web app (PWA) and one backend.

## 2. Functional requirements

### FR-AUTH: Authentication and access
- AUTH-1 Phone OTP login; account created on first login.
- AUTH-2 Roles: Super Admin, Broker, Student (Owner reserved). Extra
  per-user permissions: `can_verify_properties`, `can_override_brokerage`.
- AUTH-3 Session revocation; OTP, login and API rate limiting; MFA
  recommended for Super Admin.
- AUTH-4 **Every endpoint except OTP request/verify requires
  authentication**, including listing search and property detail.
- AUTH-5 **Return after login:** a signed-out user opening `/p/{code}` is
  sent to `/login?next=/p/{code}` and returned there after OTP. The server
  accepts only same-site relative paths as `return_to` and otherwise
  redirects to `/`.

### FR-PROP: Properties, rooms, beds
- PROP-1 Property CRUD with a private owner link and private exact address.
- PROP-2 Rooms with per-bed pricing; beds with individual statuses.
- PROP-3 Rent changes with effective dates (rent history). Confirmed
  assignments keep their snapshot.
- PROP-4 Photos stay private until privacy-checked and marked public.
- PROP-5 Submitting for verification is validated (rooms, prices, at
  least one public photo, area).
- PROP-6 **Only Super Admin or a verifier can publish.** Until PV-1 is
  decided, a verifier cannot approve a property they are the assigned
  broker for.
- PROP-7 Approximate location is computed once from the exact pin and
  stored. It is never recomputed per request.

### FR-STU: Student marketplace
- STU-1 Browse, search, filter, sort and view detail. **Login
  required.**
- STU-2 Shortlist add/remove. **Must not create a lead or notify a
  broker.**
- STU-3 *Request Visit* and *I'm Interested* create a lead, or reuse the
  active lead for that property. The response is always "Request
  Received".
- STU-4 Request tracking with a simplified status; no allocation details.
- STU-5 Broker name and business phone appear only after a broker has
  accepted the lead.
- STU-6 The student sees their own brokerage amount once disclosed, can
  acknowledge it, and sees its payment status. Never the owner's amount.
- STU-7 No owner data or exact address in any student response.

### FR-LEAD: Leads and allocation (see `broker-allocation.md`)
- LEAD-1 One active lead per student + property (database-enforced).
- LEAD-2 Automatic allocation by eligibility and priority; Unassigned Queue
  when nobody is eligible; retries on events and every 5 minutes.
- LEAD-3 Offered leads move automatically on timeout, decline or broker
  unavailability. Accepted leads move only under explicit rules or a manual
  reassignment.
- LEAD-4 **Before acceptance**, the broker API returns no student phone,
  email or documents. **After acceptance**, they are returned and each
  reveal is audited.
- LEAD-5 Every allocation/reassignment is recorded: previous broker, new
  broker, method, reason, response deadline, timestamps, accepted time.
- LEAD-6 Status history; next action required on open leads.

### FR-VIS: Visits
- VIS-1 Statuses: Requested, Proposed, Confirmed, Rescheduled, Completed,
  Cancelled, No-show.
- VIS-2 Propose/confirm/reschedule, reminders, outcome required on
  completion.

### FR-ASG: Assignments
- ASG-1 Bed-level assignment with availability check and row lock.
- ASG-2 Statuses: Draft, Pending Confirmation, Reserved, Confirmed,
  Cancelled, Completed (move-in); vacate frees the bed.
- ASG-3 Commercial snapshot frozen at confirmation.
- ASG-4 **Confirmation is refused unless every charged party has a
  brokerage disclosure matching the current quote**
  (`BROKERAGE_NOT_DISCLOSED`).

### FR-BRK: Brokerage (see `brokerage.md`)
- BRK-1 Policies per scope: payer mode (student/owner/both) and an
  independent calculation per paying party (flat, % of monthly rent,
  months of rent ≥ 1). Policies are versioned, never edited in place.
- BRK-2 Property- and assignment-level overrides per party, reason
  mandatory, revocable with a reason, full history. Assignment overrides
  only before confirmation.
- BRK-3 One quote function (`brokerage_quote`) for both disclosure and
  confirmation.
- BRK-4 Disclosure recorded per party (in-app for student, or
  WhatsApp/phone/in-person/email), with the amount taken from the quote.
- BRK-5 On confirmation: one brokerage record per charged party, with
  calculation snapshot and credited broker.
- BRK-6 Statuses per party: Pending, Partially Paid, Paid, Waived,
  Cancelled, Refund Pending, Refunded.
- BRK-7 **Manual payment recording only** (cash, UPI, bank transfer);
  reference required except for cash; receipt number; void with reason. No
  online collection.
- BRK-8 Waiver with reason (Super Admin until BR-2 is decided). Refunds
  recorded manually (request → complete/cancel).
- BRK-9 Credit: default policy `assignment_broker`. Super Admin override
  with reason; history kept. Lead reassignment never changes credit.

## 3. Security requirements

- Server-side RBAC plus object-level authorization; out-of-scope records
  return 404.
- Dedicated student-safe views and response models
  (`additionalProperties: false`). Contract tests fail the build on extra
  fields.
- Private tables (owners, property private details) not readable by the
  database role used for student reads.
- Open-redirect protection on `return_to`.
- HTTPS; secrets outside source code.
- Private document storage with short-lived signed URLs.
- Audit: owner views, student contact reveals, reassignments, assignment
  transitions, brokerage disclosures, overrides, waivers, refunds, credit
  changes, payments and voids, permission changes.
- OTP, login and API rate limits; upload validation; parameterized
  queries/ORM; backups with restore tests.

## 4. Core data model

See `data-model.md` and `db/schema.sql`. Main entities: User, Student,
Broker, Owner, Property, PropertyPrivateDetails, Room, Bed, RentHistory,
Shortlist, Lead, LeadStatusHistory, LeadAssignment, FollowUp, Visit,
Assignment, BrokeragePolicy, BrokerageOverride, BrokerageDisclosure,
Brokerage, BrokerageCreditChange, Payment, BrokerageRefund, Document,
Notification, AuditLog, SystemSetting, and lookups (Area, College,
Amenity).

## 5. API architecture

Versioned REST (`/v1`), described by `api/openapi.yaml`: `/auth`,
`/listings`, `/student/*`, `/broker/*`, `/admin/*`, `/documents`,
`/notifications`. Protected endpoints enforce role, permission and object
scope. Errors are `application/problem+json` with stable codes.

## 6. Non-functional

- Responsive web/PWA UX; touch targets ~44 px
- 99.5 % MVP availability target
- Common API p95 < 800 ms excluding third parties
- Stateless, horizontally scalable API
- Monitoring and error logging; automated backups
- Automated tests for critical workflows (database rule tests already in
  `db/tests/`)

## 7. Acceptance criteria

1. A signed-out user cannot load listings; opening a shared link and
   logging in returns them to that property.
2. A student browses and filters without ever receiving owner data or the
   exact address.
3. Shortlisting creates no lead; Request Visit creates or reuses one.
4. A visit request reaches an eligible broker automatically, or the
   Unassigned Queue.
5. A duplicate active lead is blocked.
6. Before acceptance the broker sees no student phone; after acceptance
   they do.
7. The student sees broker contact only after acceptance.
8. A property is invisible to students until a Super Admin or verifier
   approves it.
9. The broker can schedule a visit and assign an available bed.
10. Brokerage is configurable per party; overrides require a reason and
    keep history.
11. Confirmation is blocked until each paying party has been shown the
    current amount.
12. Confirmation creates one brokerage record per paying party, each with
    a credited broker.
13. Payments are recorded manually and update each party's status
    separately.
14. Reassigning a lead does not change brokerage credit; a Super Admin
    credit override is recorded with a reason.
15. Super Admin sees allocation and audit history.
16. Unauthorized API calls are denied.

## 8. Open questions

See `decisions.md`, *Open questions*.
