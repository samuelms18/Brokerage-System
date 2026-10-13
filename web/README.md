# Student marketplace prototype

Prototype step 1 from `docs/ui-ux-spec.md` §13:
**Login (with return) → Marketplace → Property Detail → Request Visit →
Request Received → My Requests.**

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

Log in with any 10-digit mobile number; the OTP is always **123456** (no
SMS is sent). Data lives in memory and resets when the server restarts.

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

**Prototype controls**: the request page has a dashed panel that simulates
the broker accepting and sharing a brokerage amount, until the broker app
(prototype step 2) exists. The brokerage amount uses an *example* policy
only. Turn the panel off with `PROTOTYPE_TOOLS=off`.

## Checks

```bash
npm run typecheck
npm test               # unit tests: privacy, allocation, login safety
npm run test:e2e       # browser tests at phone and desktop sizes
npm run gen:api        # regenerate src/lib/api-types.ts after editing the contract
```

"StayNear" is a placeholder product name.
