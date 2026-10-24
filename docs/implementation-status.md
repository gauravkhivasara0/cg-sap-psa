# PSA implementation status

Repository: cg-sap-psa  
Working branch: feature/frd-first-cap-foundation  
Baseline: Enterprise PSA FRD and presentation

## Accepted MVP decisions

- One Employees entity for each person; manager capability represented by `is_manager` plus authorization roles and a reporting-manager relationship. The separate Managers entity was removed from the model/service projections.
- Task actual hours and budget consumption use Approved timesheet entries only; budget consumption uses approved billable hours × applicable rate.
- Budget thresholds are configurable and default to the user's accepted values: below 75% Within Budget/no alert; 75% to below 90% Warning; 90% to below 100% At Risk; 100% or above Breached. Task burn is separate: 80% alert and >=100% stronger alert.
- Billing defaults: T&M uses approved billable hours × rate; Fixed uses configured eligible milestone fees; Retainer uses configured period fees. Do not double-bill hourly entries under fixed/retainer charges.
- Money defaults: one currency per project/invoice, no FX in MVP, decimal amounts with two displayed decimal places, configurable tax with no invented rate.
- Invoice headers, lines, amounts, lifecycle, payments and source references are represented in the data model. Generate invoice PDFs on demand; preserve issued invoice values so regenerated PDFs do not change historical financial facts.
- Invoice source traceability is required: T&M lines link to approved entries; fixed-fee lines link to eligible milestones/contract items.
- HR, finance and tracker integrations start with mock adapters/contracts that can be replaced. **Email is real from the start, not mocked**, using an approved SMTP relay/API or SAP Alert Notification service where appropriate and available.
- In-app notifications and email delivery state are represented in the model. Budget thresholds are configurable with defaults 75/90/100; task burn thresholds are configurable with defaults 80/100. TODO(CONFIG) comments identify values and provider details still needed.
- Use FRD BTP services where available; ask for subaccount/service configuration when needed. Do not invent service plans, endpoints or credentials.
- Soft-delete/inactivation is preferred for referenced master data; audit is append-only until a retention policy is confirmed.
- CI/CD implementation is deferred until the trainer covers SAP Continuous Integration and Delivery. No GitHub workflows.

## Latest model increment (source changes only)

- Updated `db/schema.cds`: removed the separate Managers entity; added `Employees.is_manager`, reporting-manager association and identity/HR TODOs; added invoice lines/source links, issued-invoice snapshot fields, notifications, configurable threshold fields, and Fixed/Retainer billing configuration fields.
- Updated `srv/psa-services.cds`: removed the Managers projection and exposed invoice-line/source-link and notification projections. Invoice cancellation action is deferred until its handler is implemented.
- Added TODO(CONFIG) comments where real IdP, HR, email, billing-period, and threshold seed configuration is needed.
- These changes have **not** been validated by a CDS build or tests. Do not treat them as verified or production-ready.

## Latest service-logic increment (source changes only)

- Updated `srv/psa-services.js` so budget consumption and task official actual hours are recalculated from Approved timesheet entries only.
- Applied accepted budget status bands: below 75% Within Budget, 75% to below 90% Warning, 90% to below 100% At Risk, and 100% or above Breached.
- Strengthened timesheet-entry validation for hour limits and quarter-hour increments, week boundaries, inactive employees, completed tasks, project/task consistency, duplicate task/date entries, and editable Draft/Rejected timesheet status.
- These source changes have not been validated by a CDS build, tests, or runtime checks. The current handlers still need additional work for secure employee/manager identity mapping, row-level authorization, transactional notification/email delivery, threshold-crossing alerts, and complete invoice line/source-link generation.

## Documentation updated

- `docs/traceability-matrix.md`: maps FR-001 through FR-012 and NFR-001 through NFR-006 to evidence and gaps.
- `docs/architecture-assessment.md`: target architecture, repository evidence, risks and implementation order.
- `docs/entity-mapping.md`: entity relationships and beginner-friendly model decisions.
- `docs/open-decisions.md`: accepted MVP defaults, email provider recommendations and confirmations required.

## Phase status

| Phase | Status | Notes |
|---|---|---|
| 1. Requirements and design | Baseline complete; updates ongoing | Traceability, architecture, entity mapping and decision log documented |
| 2. CAP data model | In progress; first model refinement committed | Single Employees model, invoice lines/source links, notifications, threshold configuration, and invoice snapshot fields added. Controlled enums/code lists, uniqueness constraints, threshold seed data, and model validation remain. No build or tests run. |
| 3. CAP services and business logic | In progress / not verified | Initial handlers exist; authorization, transactions, roll-ups, alerts, real email, billing and audit need implementation |
| 4. Fiori Elements screens | Not started as complete apps | Starter annotations only; five real screens and manifests/navigation are missing |
| 5. Integrations and deployment | Not started | Mock HR/finance/tracker adapters first; real email provider configuration required; MTA and BTP bindings when landscape is known |
| 6. Testing and acceptance | On hold for consultation | No tests, builds or runtime checks have been created or run |

## Email configuration needed before implementation

Please obtain from the trainer/BTP administrator or approved IT team:
- Whether SAP Alert Notification service is entitled/configured in the target subaccount.
- Whether business emails should use that service, a corporate SMTP relay, or an approved transactional email API.
- Sender email address/domain, SMTP host/port and auth method or API endpoint, test recipient(s), and how credentials will be provided securely.
- Whether email should be sent for timesheet submit/approval/rejection, threshold crossings, invoice issue/payment/overdue, and which recipient rules apply.

Do not commit secrets. If provider configuration is not available, do not silently replace real email with a mock sender; request the configuration while continuing independent work.

## Remaining confirmations before production

- Identity-provider claims, roles and row-level access.
- Approved email provider and service configuration.
- Invoice numbering/payment/cancellation/credit-note and tax rules.
- Audit retention, privacy and deletion policies.
- Available BTP service plans and CI/CD approach.
- Whether policy requires exact issued PDF archival.

## Constraints

- No GitHub workflows.
- Do not store secrets or real external credentials in source control.
- Do not claim the code is verified, tested or production-ready.
- Explain proposed testing types, risks and commands in plain language and consult the user before creating or running tests.
