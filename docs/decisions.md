# Decision Log

Decisions that change or clarify the v1.0 product documents. The v1.1
documents in this folder (`requirements.md`, `srs.md`, `workflow.md`,
`ui-ux-spec.md`) already include every **Decided** item below and replace
the v1.0 PDFs.

| ID | Topic | Status | Decision |
|---|---|---|---|
| D-01 | Lead states | **Decided** (adopted in v1.1 docs) | 12 stages + 5 terminal states, as in the Workflow document. See `data-model.md` §5. |
| D-02 | Login wall | **Decided** | Listings and property detail are visible **only after student login**. A shared WhatsApp link sends signed-out users to login, then back to that property. |
| D-03 | Exact address | **Decided** (adopted in v1.1 docs) | Exact address, house number, exact pin, landmark and owner identity are private. Students see area, a non-identifying locality label, an approximate location circle and college distances. Public photos must be privacy-checked. |
| D-04 | Brokerage formula and payer | **Decided** | Configured separately for student and owner: fixed / % of monthly rent / one or more months' rent. Payer = student, owner or both, each with its own calculation. Property- and assignment-level overrides with a mandatory reason and history. Amount shown to each party before confirmation. Separate payment status per party. See `brokerage.md`. |
| D-05 | Lead allocation | **Decided** | Automatic allocation with fallback, capacity, leave, response window and Unassigned Queue. See `broker-allocation.md`. |
| D-06 | Property verification | **Decided** | Super Admin or an **authorized verifier** (`can_verify_properties`) approves every property before it becomes visible. |
| D-07 | Broker contact shown to students | **Decided** | The assigned broker's name and business phone are shown **only after the broker accepts the lead**. The owner's contact is never shown. |
| D-08 | Payments | **Decided** | MVP records payments manually (cash, UPI, bank transfer). No online collection; it can be added later. |
| D-09 | Beds | **Decided** | Separate `beds` entity; assignment is per bed. |
| D-10 | Extra tables | **Decided** | Shortlists, Notifications, Rent History, Lead Status History, lookups for Colleges/Areas/Amenities. Assignments keep rent/deposit snapshots. |
| D-11 | Statuses | **Decided** | Visit: Requested, Proposed, Confirmed, Rescheduled, Completed, Cancelled, No-show. Assignment: Draft, Pending Confirmation, Reserved, Confirmed, Cancelled, Completed (move-in). |
| D-12 | Student documents | **Decided** | College/student ID supported; government ID only when needed. Restricted access, private storage, purpose and retention recorded. DPDP Act 2023 review before launch. |
| D-13 | Technology | **Decided** (backend to confirm) | One responsive web app (PWA) + one backend; Flutter deferred. Default Laravel + PostgreSQL + React/Next.js. |
| D-14 | Student contact before acceptance | **Decided** | Brokers do not see the student's phone (or email or documents) before accepting the lead. After acceptance they see what they need to handle the enquiry. |
| D-15 | Brokerage credit | **Decided** | Configurable policy. Default: credit the broker officially responsible for the successful assignment. Super Admin overrides with an audit trail. Reassignment alone never transfers or duplicates credit. Credit is recorded per party's brokerage record. |
| D-16 | What creates a lead | **Decided** | Shortlist does **not** create a lead. Leads are created by *Request Visit* and *I'm Interested* (the defined contact/request actions), and by brokers for walk-in/phone enquiries. |
| D-17 | Reassignment history | **Decided** | Every reassignment keeps previous broker, new broker, reason and timestamps (`lead_assignments`). |

## Open questions

Business-policy items still undecided. The system does **not** assume an
answer: where something must behave somehow, the most restrictive option is
used (Super Admin only) and marked here.

| ID | Question | Current system behaviour until decided |
|---|---|---|
| BR-1 | Which users may create brokerage overrides? | Super Admin, plus anyone explicitly granted `can_override_brokerage` (nobody by default) |
| BR-2 | Who may waive brokerage; partial waivers? | Super Admin only; full waiver of the outstanding amount only |
| BR-3 | When refunds apply, who approves, partial refunds? | Super Admin records refunds manually; partial amounts supported |
| BR-4 | When is brokerage due? | `due_date` left empty |
| BR-5 | Rounding rule | Calculated to the paisa |
| BR-6 | Is acknowledgement required, or only disclosure? | Disclosure required; acknowledgement recorded if given |
| BR-7 | Credit policies other than the default | Only `assignment_broker` exists |
| BR-8 | Split credit between brokers | Not supported |
| BR-9 | GST / tax on brokerage and on receipts | No tax lines |
| BR-10 | Fractional months of rent (e.g. 1.5)? | Any value ≥ 1 accepted |
| BR-11 | Brokerage when confirmed terms change later | Manual (Super Admin) |
| PV-1 | May a verifier approve a property they manage themselves? | Not allowed (most restrictive); Super Admin can approve any property |
| PV-2 | What does a shared link's WhatsApp preview show to someone not logged in? | Generic platform preview only, no property details |
| Q-T1 | Laravel vs NestJS final pick | Prototype frontend is backend-agnostic |
| Q-T2 | SMS/OTP and WhatsApp providers | Mocked in the prototype |
