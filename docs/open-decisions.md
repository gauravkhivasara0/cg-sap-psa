# PSA Decision Log: MVP Defaults and Remaining Confirmations

This log separates accepted MVP decisions from items that still require trainer, business, security, or BTP landscape confirmation. These decisions support a learning/prototype implementation; they are not production or legal approval.

## Accepted working direction

- Build the core PSA workflow with mock adapters for HR, finance, and tracker integrations initially, with interfaces that can be replaced by real integrations.
- **Email notifications must be real from the start; do not mock email delivery.** The chosen provider and configuration must be confirmed before implementing the sender.
- Use the SAP BTP services named in the FRD where available. Ask for the subaccount/service configuration when needed; do not invent service plans, endpoints, or credentials.
- Keep working on `feature/frd-first-cap-foundation`; do not change `main`.
- Do not create or run tests, builds, or runtime checks until the developer has been consulted.
- No GitHub workflows. Keep secrets out of source control.

## Accepted MVP decisions

| ID | Topic | MVP decision | Still needs confirmation before production |
|---|---|---|---|
| DEC-001 | HR source and employee key | Mock HR data first. Use a PSA-generated internal UUID for relationships and a separate employee number/external HR ID for future sync. | Actual HR system, external key, sync contract and ownership. |
| DEC-002 | Finance integration | Mock finance adapter initially; store invoice data in PSA. | Target finance system, API and posting rules. |
| DEC-003 | Invoice PDF storage | No permanent PDF repository for MVP. Generate a PDF on demand from stored invoice data and immutable issued-invoice values. | Whether law/business policy requires archiving the exact issued PDF and which repository is approved. |
| DEC-004 | Identity-provider attributes | For local/mock development use a controlled server-side demo identity mapping. Production maps trusted identity claims to the PSA employee and role records. Never trust an employee ID supplied by the client. | Exact XSUAA/identity-provider claims, roles and row-level access configuration. |
| DEC-005 | Manager/employee relationship | Use one Employees entity. A manager is an employee with a manager capability; add `isManager` and a self-association for reporting line as appropriate. Keep authorization roles/permissions separate from the boolean. | Review current CDS references before removing the separate Managers entity. |
| DEC-006 | Task actual hours | Count Approved timesheet entries only. Draft, Submitted and Rejected entries do not affect official task actuals. Pending submitted hours can be shown separately. | No MVP blocker; confirm with trainer if FRD interpretation differs. |
| DEC-007 | Budget consumption | Approved billable hours × applicable billing rate. Recalculate after approval/rejection or relevant rate changes. | Confirm rate precedence if rates vary by task or employee. |
| DEC-008 | Billing types | T&M = approved billable hours × rate; Fixed = configured eligible milestone fee; Retainer = configured fee per billing period. Do not bill hourly entries again under fixed/retainer charges. | Contract-specific variations and fixed-fee milestone eligibility. |
| DEC-009 | Tax, rounding and currency | One currency per project/invoice, no FX in MVP. Use decimal monetary values, display two decimal places, and use a consistent explicit rounding policy. Tax is configurable; do not invent a rate or jurisdiction. | Applicable tax jurisdiction, tax codes, exemptions, inclusive/exclusive pricing and finance-approved rounding. |
| DEC-010 | Invoice number, due date, cancellation, overdue | Invoice format selected: `INV-YYYY-000001`, allocated at issue time with a database-backed serialized counter and a six-digit sequence reset each UTC calendar year. Default due date = 30 days after issue, configurable. Overdue = Issued and unpaid after due date. Draft invoices may be cancelled; do not silently delete or cancel issued invoices. | Finance must confirm UTC calendar-year reset vs legal-entity/fiscal-year/local-time rules, payment terms, reversal/credit-note policy and legal rules. |
| DEC-011 | Invoice-to-source traceability | Persist invoice lines and durable mappings from T&M lines to the exact approved entries billed. Fixed-fee lines reference the relevant project/milestone/contract item. Prevent a source entry from being billed twice. | Desired line grouping and finance reconciliation requirements. |
| DEC-012 | Budget thresholds and task burn | Budget bands are configurable, defaulting to user-selected values: below 75% = Within Budget/no alert; 75% to <90% = Warning; 90% to <100% = At Risk; >=100% = Breached. Task burn is separate: 80% alert and >=100% stronger alert. | No MVP blocker. Preserve these defaults unless the user changes them. |
| DEC-013 | Notifications | Persist in-app notifications. Send real email from the start for relevant approval/rejection, threshold, and invoice events. Use a replaceable provider adapter, delivery status, safe retries, and no secrets in source. | User/trainer must confirm approved SMTP/API provider, sender address, credentials/service binding, recipients, and whether SAP Alert Notification Service is available. |
| DEC-014 | Tracker integration | “Tracker” means the external task/time tool mentioned in the FRD; no vendor is named. Start with CSV import, map external task IDs to PSA tasks, report unmapped rows, and ignore duplicate imports using a stable key. | Actual tracker/vendor, CSV/API schema, source of truth and duplicate-key contract. |
| DEC-015 | BTP service plans | Use FRD services where available, but do not define actual plans/bindings until the BTP subaccount landscape is known. Local development should be possible without live integrations where feasible. | Available HANA Cloud, XSUAA, Destination, HTML5 repo, Work Zone, Alert Notification and other service plans. |
| DEC-016 | CI/CD | Defer implementation until the trainer covers SAP Continuous Integration and Delivery. No GitHub workflows. | Trainer’s preferred pipeline, tenant, credentials and deployment stages. |
| DEC-017 | Audit retention and deletion | Do not hard-delete records referenced by timesheets, invoices or audit history. Deactivate employees and master data instead. Audit is append-only and access-restricted; do not automatically purge until a policy is confirmed. | Legal/business retention duration, privacy policy, archival and deletion requirements. |
| DEC-018 | Budget boundaries | Use DEC-012 thresholds as the accepted MVP rule: 75%, 90%, 100%. | None unless the user or trainer revises it. |
| DEC-019 | Foreign exchange | No FX in MVP. Store currency code on budget/invoice and reject unsupported cross-currency calculations. | If later required: exchange-rate source, date, rate type and rounding rules. |
| DEC-020 | Code uniqueness | Normalize leading/trailing whitespace and compare codes case-insensitively for validation unless a confirmed business rule says otherwise. | Confirm rules for client, employee, project and external tracker codes. |

