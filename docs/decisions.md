# Decision Log

Decisions that change or clarify the v1.0 product documents (Complete
Requirements, SRS, Workflow, UI/UX Specification). Where this log and those
documents differ, **this log wins** until they are re-issued.

Status key: **Decided** = confirmed by the product owner.
**Proposed** = the default used in the schema/API until someone confirms or
changes it.

| ID | Topic | Status | Decision |
|---|---|---|---|
| D-01 | Lead states | Proposed | Use the Workflow document's list (12 stages + 5 terminal states) everywhere. See `data-model.md` §5. |
| D-02 | Login wall | Proposed | Listing search and property detail are **public** (needed for WhatsApp links and search engines). Shortlist, visit request, interest and request tracking require OTP login. A `marketplace.require_login` setting can switch browsing back to login-only. |
| D-03 | Exact address | Proposed | Exact address, house number, exact pin, landmark and owner name are **private** (`property_private_details`). Students see area, a non-identifying locality label, an approximate map position and college distances. Public photos must be privacy-checked. |
| D-04 | Brokerage rule | **Open** | Calculation and payer are configurable (`brokerage_rules`: flat / % of monthly rent / N months of rent; payer student or owner). The actual business values are still needed. |
| D-05 | Lead allocation | **Decided** | Automatic allocation with fallback, capacity, leave, response window and Unassigned Queue. See `broker-allocation.md`. |
| D-06 | Property verification | Proposed | A broker submits (`draft → verification`); Super Admin verifies the details and photo privacy checks, then publishes. A per-broker "trusted publisher" permission can be added later. |
| D-07 | Broker contact shown to students | Proposed | Setting `contact.broker_visibility` = `after_acceptance` (default) / `always` / `never`. Once a broker accepts, the student sees the broker's display name and **business** phone. The owner's contact is never shown. |
| D-08 | Payments | Proposed | MVP **records** payments (UPI ref, cash, bank transfer) and issues receipts. No online collection. A payment-provider interface is kept for later. |
| D-09 | Beds | **Decided** | Separate `beds` entity; assignment is per bed, each with its own status. |
| D-10 | Extra tables | **Decided** | Shortlists, Notifications, Rent History (effective dates), Lead Status History, lookups for Colleges/Areas/Amenities. Assignments keep rent/deposit snapshots. |
| D-11 | Statuses | **Decided** | Visit: Requested, Proposed, Confirmed, Rescheduled, Completed, Cancelled, No-show. Assignment: Draft, Pending Confirmation, Reserved, Confirmed, Cancelled, Completed (move-in). |
| D-12 | Student documents | **Decided** | College/student ID supported; government ID only when needed. Access limited to the student and staff who need it. Private storage with signed URLs; purpose and retention period recorded per document. DPDP Act 2023 review before launch. |
| D-13 | Technology | **Decided** (stack to confirm) | One responsive web app (PWA) + one backend. Flutter deferred. Default: Laravel + PostgreSQL + React/Next.js, pending confirmation of the implementing team's strongest backend framework. |

## Open questions

| ID | Question | Owner |
|---|---|---|
| D-04 | Brokerage amount formula and who pays | Business |
| Q-A1 | Should Shortlist create a lead? (proposed: no) | Business |
| Q-A2 | What a broker sees before accepting a lead (proposed: no student phone) | Business |
| Q-A3 | Brokerage credit when a lead was reassigned mid-way | Business |
| Q-T1 | Laravel vs NestJS final pick | Dev team |
| Q-T2 | SMS/OTP and WhatsApp providers (e.g. MSG91, Gupshup, Twilio) | Dev team |
