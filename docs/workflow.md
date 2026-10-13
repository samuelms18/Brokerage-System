# End-to-End Workflow — v1.1

Student, broker, lead, visit, assignment and brokerage flows.

| | |
|---|---|
| Version | **v1.1**: supersedes v1.0 (October 2026) |
| Detail | `broker-allocation.md` (allocation), `brokerage.md` (brokerage) |

## 1. Overall flow

Login → Discover → Request → Allocate → Accept → Contact → Visit → Negotiate
→ Assign (brokerage disclosed) → Confirm (brokerage created) → Payment →
Documents → Move-in

## 2. Student journey

1. Opens the app or a shared link → **login with OTP** (if signed out) →
   returned to the page they opened.
2. Marketplace → search/filter → property detail.
3. **Shortlist** (no lead, no broker notified) and/or **Request Visit /
   I'm Interested** (creates or reuses a lead) → "Request Received".
4. A broker accepts → the student sees the broker's name and business
   phone.
5. Visit proposed → confirmed → visit happens.
6. Assignment prepared → the student is **shown their brokerage amount**
   (and may acknowledge it) → assignment confirmed.
7. Payment recorded by the broker → receipt → move-in.

## 3. Shared link (WhatsApp)

```
Broker taps Share → safe text + link /p/{code} → WhatsApp
  → recipient opens link
      ├─ signed in  → property detail
      └─ signed out → /login?next=/p/{code} → OTP → property detail
  → Request Visit → lead created (source: whatsapp_share if the link was tagged)
```
The link preview shows only generic platform branding (PV-2). The share
text never contains owner contact or the exact address.

## 4. Property publishing

Broker creates property → links the owner privately → exact address and
pin (private) → photos (privacy check) → rooms and beds → pricing → submit
for verification → **Super Admin or authorized verifier approves** →
published (visible to logged-in students). Rejection returns it to Draft
with a note.

## 5. Lead state machine

New → Contacted → Requirement Confirmed → Properties Suggested → Visit
Scheduled → Visited → Interested → Negotiation → Assigned → Brokerage
Pending → Brokerage Paid → Move-in Complete.

Terminal: Not Interested, Lost, Student Cancelled, Property Unavailable,
Duplicate.

Allocation state (separate): Unassigned → Offered → Accepted.

## 6. Lead allocation

1. The student submits Request Visit / I'm Interested.
2. If there is an active lead for student + property, it is **reused**
   (no duplicate, no re-allocation).
3. Otherwise a lead is created and offered to the property's broker if
   eligible, else another eligible broker (fewest active leads, then
   round-robin), else the **Unassigned Queue** (ops alerted, automatic
   retry).
4. The broker is notified with a response deadline. A follow-up task is
   created.
5. The broker **accepts** → the student's contact details become visible
   to the broker, and the broker's contact to the student.
6. Not accepted in time, declined, or the broker becomes unavailable → it
   moves to the next eligible broker automatically.
7. Every move is recorded: previous broker, new broker, reason, method,
   timestamps.

## 7. Visit flow

Student requests slot(s) → broker proposes a time → student confirms →
reminder → visit → outcome recorded (required) → next action.

## 8. Assignment and brokerage flow

```
Broker selects lead + bed
  → availability check + lock → Draft / Reserved (bed reserved)
  → optional owner confirmation
  → Brokerage panel: quote per paying party (policy / property override /
    assignment override)
      → optional assignment override (permission + reason)
      → disclose to student (in-app or other method) and to owner (record method)
  → collect required documents
  → CONFIRM
      ├─ refused if any paying party's disclosure is missing or outdated
      └─ success: snapshot frozen; bed occupied; lead → Assigned;
         one brokerage record per paying party (Pending),
         credited to the broker responsible for this assignment
```

## 9. Brokerage payment flow (per party)

```
Pending ──payment──► Partially Paid ──payment──► Paid
   │                        │                      │
   ├─ waive (reason) ─► Waived                     ├─ refund requested ─► Refund Pending ─► Refunded
   └─ assignment cancelled, nothing paid ─► Cancelled
```
- Payments are recorded manually (cash / UPI / bank transfer). A reference
  is required except for cash. Each payment gets a receipt.
- The student's and the owner's brokerage move independently.
- When refunds apply, partial waivers, and who approves them: open (BR-2,
  BR-3).

## 10. Brokerage credit

- Set at confirmation to the broker responsible for the assignment.
- Lead reassignment before or after confirmation **does not** move credit.
- Changing credit requires a Super Admin override with a reason and is
  recorded in the credit history.

## 11. Owner privacy flow

Student → login → public property API → request/lead → broker → owner. The
owner's phone, email, identity and the exact address never enter a student
payload.

## 12. Duplicate lead

An active student + property lead already exists → a student re-request
reuses it. A broker trying to create a manual duplicate is blocked
(`DUPLICATE_ACTIVE_LEAD`). Super Admin may reassign the existing lead with
a reason → audit event.

## 13. Follow-up

Every open lead always has a next action and date. Overdue items appear on
the dashboard. A broker can reschedule or snooze with a reason. Open
follow-ups move with the lead on reassignment.

## 14. Exceptions

- **Property becomes unavailable** → active leads closed as Property
  Unavailable; students notified and offered similar properties.
- **Broker leaves (deactivated)** → offered and accepted leads without a
  confirmed assignment are reassigned automatically. Leads with confirmed
  assignments go to the Super Admin exceptions list. Brokerage credit is
  unchanged unless Super Admin overrides it.
- **Owner changes rent** → effective date; confirmed assignments keep
  their snapshot.
- **Bed conflict** → row lock; the second attempt gets `BED_NOT_AVAILABLE`.
- **Brokerage amount changes after disclosure** (new override) →
  confirmation blocked until it is shown again.
