# Brokerage: Policy, Disclosure, Payment and Credit

Status: **v0.2**. Implements decision D-04 (formula and payer), D-08
(manual payments) and D-15 (brokerage credit). Schema: `db/schema.sql`
§6 and §10 (`brokerage_policies`, `brokerage_overrides`,
`brokerage_disclosures`, `brokerages`, `brokerage_credit_changes`,
`payments`, `brokerage_refunds`, `brokerage_quote()`). API: tags *Broker –
Brokerage*, *Admin – Brokerage*, *Admin – Configuration*.

## 1. Rules (decided)

1. Brokerage is configured **separately for the student and the owner**.
2. Each party's calculation is one of:
   - **Fixed amount** (`flat`), INR
   - **Percentage of monthly rent** (`percent_of_monthly_rent`), 0–100 %
   - **One or more months' rent** (`months_of_rent`), ≥ 1 month
3. Super Admin sets **who pays**: `student`, `owner` or `both`. When both
   pay, each party has its own calculation.
4. **Overrides** at property level or assignment level, per party. A
   **reason is mandatory**, and the full history is kept (overrides are
   revoked, never edited or deleted).
5. Each paying party is **shown their amount before the assignment is
   confirmed**. The system refuses confirmation otherwise.
6. **Each party's payment status is tracked separately**: Pending,
   Partially Paid, Paid, Waived, Cancelled, Refund Pending, Refunded.
7. **MVP: payments are recorded manually**: cash, UPI or bank transfer, with
   a reference (except cash) and a receipt. No online payment collection.
8. **Credit** goes, by default, to the broker officially responsible for the
   successful rental assignment. Super Admin can override it with a reason;
   every change is audited. **Lead reassignment never moves or duplicates
   credit.** Credit is recorded per party's brokerage record.

## 2. Configuration model

### 2.1 Policies (Super Admin → Settings → Brokerage)

A policy applies to a **scope**: all properties, an area, a property type,
or an area + property type. It decides who pays and each party's
calculation.

| Field | Example |
|---|---|
| Scope | Area = North Campus, Type = PG |
| Priority | 0 |
| Payer | Both |
| Student calculation | 50 % of monthly rent |
| Owner calculation | Fixed ₹2,500 |

**Which policy applies**: the active matching policy with the highest
priority. On a tie, the more specific scope wins (area + type, then area or
type, then all), then the newest.

Policies are **never edited in place**. Saving a change creates a new
policy and deactivates the old one, so every past brokerage can be traced
to the exact policy that produced it.

### 2.2 Overrides

| Level | Effect | Typical use |
|---|---|---|
| **Property** | Applies to every future assignment at that property, for one party | Owner-paid property: student `not_charged`, owner 1 month |
| **Assignment** | Applies to one assignment, for one party; allowed only **before confirmation** | Negotiated discount |

- An override replaces the calculation for **one party**.
  `not_charged` removes that party's charge. An override can also add a
  charge for a party the policy doesn't charge.
- **Order of precedence per party:** assignment override → property
  override → policy.
- At most one active override per party at each level. A new one revokes the
  previous one, with the reason recorded.
- **Who may override:** Super Admin, plus users granted
  `can_override_brokerage`. Which brokers should hold this permission is a
  business choice (open question BR-1).

## 3. Calculation (`brokerage_quote`)

```
rent_base = assignment.rent_snapshot (monthly rent for the bed)

flat                    → value
percent_of_monthly_rent → rent_base × value / 100
months_of_rent          → rent_base × value
not_charged             → no line for that party
```

The same database function produces the **quote shown before
confirmation** and the **amount frozen at confirmation**. They cannot
differ. Amounts are computed to the paisa; the business rounding rule is
open (BR-5). The rent base is the monthly rent only (not deposit or
maintenance), as decided.

## 4. Disclosure before confirmation

```
Broker opens the assignment ─► "Brokerage" panel shows the quote per party
     │
     ├─ Student: "Send to student" (in_app) → notification + amount on the
     │           student's request screen. Or record whatsapp / phone /
     │           in_person / email.
     ├─ Owner:   broker records how it was communicated
     │           (whatsapp / phone / in_person / email)
     ▼
Confirm assignment
     └─ refused with BROKERAGE_NOT_DISCLOSED unless every charged party has a
        disclosure whose amount equals the CURRENT quote
        (a later override means it must be shown again)
```

- The student sees **only their own amount**, never the owner's, and never
  the internal calculation source.
- The student can tap **Acknowledge**. Whether acknowledgement is
  *required* before confirmation is open (BR-6); until decided,
  confirmation requires disclosure only.

## 5. Records and statuses

At confirmation, one `brokerages` row is created **per charged party**,
holding the frozen calculation (`calc_snapshot`), the source (policy or
override), the amount, and the **credited broker**.

| Status | Meaning | Entered when |
|---|---|---|
| `pending` | Nothing paid | Created at confirmation |
| `partially_paid` | 0 < paid < amount | Payment recorded |
| `paid` | paid = amount | Payment recorded |
| `waived` | Not to be collected | Waived with reason (Super Admin; BR-2) |
| `cancelled` | Assignment cancelled before any payment | Assignment cancelled |
| `refund_pending` | A refund has been started | Refund requested |
| `refunded` | Refund paid out | Refund completed |

Database guarantees: paid ≤ amount; refunded ≤ paid; `paid` only when fully
paid; `waived` needs a reason and the person who waived; `cancelled` needs a
reason; a non-cash payment needs a reference; a voided payment needs a
reason. Payments are voided, never deleted.

## 6. Credit

- When the brokerage record is created, `credited_broker_id` = the broker on
  the confirmed assignment, and a first `brokerage_credit_changes` row is
  written by the system.
- **Reassigning the lead afterwards changes nothing.** Credit is stored on
  the brokerage record, not read from the lead (covered by a test).
- **Super Admin override:** `POST /admin/brokerages/{id}/credit` with a
  reason. This adds a history row (previous broker → new broker, who
  authorized it, when).
- Student and owner brokerage are separate records, so each has its own
  credited broker and history. Reports show "credited to" per transaction.
- Splitting credit between brokers is **not supported** until decided
  (BR-8).

## 7. Open questions (business policy; not assumed)

| ID | Question |
|---|---|
| BR-1 | Which brokers (if any) get `can_override_brokerage`, or is it Super Admin only? |
| BR-2 | Who may waive brokerage? Are partial waivers allowed? |
| BR-3 | When are refunds due (e.g. cancellation after payment, student backs out before move-in)? Who approves? Partial refunds? |
| BR-4 | When is brokerage due (at confirmation, at move-in, within N days)? Sets `due_date`. |
| BR-5 | Rounding rule (nearest rupee? nearest ₹10?) |
| BR-6 | Must the student (and/or owner) explicitly acknowledge the amount before confirmation, or is recorded disclosure enough? |
| BR-7 | Any credit policy other than "broker responsible for the assignment" (e.g. lead originator)? |
| BR-8 | Can credit be split between brokers, and in what proportions? |
| BR-9 | Is GST or another tax applied to brokerage, and must receipts show it? |
| BR-10 | Can months-of-rent values be fractional (e.g. 1.5 months)? The schema currently allows any value ≥ 1. |
| BR-11 | If a confirmed assignment's terms change (rent renegotiated), is the brokerage recalculated or adjusted manually? |
