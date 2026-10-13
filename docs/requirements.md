# Complete Product Requirements — v1.1

Student Rental Brokerage Platform: business, roles, modules and scope.

| | |
|---|---|
| Version | **v1.1**: supersedes v1.0 (October 2026) |
| Changes | Decisions D-01 … D-17 incorporated (see `decisions.md`) |
| Related | `srs.md`, `workflow.md`, `ui-ux-spec.md`, `brokerage.md`, `broker-allocation.md`, `data-model.md` |

## 1. Executive summary

A digital Student Rental Brokerage Platform that replaces WhatsApp
threads, calls and manual records with a searchable student marketplace
and a broker CRM.

**Core rules**
- Students browse published properties **only after logging in**.
- The owner's phone, email, identity and the exact address are **never**
  exposed to students. The broker is the controlled communication layer.
- The broker's contact details reach a student only after that broker has
  **accepted** the student's lead.

## 2. Roles

| Role | Purpose | Permissions |
|---|---|---|
| Super Admin | Platform owner | All modules, users, settings, reports, audit; brokerage policies, waivers, refunds, credit overrides; manual lead reassignment |
| Admin / Broker | Broker operations | Properties, rooms, beds, students, leads, visits, assignments, brokerage records and payments for their scope |
| Verifier (permission) | Property approval | Approve or reject properties for publication (`can_verify_properties`) |
| Brokerage override (permission) | Commercial exceptions | Create property- or assignment-level brokerage overrides (`can_override_brokerage`; see BR-1) |
| Student | Find accommodation | Log in, browse, search, filter, shortlist, request a visit / express interest, track requests, view own brokerage |
| Owner (future) | Property stakeholder | Own-property visibility only |

## 3. Core modules

Authentication & RBAC · Student marketplace · Property / room / bed
management · Student & lead CRM · Automatic broker allocation · Smart
matching · Visit scheduling · Assignment & occupancy · Brokerage policy,
disclosure, payment & credit · Documents · Notifications · WhatsApp sharing ·
Reports & audit logs.

## 4. Student experience

- **Login first:** phone + OTP. Every marketplace page requires login. A
  shared listing link opened while signed out goes to login and then **back
  to that property**.
- Search by property, area, college or landmark.
- Filter by rent, deposit, distance, sharing, property type, gender policy,
  amenities and availability.
- View photos, rent, deposit, amenities, **approximate** location, college
  distances, house rules and bed availability.
- **Shortlist** properties. Shortlisting does **not** create a lead or
  notify anyone.
- **Request a visit** or tap **I'm interested**. These are the actions
  that create (or reuse) a lead. The student always sees "Request
  Received".
- Track request, visit and assignment status in simplified form.
- See the assigned broker's **name and business phone only after the broker
  accepts the lead**.
- See **their own brokerage amount before the assignment is confirmed**,
  then its payment status.
- Never see owner contact, owner identity or the exact address.

## 5. Property management

- A property has an internal ID, a share code, an assigned broker, and a
  **private** owner link and exact address.
- Multiple rooms per property; **multiple beds per room**, each with its
  own status.
- Rent, deposit and maintenance per bed, with **rent history** and
  effective dates.
- Property statuses: Draft, Verification, Published, Partially Occupied,
  Fully Occupied, Unavailable, Archived.
- Room statuses: Active, Maintenance, Blocked (availability comes from
  beds).
- Bed statuses: Available, Reserved, Occupied, Maintenance, Blocked.
- **Verification:** every property must be approved by Super Admin or an
  authorized verifier before students can see it. Approval checks listing
  accuracy and that public photos do not reveal the house (house number,
  signboard, owner).

## 6. Broker CRM

- **Dashboard:** leads awaiting acceptance, new leads, visits today,
  follow-ups due/overdue, assignments pending, brokerage pending. Every
  KPI links to its filtered list.
- **Lead pipeline:** New → Contacted → Requirement Confirmed → Properties
  Suggested → Visit Scheduled → Visited → Interested → Negotiation →
  Assigned → Brokerage Pending → Brokerage Paid → Move-in Complete.
  Terminal states: Not Interested, Lost, Student Cancelled, Property
  Unavailable, Duplicate.
- Every open lead has a next action and due date.
- Only one active lead per student + property.
- **Automatic allocation** (see `broker-allocation.md`): leads go to the
  property's broker if available and eligible, otherwise to another
  eligible broker (fewest active leads, then round-robin), otherwise to the
  Unassigned Queue. No Super Admin approval is needed for routine
  assignment.
