# Student Rental Brokerage Platform

A student marketplace and broker CRM for managing student rental homes.
Students browse and request visits. Brokers manage properties, rooms, beds,
leads, visits, assignments and brokerage. The owner's contact details and the
exact address are never exposed to students.

**Stage:** foundation design (database schema + API contract). No
application code yet.

## Repository layout

| Path | What it is |
|---|---|
| `docs/decisions.md` | Decision log. Overrides the v1.0 PDFs where they differ; lists open questions |
| `docs/data-model.md` | Entities, privacy boundary, status lists, integrity rules |
| `docs/broker-allocation.md` | Automatic lead → broker allocation, reassignment, Unassigned Queue |
| `db/schema.sql` | PostgreSQL 16 reference DDL (source of truth until framework migrations exist) |
| `db/tests/schema_rules_test.sql` | Database-level tests: allocation priority, eligibility, duplicate leads, bed double-booking, student-view privacy |
| `api/openapi.yaml` | OpenAPI 3.1 contract for the web PWA and admin |

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

Prototype: Student Marketplace → Property Detail → Request Visit, built on
this schema and contract.
