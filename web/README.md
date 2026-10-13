# Prototype: student marketplace, broker app, Super Admin

Prototype steps 1–3 from `docs/ui-ux-spec.md` §13:

1. **Student:** Login (with return) → Marketplace → Property Detail →
   Request Visit → Request Received → My Requests
2. **Broker:** Dashboard → offered lead → Accept → propose visit → record
   visit → reserve a bed → show brokerage to each party → confirm →
   record payment → brokerage ledger
3. **Super Admin:** Overview → Unassigned Queue and manual reassignment
   (with history) → broker capacity, availability, leave and permissions →
   property verification → brokerage policies (versioned) → ledger with
   waivers, refunds and credit overrides → audit log

Next.js 15 (App Router) + Tailwind 4. The backend is a **mock** that
implements the student endpoints of `../api/openapi.yaml` with in-memory
data. The response types are generated from the contract, so the UI and
the mock cannot drift from it. When the real backend (Laravel by default)
exists, the route handlers in `src/app/api/v1` are replaced by calls to it.

## Run

```bash
npm install
npm run dev            # http://localhost:3000
```

The OTP is always **123456** (no SMS is sent). Data lives in memory and
resets when the server restarts.

| Log in as | Number |
|---|---|
| A student | any new 10-digit mobile number (you'll be asked for your name) |
| Asha, broker for North Campus (can override brokerage in the demo) | 98000 00011 |
| Ravi, broker for Riverside + North Campus | 98000 00012 |
| Neha, broker for Hill Road | 98000 00013 |
| Super Admin | 98000 00001 |

On a fresh server the Super Admin overview offers **Load sample activity**
(prototype only): a lead waiting in the Unassigned Queue because Neha is on
leave, a lead offered to Ravi, and a confirmed rental with the student
part-paid.

To see both sides, use a normal window for the student and a private
window for the broker.

## What it demonstrates

| Decision | Where |
|---|---|
| D-02 Login wall + return to the shared property | `src/middleware.ts`, `src/app/login`, `sanitizeReturnTo()` in `src/lib/server/auth.ts` |
| D-03 / privacy: no owner data or exact address reaches students | `src/lib/server/student-dto.ts` (the only mapper), `privacy.test.ts`, e2e HTML check |
| D-06 Only verified properties are listed | `studentVisibleProperties()` (PR-1008 is awaiting verification) |
| D-16 Shortlist never creates a lead | `src/lib/server/shortlist.ts` |
| D-05 Automatic allocation, lead reuse, Unassigned Queue | `src/lib/server/requests.ts` (mirrors `eligible_brokers()`) |
| D-07 Broker contact only after acceptance | `toStudentRequest()` |
| D-04 Student sees only their own brokerage, can acknowledge | request detail page |
| D-14 Broker sees the student's phone only after accepting | `toLeadDetail()` in `src/lib/server/broker-dto.ts` |
| D-05 Decline / missed window / availability off → next broker; never back to the same broker | `src/lib/server/broker.ts` |
| D-04 Quote per party, overrides with reason, confirm blocked until each party is shown the current amount | `src/lib/server/brokerage.ts` (mirrors `brokerage_quote()`) |
| D-08 Manual payments, per-party status, receipts | `recordPayment()` |
| D-15 Credit to the confirming broker; reassignment never moves it | `createBrokerageRecords()` |
| D-06 Approval with photo privacy check before a property is visible | `verifyProperty()` in `src/lib/server/admin.ts` |
| D-17 Manual reassignment with reason; full assignment history | `manualReassign()`, `/admin/leads/[id]` |
| D-04 Policies versioned, never edited in place | `createPolicy()` |
| Open questions BR-2, BR-3, BR-8, PV-1: restrictive defaults | Super Admin-only full waivers, manual refunds, whole-record credit, no self-verification |

**Demo brokerage values** come from an *example* policy (student 50% of a
month's rent, owner ₹2,000). They are placeholders until the real values
are set (D-04). Asha's override permission is demo-only (open question BR-1).

**Prototype shortcuts**: the response-timeout check and queue retry run
whenever a page loads instead of as background jobs; the response window
ignores business hours; notifications are not sent.

## Checks

```bash
npm run typecheck
npm test               # unit tests: privacy, allocation, broker, brokerage, admin, login safety
npm run test:e2e       # browser tests at phone and desktop sizes (admin flow on its own server)
npm run gen:api        # regenerate src/lib/api-types.ts after editing the contract
```

"StayNear" is a placeholder product name.
