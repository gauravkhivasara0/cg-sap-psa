# PSA Decision Log: MVP Defaults and Remaining Confirmations

This log separates **recommended MVP defaults** from items that still require trainer, business, security, or BTP landscape confirmation. The defaults are for a learning/prototype implementation, not production approval.

## Agreed working direction

- Build a mock-first PSA MVP; no live external integration is assumed.
- Keep the current working branch `feature/frd-first-cap-foundation`; do not change `main`.
- Do not create or run tests, builds, or runtime checks until the developer has been consulted.
- Keep secrets and real credentials out of source control. Do not use GitHub workflows.

## Recommended MVP defaults

| ID | Topic | Recommended MVP decision | Still needs confirmation before production |
|---|---|---|---|
| DEC-001 | HR source and employee key | Mock HR data. Use a PSA-generated internal UUID for relationships and a separate employee number/external HR ID for future sync. | Actual HR system, external key, sync contract and ownership. |
| DEC-002 | Finance integration | Mock finance adapter; store invoice data in PSA. | Target finance system, API and posting rules. |
| DEC-003 | Invoice PDF storage | Mock document-storage adapter for now. PDF generation/storage can be demonstrated locally or through a mock reference; do not claim SAP DIM integration. | Whether SAP Document Information Extraction/Management or another approved repository is available, and retention/access requirements. |
| DEC-004 | Identity-provider attributes | In mock/development mode, use a controlled server-side demo identity mapping. In production, map trusted identity claims to the PSA employee record; never trust an employee ID supplied by the client. | Exact XSUAA/IAS/IdP claims and mapping, roles, and row-level access configuration. |
| DEC-005 | Manager/employee relationship | Treat a manager as an employee/person with manager permissions; avoid duplicate person records. Use a self-association such as employee.manager. | Trainer/HR confirmation that this model matches the FRD and expected organizational data. |
| DEC-006 | Task actual hours | Count Approved timesheet entries only. Draft, Submitted and Rejected entries do not affect official actuals. Show pending submitted hours separately if useful. | Confirm with business/trainer; this is the selected MVP rule. |
| DEC-007 | Budget consumption | Approved **billable** hours × applicable project/task billing rate. Recalculate after approval/rejection or relevant rate changes. | Confirm whether the FRD expects approved-only hours and which rate takes precedence when rates vary. |
| DEC-008 | Billing types | T&M = approved billable hours × rate; Fixed = configured fixed fee on eligible milestone; Retainer = configured fee per billing period. Do not bill hours twice under Fixed/Retainer. | Contract-specific variations and what milestone makes a fixed fee billable. |
| DEC-009 | Tax, rounding and currency | One currency per project/invoice; no FX conversion in MVP. Store monetary values as decimal values, display two decimal places, and use a configurable tax rate. Keep tax demo-configured until confirmed. | Applicable tax jurisdiction, tax codes, exemptions, inclusive/exclusive pricing, and finance-approved rounding rules. |
| DEC-010 | Invoice number, due date, cancellation, overdue | Generate a unique sequential-looking PSA invoice number using a database-backed counter; due date defaults to 30 days after issue, configurable. Overdue means Issued and unpaid after due date. Allow cancellation of Draft invoices; an Issued invoice should not simply be deleted or silently cancelled. | Required numbering format, credit-note/reversal policy, payment terms and legal rules. |
| DEC-011 | Invoice-to-source traceability | Store invoice lines and a durable mapping from T&M lines to the exact approved timesheet entries they bill. Fixed-fee lines reference the relevant project/milestone. Prevent a source entry from being billed twice. | Confirm desired invoice line grouping and finance-system reconciliation requirements. |
| DEC-012 | Threshold crossing and repeat alerts | Budget: below 75% = Within Budget; 75% to <90% = Warning; 90% to <100% = At Risk; >=100% = Breached. Task burn: alert at 80% and stronger alert at >=100% of estimated hours. Record threshold crossings to prevent duplicates; re-arm after recovery below threshold. | Confirm if the trainer expects budget status At Risk to begin at 80% from an earlier FRD statement; the user’s latest preference is 90%. |
| DEC-013 | Notification channels | Persist in-app notifications. Mock email by recording recipient, subject, body and status; keep a replaceable notification adapter. | Real recipients, email provider, retries, escalation and alert-delivery guarantees. |
| DEC-014 | Tracker integration | “Tracker” means the external task/time-tracking tool mentioned in the FRD; no vendor is named. Start with a documented CSV import format and sample rows, map external task IDs to PSA tasks, report unmapped rows, and use an import key to ignore duplicates. | Actual tracker/vendor, CSV/API schema, source of truth and duplicate-key contract. |
| DEC-015 | BTP service plans | Do not define actual service plans or bindings until the training/BTP subaccount landscape is known. Local/mock development should not require live BTP instances. | Available HANA Cloud, XSUAA, Destination, HTML5 repo, Work Zone, document and notification services/plans. |
| DEC-016 | CI/CD | Defer implementation until the trainer covers SAP Continuous Integration and Delivery. Keep the repository ready for a later pipeline; no GitHub workflows. | Trainer’s preferred pipeline, tenant, credentials and deployment stages. |
| DEC-017 | Audit retention and deletion | No hard-delete for business records that are referenced by timesheets, invoices or audit history. Deactivate employees and other master data instead. Keep audit records append-only and restrict access. | Legal/business retention period, privacy policy, archival and deletion requirements. Do not hard-code a legal period without approval. |
| DEC-018 | Budget boundaries | Use the threshold bands in DEC-012 for the MVP: 75%, 90%, and 100%. | Resolve conflict with any FRD wording that says At Risk begins at 80%; record the final trainer decision. |
| DEC-019 | Foreign exchange | No FX in MVP. Store the currency code on budget/invoice and reject cross-currency calculations unless a conversion rule is later added. | If multi-currency is required: exchange-rate source, date, rate type, and rounding rules. |
| DEC-020 | Code uniqueness | Treat codes as case-insensitive after trimming whitespace for validation, unless the trainer explicitly requires otherwise. Preserve a display value consistently. | Confirm business rules for client, employee, project and external tracker codes. |

