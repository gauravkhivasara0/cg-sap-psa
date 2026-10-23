# PSA implementation status

Repository: `cg-sap-psa`  
Working branch: `feature/frd-first-cap-foundation`  
Baseline: FRD for Enterprise PSA on SAP BTP CAP + Fiori

## Implemented in this increment (not yet verified by running tools)

- Added the 11 core FRD entities plus ThresholdConfig and AuditLog in `db/schema.cds`.
- Added Admin, Employee, Project, Billing and Portfolio OData service definitions in `srv/psa-services.cds`.
- Declared service actions for timesheet submit/approve/reject, budget recalculation, invoice generation/issue/payment and a burn-summary function.
- Added initial validation and action handlers in `srv/psa-services.js`.
- Added XSUAA role scopes and role templates in `xs-security.json`.
- Added starter Fiori Elements annotations for Projects, Tasks, Timesheets and Invoices.
- Added this implementation-status document.

## Requirement status

| Requirement | Status | Remaining work |
|---|---|---|
| FR-001 | In Progress | Uniqueness, inactive employee enforcement, admin UI and full audit coverage |
| FR-002 | In Progress | Enforce exactly one budget transactionally, unique project code, parent-child validation |
| FR-003 | In Progress | Validate child dates against parent periods; Fiori maintenance flows |
| FR-004 | In Progress | Authorization ownership, full duplicate/day validation, submit locking and roll-up |
| FR-005 | Not Started | CSV/API import adapter, mapping and error report |
| FR-006 | In Progress | Role-safe approval identity, self-approval prevention and notifications |
| FR-007 | In Progress | Automatic roll-up triggers and measured 60-second evidence |
| FR-008 | In Progress | Task burn calculation and Fiori warning/error indicators |
| FR-009 | Not Started | Threshold crossing detection, notification integration and once-per-crossing logic |
| FR-010 | In Progress | Tax configuration/rounding, all billing models and invoice-to-entry reconciliation |
| FR-011 | In Progress | Unique invoice number, transactional duplicate-billing prevention, PDF storage and cancellation/overdue rules |
| FR-012 | In Progress | Row-level restrictions, identity mapping, audit old/new values and security review |

## Open decisions retained from the FRD

1. Confirm HR and finance target systems and authentication in the customer landscape.
2. Define tax rates and rounding rules by jurisdiction/currency; do not hard-code tax assumptions.
3. Keep task-hour burn (80% warning, 100% error) separate from project/budget alerts (75%, 90%, 100%).
4. Budget status is At Risk at >=80%, Breached above 100%, otherwise Within Budget. Alert thresholds are separate.
5. Confirm treatment of rejected timesheet entries in roll-ups; FRD describes task actual hours on Submitted or Approved timesheets.
6. Confirm the supported identity-provider attributes for employee, manager and department row-level restrictions.

## Verification and testing

- No test files have been created and no tests, build, or runtime checks have been run.
- Per user instruction, explain the purpose and impact of proposed testing and obtain consultation before creating or running tests.
- Code is an initial implementation increment and must not be described as validated or production-ready until the agreed checks and environment verification are completed.

## Delivery constraints

- Do not use GitHub workflows.
- Do not store secrets or real external-system credentials in source control.
- Keep the working branch separate from `main` until the user reviews the increment.
