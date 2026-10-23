# PSA implementation status

Repository: `cg-sap-psa`  
Baseline: FRD for Enterprise PSA on SAP BTP CAP + Fiori  
Status: foundational data model and service contracts added; not yet verified by running tools.

## Current increment

- Added the 11 core FRD entities plus ThresholdConfig and AuditLog in `db/schema.cds`.
- Added Admin, Employee, Project, Billing and Portfolio OData V4 service definitions in `srv/psa-services.cds`.
- Added role-level service boundaries; row-level restrictions and business action handlers are still pending.
- No tests have been created or run. Testing requires user consultation first, as requested.

## Requirement status

| Requirement | Status | Remaining work |
|---|---|---|
| FR-001 | In Progress | Uniqueness, active employee rules, admin UI |
| FR-002 | In Progress | Project/budget transaction rules, date validation |
| FR-003 | In Progress | Milestone/task date and estimate validation |
| FR-004 | In Progress | Entry validation, weekly submit action and locking |
| FR-005 | Not Started | CSV/API import adapter and row-level error report |
| FR-006 | Not Started | Approve/reject actions, separation of duties, notifications |
| FR-007 | Not Started | Authoritative roll-up implementation and 60-second evidence |
| FR-008 | Not Started | Task burn indicators in service/UI |
| FR-009 | Not Started | Threshold crossing detection and notifications |
| FR-010 | Not Started | Billing calculation rules, tax configuration and invoice generation |
| FR-011 | Not Started | Invoice state transitions, PDF storage and duplicate billing protection |
| FR-012 | In Progress | Role declarations, row-level restrictions and audit writes |

## Open decisions retained from the FRD

1. Confirm HR and finance target systems and authentication in the customer landscape.
2. Define tax rates and rounding rules by jurisdiction/currency; do not hard-code tax assumptions.
3. Keep task-hour burn (80% warning, 100% error) separate from project/budget alerts (75%, 90%, 100%).
4. The budget status rule is At Risk at >=80%, Breached above 100%, otherwise Within Budget. Alert thresholds are separate.
5. Confirm whether rejected timesheet entries continue to count toward task actual hours; the FRD describes roll-ups on Submitted or Approved timesheets, so status-aware aggregation is required.

## Safety and delivery constraints

- Do not use GitHub workflows.
- Do not claim code is tested until the user has been consulted and the agreed checks have been run.
- Do not store secrets or real external-system credentials in source control.
