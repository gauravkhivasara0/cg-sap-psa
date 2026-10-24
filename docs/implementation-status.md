# PSA implementation status

Repository: cg-sap-psa  
Working branch: feature/frd-first-cap-foundation  
Baseline: Enterprise PSA FRD and presentation

## Completed in this increment (source/documentation only)

- Added docs/traceability-matrix.md mapping FR-001 through FR-012 and NFR-001 through NFR-006 to current evidence and gaps.
- Added docs/architecture-assessment.md covering target architecture, repository evidence, risks and implementation order.
- Updated docs/entity-mapping.md with beginner-friendly entity relationships and recommended MVP rules.
- Updated docs/open-decisions.md to distinguish MVP defaults from items requiring trainer/business/BTP confirmation.
- Corrected literal newline escape sequences in srv/psa-services.cds so action declarations occupy separate lines.
- Earlier foundation artifacts remain: db/schema.cds, five CAP service declarations, initial handler file, XSUAA role templates and starter Fiori annotations.

## Current MVP decisions

- Mock-first integrations: HR, finance, document storage, tracker and email/notification delivery are replaceable mock adapters until real systems are confirmed.
- Task actual hours and budget consumption use Approved timesheet entries only; budget consumption uses approved billable hours × applicable rate.
- Budget bands: below 75% Within Budget; 75% to below 90% Warning; 90% to below 100% At Risk; 100% or above Breached. Task burn is separate: 80% alert and >=100% stronger alert.
- Billing defaults: T&M uses approved billable hours × rate; Fixed uses configured eligible milestone fees; Retainer uses configured period fees. No double-billing hourly entries under fixed/retainer charges.
- Money defaults: one currency per project/invoice, no FX in MVP, decimal amounts with two displayed decimal places, configurable tax with no invented rate.
- Identity design target: one canonical Employee/person record; manager permissions are roles/relationships, not a duplicate person. Production identity claims require trainer/BTP confirmation.
- Invoice source traceability is required in the model; invoice lines must link to approved time entries or to the fixed-fee milestone/contract item they represent.
- Soft-delete/inactivation is preferred for referenced master data; audit is append-only until a retention policy is confirmed.
- CI/CD implementation is deferred until the trainer covers SAP Continuous Integration and Delivery. No GitHub workflows.

## Phase status

| Phase | Status | Notes |
|---|---|---|
| 1. Requirements and design | Completed as a baseline; ongoing updates expected | Traceability, architecture, entity mapping and decision log documented |
| 2. CAP data model | In progress | Need to implement/refine enums, uniqueness, one-budget rule, canonical person model, invoice-source mapping, notifications and monetary fields |
| 3. CAP services and business logic | In progress / not verified | Initial handlers exist; authorization, transactions, complete roll-ups, alerts, billing and audit need implementation |
| 4. Fiori Elements screens | Not started as complete apps | Starter annotations only; five real screens and manifests/navigation are missing |
| 5. Integrations and deployment | Not started | Mock adapters/contracts first; MTA and BTP bindings later when landscape is known |
| 6. Testing and acceptance | On hold for consultation | No tests, builds or runtime checks have been created or run |

## Remaining decisions requiring trainer/business confirmation

See docs/open-decisions.md. Highest priority before production: final budget status boundary (80% vs 90%), actual identity-provider claims and roles, invoice numbering/payment/cancellation/tax rules, audit retention, and available BTP service plans.

## Constraints

- No GitHub workflows.
- Do not store secrets or real external credentials in source control.
- Do not claim the code is verified, tested or production-ready.
- Explain proposed testing types, risks and commands in plain language and consult the user before creating or running tests.
