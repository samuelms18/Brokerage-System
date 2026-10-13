# UI/UX Product Specification — v1.1

Information architecture, screens, components and UX rules.

| | |
|---|---|
| Version | **v1.1**: supersedes v1.0 (October 2026) |
| Prototype | `web/` (Student Marketplace → Property Detail → Request Visit) |

## 1. UX vision

The student marketplace should feel simple and trustworthy. The broker UI
should be built for speed, scanning and follow-up. The Super Admin UI should
emphasize control and analytics.

## 2. Information architecture

- **Student:** Login → Home/Search → Property Detail → Shortlist →
  My Requests (visits, brokerage) → Profile
- **Broker:** Dashboard → Leads (Awaiting acceptance / Mine) → Properties →
  Visits → Assignments → Brokerage → Students → Reports → Profile &
  Availability
- **Super Admin:** Overview → Brokers (availability, capacity,
  authorizations, permissions) → Allocation (Unassigned Queue, Exceptions)
  → Students → Properties (Verification queue) → Leads → Assignments →
  Brokerage (Policies, Ledger, Waivers, Refunds, Credit) → Reports →
  Settings → Audit

## 3. Student screens

| Screen | Key UI |
|---|---|
| Login | Phone + OTP. When arriving from a shared link, a short note ("Log in to view this property") and a return to that property afterwards |
| Home | Search, quick filters, recommended/all properties |
| Listing | Cards, sort, filters, result count, no-result suggestions |
| Detail | Gallery, sticky rent/deposit summary, bed availability, amenities, approximate area circle (no pin), rules, similar properties; CTAs **Request Visit** (primary), **Shortlist** (secondary) |
| Shortlist | Saved properties. The heart icon says "Saved"; nothing implies a broker was contacted |
| Visit request | Up to 3 preferred date/time slots, number of people, note |
| Request received | "Request Received — Your property request has been received. Our broker will contact you shortly." |
| My Requests | Timeline and simplified status. Broker card appears only after acceptance. Brokerage card appears once disclosed, with an **Acknowledge** button and payment status |
| Profile | College, budget, preferences |

## 4. Broker screens

| Screen | Key UI |
|---|---|
| Dashboard | KPIs: awaiting acceptance (with countdown), new leads, visits today, follow-ups due/overdue, assignments pending, brokerage pending. Availability toggle |
| Lead list | Tabs: Awaiting acceptance / Active / Closed; filters; search |
| Lead detail (offered) | Student name, college, budget, requested property, **"Contact details appear after you accept"** placeholder; **Accept** / **Decline** with the deadline |
| Lead detail (accepted) | Contact info, requirements, matches, visits, timeline, follow-ups |
| Property list | Status, occupancy, owner-private indicator |
| Property edit | Public listing section + clearly separated **"Owner Details — Admin only"** panel; photo privacy checks |
| Room manager | Rooms with bed cards (Available / Reserved / Occupied / Maintenance / Blocked) |
| Visit calendar | Day/week |
| Assignment | Student + bed + commercial snapshot + **Brokerage panel**: per-party amount, calculation source, override (if permitted, reason required), disclosure status per party ("Shown to student ✓ in-app", "Owner: not yet shown"). **Confirm** is disabled with an explanation until every paying party has been shown the current amount |
| Brokerage ledger | One row per party per assignment; columns party, amount, paid, status, credited broker; record payment; receipt |

## 5. Super Admin screens

- Executive dashboard
- Broker management: availability, capacity, leave, area/property
  authorizations, permissions (verifier, brokerage override)
- Allocation: Unassigned Queue, exceptions, assignment history per lead,
  manual reassignment (reason required)
- **Verification queue** (also for verifiers): approve/reject with a note;
  photo privacy checklist
- **Brokerage policies**: list by scope; editing creates a new version;
  history visible
- Brokerage reconciliation: by party and by credited broker; waive (reason),
  refunds (request/complete), credit override (reason) with history
- Reports/exports, audit logs
- Configuration: colleges, areas, amenities, allocation settings

## 6. Property detail UX

Large photo gallery · sticky rent/deposit summary · availability indicator
(beds available) · amenity chips · approximate area circle with a "Location
shared after visit confirmation" note · house rules · college distances ·
similar properties · primary CTA **Request Visit** · secondary
**Shortlist**. If the student already has an open request, the CTA becomes
**View request**.

Broker contact is **not** shown on the property page. It appears in My
Requests after a broker accepts.

## 7. Search and filters

Mobile filter bottom sheet; desktop filter panel · active filter chips +
Clear All · result count · sort: Recommended / Lowest Rent / Nearest /
Newest · useful no-result suggestions.

## 8. Broker dashboard

Prioritize actions over decoration. Each KPI deep-links to its filtered
list. Offered leads show a countdown to the response deadline.

## 9. Privacy UX

- An explicit **"Owner Details — Admin only"** section. Owner data must be
  absent from student API responses, never hidden with CSS.
- Before acceptance, lead screens show a locked placeholder for student
  contact, not a blurred value. The value is not in the page at all.
- The student brokerage card shows only the student's own amount.

## 10. Design system

| Token | Recommendation |
|---|---|
| Font | Inter or equivalent |
| Spacing | 8 px system |
| Grid | 12-column desktop; responsive mobile |
| Radius | 10–16 px cards; 8–12 px controls |
| Status | Green success, amber attention, red critical, blue info |
| Touch | ~44 px minimum |
| Icons | Consistent 20–24 px set |
| Cards | Subtle border/elevation; avoid heavy shadows |

## 11. States

Loading skeleton · empty / no results · network error · permission denied
· **login required (with return)** · session expired · property unavailable
· bed already assigned · duplicate lead (shown to students as their
existing request) · **brokerage not yet shown to a party (confirm
disabled)** · payment recorded / voided · visit cancelled · document upload
failed.

## 12. UX metrics

Login completion from shared links · search→detail · detail→request ·
request→broker acceptance time · visit→assignment · brokerage disclosure→
confirmation time · lead→assignment time · follow-up completion · brokerage
collection rate per party.

## 13. Prototype priority

1. **Student:** Login (with return) → Marketplace → Property Detail →
   Request Visit → Request Received → My Requests *(built in `web/`)*
2. **Broker:** Dashboard → Offered lead → Accept → Visit → Assignment with
   brokerage disclosure
3. Brokerage ledger / receipt

Validate these before advanced AI or analytics.
