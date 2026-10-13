# Automatic Broker Allocation

Status: **Draft v0.2** — implements the "Automatic Lead Assignment" requirement
(objective, workflow, eligibility, priority, reassignment, audit and the 8
acceptance criteria). Schema: `db/schema.sql` (`leads`, `lead_assignments`,
`brokers`, `broker_unavailability`, `broker_*_authorizations`,
`eligible_brokers()`). API: `api/openapi.yaml` (tags *Student – Requests*,
*Broker – Leads*, *Admin – Allocation*).

## 1. Principles

- Routine assignment is fully automatic. Super Admin never approves it.
- The student only ever sees **"Request Received"**. Which broker was tried,
  and why a lead moved, stays internal.
- A lead **offered** to a broker but not yet **accepted** can move
  automatically. An **accepted** lead, or one with a confirmed assignment,
  moves only under an explicit rule (§6.3) or a manual action.
- Every move is recorded in `lead_assignments` and `audit_logs`.

## 2. Lead allocation states

Separate from the sales status (`leads.status`), each lead carries
`allocation_status`:

| State | Meaning | Required fields |
|---|---|---|
| `unassigned` | Waiting in the **Unassigned Queue** | `queued_at`; `broker_id` is NULL |
| `offered` | Given to a broker who hasn't accepted yet | `broker_id`, `response_due_at` |
| `accepted` | The broker is actively handling it | `broker_id` |

The database enforces these combinations with CHECK constraints.

**Acceptance** happens when the broker taps **Accept** or takes any first
action on the lead (logs a call, changes the status, proposes a visit). Any of
these clears `response_due_at`.

```
             request / queue retry              accept / first action
 (none) ──► unassigned ─────────────► offered ─────────────────────► accepted
                ▲   no eligible broker   │  timeout / declined /           │
                └────────────────────────┘  broker unavailable             │
                       (or offered to the next eligible broker)            │
                                                                           │
          explicit rule (§6.3) or manual reassignment ◄────────────────────┘
```

## 3. Eligibility

A broker is eligible when **all** of the following hold (`eligible_brokers()`):

