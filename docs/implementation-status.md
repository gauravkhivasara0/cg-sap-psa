# PSA implementation status

Repository: cg-sap-psa  
Working branch: feature/frd-first-cap-foundation  
Baseline: Enterprise PSA FRD and presentation

## Completed in this increment (source/documentation only)

- Added docs/traceability-matrix.md mapping FR-001 through FR-012 and NFR-001 through NFR-006 to current evidence and gaps.
- Added docs/architecture-assessment.md covering target architecture, repository evidence, risks and implementation order.
- Added docs/entity-mapping.md explaining each entity and association in beginner-friendly language.
- Added docs/open-decisions.md with 20 unresolved business, security and landscape decisions.
- Corrected literal newline escape sequences in srv/psa-services.cds so action declarations occupy separate lines.
- Earlier foundation artifacts remain: db/schema.cds, five CAP service declarations, initial handler file, XSUAA role templates and starter Fiori annotations.

## Phase status

| Phase | Status | Notes |
|---|---|---|
| 1. Requirements and design | Completed as a baseline; ongoing updates expected | Traceability, architecture, entity mapping and open decisions documented |
| 2. CAP data model | In progress | Entity draft exists; enums/code lists, database uniqueness, one-budget rule and invoice-source mapping need work |
| 3. CAP services and business logic | In progress / not verified | Initial handlers exist; authorization, transactions, complete roll-ups, alerts, billing and audit need implementation |
| 4. Fiori Elements screens | Not started as complete apps | Starter annotations only; five real screens and manifests/navigation are missing |
| 5. Integrations and deployment | Not started | Integration contracts, MTA and BTP bindings not yet added |
| 6. Testing and acceptance | On hold for consultation | No tests, builds or runtime checks have been created or run |

## Important open questions

See docs/open-decisions.md. In particular, confirm whether budget consumption uses submitted or approved hours; how task actual hours treat rejected entries; fixed/retainer billing rules; tax/rounding; invoice-to-time traceability; identity-provider attributes; and which BTP service instances are available.

## Constraints

- No GitHub workflows.
- Do not store secrets or real external credentials in source control.
- Do not claim the code is verified, tested or production-ready.
- Explain proposed testing types, risks and commands in plain language and consult the user before creating or running tests.
