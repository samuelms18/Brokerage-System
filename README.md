# Student Rental Brokerage Platform

A student marketplace and broker CRM for managing student rental homes.
Students browse and request visits. Brokers manage properties, rooms, beds,
leads, visits, assignments and brokerage. The owner's contact details and the
exact address are never exposed to students.

**Stage:** foundation design (schema + API contract) and the first
clickable prototype (`web/`).

## Repository layout

| Path | What it is |
|---|---|
| `docs/requirements.md` | **Product requirements v1.1** (replaces the v1.0 PDF) |
| `docs/srs.md` | **SRS v1.1**: functional, security and data requirements, acceptance criteria |
| `docs/workflow.md` | **Workflow v1.1**: end-to-end flows |
| `docs/ui-ux-spec.md` | **UI/UX spec v1.1**: screens, states, prototype priority |
| `docs/decisions.md` | Decision log (D-01 … D-17) and **open questions** |
| `docs/brokerage.md` | Brokerage policy, overrides, disclosure, payment statuses, credit |
| `docs/broker-allocation.md` | Automatic lead → broker allocation, reassignment, Unassigned Queue |
| `docs/data-model.md` | Entities, privacy boundary, status lists, integrity rules |
| `db/schema.sql` | PostgreSQL 16 reference DDL (source of truth until framework migrations exist) |
| `db/tests/schema_rules_test.sql` | Database-level tests: allocation priority and eligibility, duplicate leads, bed double-booking, brokerage quote/overrides/statuses/credit, student-view privacy |
| `api/openapi.yaml` | OpenAPI 3.1 contract for the web PWA and admin |
| `web/` | Prototype: student marketplace + broker app (see `web/README.md`) |

## Running the schema tests

```bash
createdb brokerage_dev
psql -v ON_ERROR_STOP=1 -d brokerage_dev -f db/schema.sql
psql -v ON_ERROR_STOP=1 -d brokerage_dev -f db/tests/schema_rules_test.sql
# → "All schema rule tests passed." (the test data is rolled back)
```

## Linting the API contract

```bash
npx @redocly/cli@1.34.5 lint api/openapi.yaml
```

## Planned stack (D-13)

One responsive web app installable as a PWA, plus one backend. Default:
Laravel + PostgreSQL with a React/Next.js frontend, pending the implementing
team's confirmation. Flutter is deferred until the product is validated.

## Next step

Prototype step 3: Super Admin (brokerage policies, verification queue,
Unassigned Queue, manual reassignment, waivers/refunds/credit overrides,
audit) and the real backend once the framework is confirmed.