## Plain-language explanations

### Invoice-to-time traceability
An invoice must be explainable: for example, “this invoice line billed these 12 approved timesheet entries.” This supports reconciliation and prevents the same entry being billed twice. Fixed-fee lines reference the project/milestone or contract item instead of pretending they came from hourly entries.

### Identity-provider attributes
When someone signs in, the identity provider sends trusted information (claims/attributes) about the account. The app needs a reliable mapping from that signed-in account to the PSA employee record and authorization roles. Exact claim names vary by identity setup, so do not guess them before the trainer/BTP configuration is known.

### Invoice PDFs
The database is the source of truth for invoice headers, lines, amounts, status and source references. Generate the PDF on demand from stored invoice data. Preserve the issued invoice's financial and descriptive values as an immutable snapshot so future rate, client or tax changes do not alter a previously issued invoice. Permanent PDF archiving can be added if policy requires it.

### Email provider recommendation
- First choice for an SAP-managed alert workflow: use SAP Alert Notification service for BTP if it is entitled and configured. It can accept custom application events and deliver notifications to configured email actions/subscriptions. It is especially suitable for threshold/operational alerts.
- For application-specific transactional messages (timesheet approval/rejection, invoice notifications), use an approved corporate SMTP relay or an approved transactional email API/provider. Keep it behind a CAP email adapter so the provider can be changed.
- Confirm with the trainer/BTP administrator which option is available. Required setup usually includes provider host/API endpoint, port if SMTP, sender address/domain verification, authentication method, recipient policy, and secret storage via secure environment/service binding. Never commit credentials.
- Deliver real email from the start as requested; do not silently fall back to a mock sender. In local development, use a real approved test mailbox/provider or pause email sending until configuration is supplied, while allowing the rest of the app to run.

### BTP services vs tools
- SAP HANA Cloud is a database service.
- SAP Build Work Zone is an application access/launchpad experience.
- SAP Business Application Studio (BAS) is a development environment, not normally a runtime service instance that the deployed application binds to.
- XSUAA/identity, Destination, HTML5 Application Repository, Alert Notification and document services depend on the actual BTP landscape and available plans.

## Threshold rules (keep separate)

- **Task burn** is hours used versus estimated task hours: alert at 80%; stronger alert at >=100%.
- **Budget consumption** is approved billable value versus budget amount: warning at 75%; At Risk at 90%; Breached at 100%.
- A task can exceed estimated hours without the project budget being breached, and a budget can be at risk while every individual task remains below 80%.

## Items to confirm with the trainer before production

1. Identity-provider claims, roles and row-level access configuration.
2. Approved real email provider and BTP Alert Notification availability/configuration.
3. Invoice numbering, payment terms, cancellation/credit-note policy and tax rules.
4. Audit retention, privacy and deletion policies.
5. Available BTP service plans and CI/CD approach.
6. Whether exact issued PDF archival is required.