- **Before acceptance**, a broker sees the student's name, college,
  course/year, budget and requested property, but **not** their phone,
  email or documents. **After acceptance**, the broker sees the contact
  information needed to handle the enquiry. Each contact reveal is
  audited.
- **Reassignment** (automatic or manual) keeps the complete history:
  previous broker, new broker, reason, method and timestamps.
- Super Admin can reassign manually with a reason; this is reserved for
  exceptions.

## 7. Privacy and anti-bypass

- Owner data lives in a private Owner entity, and the exact address in a
  private property-details entity. Both are excluded from student API
  responses at the database-view and response-model levels. **Nothing is
  hidden with CSS.**
- Students see public property details only, behind login.
- Broker contact is shown to a student only after that broker accepts the
  lead.
- Owner phone/email are visible only to authorized brokers and Super
  Admin; every view is audited.
- WhatsApp share text never includes owner contact or the exact address.
  Link previews show no property details to signed-out users.
- Student + property have at most one active lead.
- Assignment, brokerage, override, waiver, refund and credit actions are
  audited.

## 8. Brokerage

Full specification: `brokerage.md`.

- Configured **separately for the student and the owner**.
- Calculation per party: **fixed amount**, **percentage of monthly rent**,
  or **one or more months' rent**.
- **Payer:** student, owner or both. When both pay, each party's
  calculation is configured independently.
- Policies can apply to all properties, an area, a property type, or
  both. Changes create a new policy version; old versions are kept.
- **Overrides** at property level or assignment level, per party, with a
  **mandatory reason** and full history.
- **Disclosure:** each paying party is shown their amount **before** the
  assignment is confirmed, and confirmation is blocked until that is
  recorded. The student sees only their own amount.
- On confirmation, one brokerage record is created **per paying party**.
- Statuses per party: **Pending, Partially Paid, Paid, Waived, Cancelled,
  Refund Pending, Refunded**.
- **MVP payments are recorded manually**: cash, UPI or bank transfer, with
  a reference and receipt. No online payment collection yet; the design
  keeps room for it.
- **Credit:** configurable policy. Default: the broker officially
  responsible for the successful rental assignment. Super Admin-authorized
  overrides with an audit trail. Reassigning a lead never transfers or
  duplicates credit. Each party's brokerage records its credited broker.
- Super Admin reconciles and reports on collected, pending, waived and
  refunded amounts, by party and by credited broker.

## 9. Notifications

- **Student:** request received, broker assigned (with contact, after
  acceptance), visit proposed/confirmed/reminder, brokerage amount to
  review, assignment confirmed, payment recorded/receipt.
- **Broker:** new lead offered (with response deadline), lead reassigned
  away/to them, follow-up due, visit changes, payment recorded.
- **Operations / Super Admin:** unassigned leads, allocation exceptions,
  critical errors.
- In-app and push first; WhatsApp/SMS/email as integrations.

## 10. Reports

Property/bed availability · lead funnel and conversion · visit-to-assignment
conversion · broker performance (including time to accept and timeouts) ·
**brokerage by party (student/owner) and by credited broker: collected,
pending, waived, refunded** · college/area/rent demand · property
performance · cancellations and lost reasons · allocation (queue time,
reassignments).

## 11. MVP scope

Login-gated student marketplace + broker CRM + property/room/bed management
+ automatic lead allocation + lead/visit/assignment tracking + brokerage
policy, disclosure, manual payments and credit + owner privacy + WhatsApp
sharing.

**Out of MVP:** online payment collection, owner portal, Flutter apps.

## 12. Technology

- One responsive web app (installable PWA), React/Next.js
- Backend: Laravel by default (to be confirmed by the implementing team)
- PostgreSQL; private object storage with signed URLs
- Phone OTP + RBAC with per-user permissions
- Notification provider abstraction; payment provider abstraction reserved
  for later
- Cloud deployment with staging, production, backups and monitoring

## 13. Success metrics

- Lead captured in under 2 minutes
- Relevant property found in under 3 minutes
- 100 % of active leads have an owner, a status and a next action
- 0 owner-contact or exact-address exposure to students
- 100 % of confirmed assignments have a brokerage record for each paying
  party, each with a credited broker
- 100 % of confirmed assignments have a recorded brokerage disclosure for
  each paying party

## 14. Open questions

See `decisions.md`, *Open questions* (BR-1 … BR-11, PV-1, PV-2, Q-T1,
Q-T2).
