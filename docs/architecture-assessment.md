# PSA Architecture Assessment

## Target architecture from the FRD

- UI: SAP Fiori Elements using Analytical List Page, List Report and Object Page patterns, hosted through SAP HTML5 Application Repository / SAP Build Work Zone.
- Application: SAP CAP Node.js and OData V4 services.
- Persistence: SAP HANA Cloud for business entities, workflow state and audit records.
- Identity: XSUAA, SSO as supported by the actual identity provider, role collections and server-side row restrictions.
- Integrations: Destination service for HR, finance, tracker, document storage and notification endpoints once actual products and endpoints are confirmed.
- Deployment: Cloud Foundry, MTA descriptor and service bindings; DEV/QAS/PROD spaces; SAP Continuous Integration and Delivery if available. No GitHub workflows.
- Observability: application logging, controlled business audit trail, operational alerts and correlation IDs.

## Current repository evidence

| Area | Evidence | Assessment |
|---|---|---|
| CAP runtime | package.json includes @sap/cds, @cap-js/hana, @sap/xssec | Starting dependencies; runtime not verified |
| Persistence | db/schema.cds added | Core draft exists; constraints, code lists and computed fields need refinement |
| OData | srv/psa-services.cds added | Five service boundaries declared; source needs correction/verification |
| Handlers | srv/psa-services.js added | Early handlers exist; correctness and service binding unverified |
| Security | xs-security.json role scopes/templates | Identity attributes and role collection assignments remain environment-specific |
| Fiori | app/psa-manager/annotations.cds | Annotations only; no complete app manifests or five screens |
| MTA | No mta.yaml found on branch at inspection | Deployment config absent |
| Integrations | No adapters/destinations configured | Not implemented; endpoints/credentials not supplied |
| CI/CD | No pipeline config | Not implemented; GitHub workflows prohibited |
| Tests | None created or run by this work | On hold pending user consultation |

## Key risks and controls

1. Service implementation binding must match CAP service instances and action declarations. Handler files may need separation or explicit registration; verify only after the user agrees to verification.
2. @requires controls role-level access, not per-row visibility. Add @restrict and handler checks based on confirmed identity attributes.
3. Workflow operations need transactions and concurrency-safe duplicate prevention.
4. Avoid per-entry query loops for roll-ups. Use database aggregation, suitable indexes and event/scheduled recalculation to target the 60-second requirement.
5. Add durable invoice-line/source-entry mapping so overlapping invoice requests cannot bill the same hours twice.
6. Tax, fixed-fee and retainer rules must be configured from approved business rules, not guessed.
7. PDF storage and notifications depend on actual provisioned SAP services and tenant configuration.
8. Audit must capture actor, timestamp and old/new values while avoiding secrets and controlling access.
9. MTA modules, HANA deployer, XSUAA, destinations and HTML5 content require confirmation of service plans and spaces.

## Accepted code organization

- Backend logic is organized by business domain directly under `srv/<domain>/` (for example, `srv/billing/`, `srv/timesheets/`, and `srv/projects/`), with simple modules and gradual migration one domain at a time. A separate `srv/lib/` layer is not required.
- CAP contracts remain in `srv/psa-services.cds`; the main handler wires modules together while domain-specific rules move out incrementally.
- Fiori apps remain separate under `app/`; implementation priority is backend first.
- Billing is the current extraction target. See `docs/billing-domain.md` for current module ownership and remaining finance decisions.

## Recommended order

1. Requirements mapping and business decisions.
2. Refine CDS entities, enums/code lists, uniqueness and relationships.
3. Align service definitions and handler registration; implement validation and authorization.
4. Implement roll-ups, threshold notifications, invoice traceability and audit.
5. Build the five Fiori Elements screens against actual OData metadata.
6. Add integration contracts and MTA deployment assets based on confirmed BTP landscape.
7. Explain test categories, risks and commands; obtain user agreement before creating or running tests.

## Explicit non-goals until confirmed

Do not assume SuccessFactors, S/4HANA, document management, Alert Notification or a particular identity provider is provisioned. Do not store credentials in source control or describe a contract/mock as a live integration. Do not test, build or deploy without consultation.