| Rule | Data |
|---|---|
| Account active | `users.status = 'active'` and `role = 'broker'` |
| Availability enabled | `brokers.accepting_leads = true` (the broker's own toggle) |
| Under capacity | count of the broker's `leads.is_active` rows < `brokers.max_active_leads` |
| Authorized | is the property's broker, **or** in `broker_property_authorizations`, **or** in `broker_area_authorizations` for the property's area |
| Not on leave / not marked unavailable | no current row in `broker_unavailability` (created by the broker or by Super Admin; `kind` = `leave` or `unavailable`) |
| Not excluded for this lead | not already timed out, declined, or made unavailable on **this** lead (stops a lead bouncing back) |

*Active leads* covers every lead status except `move_in_complete` and the five
terminal states. Offered leads count toward capacity.

## 4. Selection priority

`eligible_brokers(property_id, excluded[])` returns candidates in this order:

1. **Tier 1:** the property's assigned broker.
2. **Tier 2:** any broker authorized for the property or its area.
3. Within a tier: **fewest active leads**, then **least recently assigned**
   (`brokers.last_assigned_at`, NULL first). The second key is the
   round-robin tie-breaker.

## 5. Request flow (student clicks *Request a Visit* / *I'm Interested*)

All of this runs in **one database transaction**:

```
1. Validate: student logged in, property is student-visible.
2. Look up the ACTIVE lead for (student, property)          -- AC7
   ├─ found  → reuse it:
   │     • attach the new visit request (visits row, status 'requested')
   │       or log the interest; bump last_student_activity_at
   │     • notify the current broker, if any ("Student re-requested")
   │     • do NOT re-run allocation
   │     • go to step 6
   └─ not found → INSERT lead (status 'new').
         The unique index leads_one_active_per_student_property makes a
         concurrent double-click fail safely; on unique_violation, re-read
         and treat it as "found".
3. candidates = eligible_brokers(property_id, '{}')
4. For each candidate, in order:
     SELECT … FROM brokers WHERE user_id = :candidate FOR UPDATE
     re-count active leads; if still < max_active_leads → choose it, stop.
   (The lock stops two simultaneous requests from overfilling one broker.)
5a. Broker chosen:
     lead.broker_id = chosen, allocation_status = 'offered',
     response_due_at = deadline(now, response_window)            (§7)
     brokers.last_assigned_at = now()
     INSERT lead_assignments(method 'automatic',
        reason tier=1 ? 'property_broker' : 'authorized_fallback')
     INSERT follow_up("Respond to new lead", due = response_due_at)
     queue notification → broker (push + in-app)
5b. Nobody eligible:                                             -- AC5
     allocation_status = 'unassigned', queued_at = now()
     INSERT lead_assignments(new_broker_id NULL, reason 'no_eligible_broker')
     queue notification → users.receives_ops_alerts = true
6. INSERT audit_logs; COMMIT.
7. Respond to the student: 202 "Request Received" (the same response in every branch).
```

Notifications go out **after commit** (outbox/queue job), so a failed SMS or
push never rolls back the lead.

## 6. Reassignment

### 6.1 Automatic: before acceptance

| Trigger | Detected by | Action |
|---|---|---|
| Broker misses the response window | **Sweeper job** every minute: `allocation_status='offered' AND response_due_at < now()` | Re-allocate with that broker excluded. Reason `response_timeout` |
| Broker turns `accepting_leads` off, starts leave/unavailability, or is suspended | Event handler on that change, plus the sweeper as a safety net | Re-allocate each of their **offered** leads. Reason `broker_unavailable` |
| Broker taps **Decline** | API call | Re-allocate with the broker excluded. Reason `broker_declined` |

*Re-allocate* means running steps 3–5 of §5 with
`excluded = every broker who previously timed out on, declined, or went
unavailable for this lead`. If no one else is eligible, the lead goes to the
Unassigned Queue. The previous broker is notified ("Lead LD-… was moved to
another broker"); the new broker gets the normal new-lead notification
(AC6). Open follow-ups move to the new broker.

### 6.2 Unassigned Queue retry

The queue is processed FIFO by `queued_at`:

- **Event-driven:** a broker turns availability on, a leave ends, a lead
  closes (capacity frees up), or a broker gains a new area/property
  authorization.
- **Periodic:** every 5 minutes as a safety net.

Each queued lead is re-allocated with reason `queue_retry`. Queued leads
**older than `unassigned_escalation_minutes`** trigger one more ops alert.

### 6.3 Explicit rules for accepted leads (AC8)

Accepted leads and confirmed assignments are **never** moved by the sweeper.
They move only when:

| Rule | Behaviour |
|---|---|
| Broker account **deactivated** | Accepted leads **without** a confirmed assignment are re-allocated automatically (reason `broker_deactivated`). Leads **with** a confirmed or moved-in assignment go to the Super Admin *Exceptions* list for manual handover. |
| Broker on **leave** with an accepted lead | Not moved. Follow-ups that fall due during the leave are flagged on the ops dashboard. |
| **Manual** reassignment by Super Admin | Allowed at any state; a reason note is required (`method='manual'`, DB CHECK). May exceed capacity. |

The confirmed `assignments` row keeps its own `broker_id` as a historical
fact. **Brokerage credit never follows a lead reassignment** (D-15). It is
stored on each brokerage record and changes only by a Super Admin credit
override (`brokerage.md` §6).

## 7. Configuration (Super Admin → Settings)

Stored in `system_settings` (global) and on `brokers` (per broker).

| Key | Default (proposed) | Notes |
|---|---|---|
| `allocation.response_window_minutes` | `30` | Time to accept before auto-reassignment |
| `allocation.business_hours` | `{"tz":"Asia/Kolkata","start":"09:00","end":"21:00","days":[1,2,3,4,5,6,7]}` | The response clock runs only in business hours. A 22:30 request gets a deadline of 09:30 the next day |
| `allocation.unassigned_escalation_minutes` | `60` | Re-alert ops while a lead sits in the queue |
| `allocation.max_auto_offers_per_lead` | `5` | After this many automatic offers, queue it and alert ops instead of continuing |
| `brokers.max_active_leads` (per broker) | `40` | Capacity |
| `brokers.accepting_leads` (per broker) | `true` | The broker's own toggle |

## 8. Audit and reporting

`lead_assignments` holds one row per allocation event:

| Required field (spec §7) | Column |
|---|---|
| Lead ID | `lead_id` |
| Previous broker | `previous_broker_id` |
| Newly assigned broker | `new_broker_id` (NULL = to queue) |
| Assignment timestamp | `created_at` |
| Assignment reason | `reason` (+ `reason_note`) |
| Automatic / Manual | `method` |
| Broker response deadline | `response_due_at` |

Also recorded: `accepted_at` (time to accept) and `ended_at` (when the
assignment was superseded). Reports this enables: time-to-accept per broker,
timeout rate, % of leads served by the property's own broker, queue
time.

## 9. Acceptance criteria → verification

| # | Criterion | Where it is enforced | Tested by |
|---|---|---|---|
| 1 | Property broker receives the lead first | `eligible_brokers()` tier 1 | `db/tests/schema_rules_test.sql` |
| 2 | Unavailable broker bypassed | eligibility rules (toggle, leave, suspended, capacity) | same |
| 3 | Eligible alternative receives it | tier 2 + fewest-leads / round-robin | same |
| 4 | No Super Admin approval needed | flow §5 has no approval step | API test (build phase) |
| 5 | No broker → Unassigned Queue | §5 step 5b; empty `eligible_brokers()` | same (empty result); API test |
| 6 | Reassignment recorded + notified | `lead_assignments` + §6.1 notifications | API test (build phase) |
| 7 | No duplicate active leads | unique partial index `leads_one_active_per_student_property` | same |
| 8 | Confirmed assignments not silently reassigned | sweeper only touches `allocation_status='offered'`; §6.3 | API test (build phase) |

## 10. Related decisions

- **D-16** Shortlist never creates a lead. *Request Visit* and *I'm
  Interested* do.
- **D-14** Before acceptance a broker sees the student's name, college,
  course/year, budget and requested property, but no phone, email or
  documents. After acceptance the contact details are returned, and each
  reveal is audited (`lead.contact_viewed`).
- **D-07** The student sees the broker's name and business phone only
  after acceptance. If the lead is later reassigned, the student sees the
  new broker once that broker accepts.
- **D-15** Brokerage credit follows the confirmed assignment, never the
  reassignment. Splitting credit is open (BR-8).