## Plain-language explanations

### Invoice-to-time traceability
An invoice must be explainable: for example, “this invoice line billed these 12 approved timesheet entries.” This supports reconciliation and prevents the same time entry from being billed twice. Fixed-fee lines should point to the project/milestone or contract item instead of pretending they came from hourly entries.

### Identity-provider attributes
When a person signs in, the identity provider sends trusted information (claims/attributes) about that account. The app needs a reliable mapping from that signed-in account to the PSA employee record and roles. Exact claim names vary by identity setup, so do not guess them in code before the trainer/BTP configuration is known.

### BTP service instances vs tools
- **SAP HANA Cloud** is the database service.
- **SAP Build Work Zone** is an experience/launchpad service for users.
- **SAP Business Application Studio (BAS)** is a development environment/IDE, not normally a runtime service instance that the deployed app binds to.
- Other runtime services such as XSUAA, Destination, HTML5 Application Repository, and notification/document services depend on the target landscape and available plans.

## Threshold rules (keep separate)

- **Task burn** is hours used versus estimated task hours: 80% alert; 100% stronger alert.
- **Budget consumption** is approved billable value versus budget amount: 75% warning; 90% At Risk; 100% Breached.
- A task can exceed estimated hours without the project budget being breached, and a budget can be at risk even when no individual task has reached 80%.

## Items to confirm with the trainer before production

1. Finalize the 80% vs 90% boundary wording for budget status.
2. Confirm the single-person Employee/Manager model and the signed-in identity mapping.
3. Confirm invoice numbering, payment terms, cancellation/credit-note policy, and tax rules.
4. Confirm retention, privacy and audit policies.
5. Confirm available BTP services/plans and the intended CI/CD approach.
