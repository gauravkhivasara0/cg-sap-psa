# PSA Entity Mapping and Beginner Guide

This guide describes the intended MVP model. It is a design proposal, not proof that the current CDS schema is complete or validated.

| Entity | What it represents | Main relationships | MVP rules / remaining work |
|---|---|---|---|
| Clients | Customer organization | One client has many projects and invoices | Unique normalized client code; deactivate rather than hard-delete once referenced. |
| Employees | One canonical person record, including people who act as managers | Belongs to a department; may report to another employee; has timesheets; may own/approve projects if authorized | PSA UUID internally; separate employee number/external HR ID; active/inactive state; `isManager` business attribute. |
| Projects | Customer engagement | One client and a manager employee; has budget, milestones, tasks, timesheets and invoices | Unique project code, valid dates, exactly one budget. |
| Budgets | Project financial allowance and consumption | Belongs to one project | Amount > 0; currency code; consumption from approved billable hours × applicable rate; configurable bands defaulting to 75/90/100%. |
| Milestones | Delivery checkpoint | Belongs to project and contains tasks | Dates within project period; fixed-price invoice lines may refer to eligible milestones. |
| Tasks | Unit of work | Belongs to project and optionally a milestone; receives time entries | Estimated hours > 0; actual hours are Approved entries only; alert at 80% and >=100% of estimate. |
| Timesheets | Employee weekly submission for a project | Belongs to employee/project; contains entries; has optional approver and decision timestamps | Draft/Submitted/Approved/Rejected. Rejected hours do not affect actuals or budget. |
| TimesheetEntries | Hours for a task on a date | Belongs to timesheet and task | 0.25–24 hours per entry; date within week; daily sum <=24; no duplicate task/day; approved entry can be billed at most once. |
| Invoices | Billing document and immutable issued financial snapshot | Belongs to client/project; has invoice lines and source mappings | Draft/Issued/Paid/Overdue/Cancelled; durable source references; no hard-delete of issued invoices. PDF generated on demand. |
| InvoiceLines / InvoiceSourceLinks | Invoice charge and the records supporting it | Invoice line maps to approved timesheet entries for T&M or a project/milestone/contract item for fixed-fee billing | Prevent double billing and support reconciliation; exact CDS shape to implement in model phase. |
| ThresholdConfig | Configurable budget/task alert thresholds | Scope is Task or Project | Initialize budget thresholds at 75/90/100 and task burn at 80/100. |
| Notifications | User-facing notification record | Belongs to recipient; may reference project, task, timesheet or invoice | Persist in-app notification; send real email via configured provider from the start; store delivery status. |
| AuditLog | Append-only business change record | Entity name and record ID reference the changed row | Actor/time/old/new values; restrict access; retention period requires policy confirmation. |

## How associations work

- **Association to one:** a record points to one related record. Example: a Project points to one Client.
- **Association to many:** a record can have multiple related records. Example: a Client has multiple Projects.
- **Composition of many:** a child is modeled as part of the parent's lifecycle. Example: a Timesheet contains entries. Do not assume cascading hard deletion is appropriate for invoiced or audited data.
- **managed:** CAP adds common created/modified timestamps and user fields.
- **cuid:** CAP adds a generated UUID key.

## Employee and Manager model

Use one `Employees` entity. A manager is an employee with manager capability, not a duplicate person record.

Recommended fields/relationships:
1. Internal PSA UUID — primary key used for database relationships.
2. Employee number/external HR ID — business/integration key.
3. `isManager` — indicates manager capability in the business model.
4. Self-association such as `manager` — employee's reporting manager, if applicable.
5. Signed-in identity subject mapping — trusted server-side mapping from login to PSA employee.

Keep authorization separate from `isManager`: role checks and row-level access still determine what the person may do. A manager must not automatically see every project, and no user may approve their own timesheet. Exact identity-provider claim names depend on the actual BTP/identity setup and must not be guessed.

## Simple money model

- Store monetary values as decimal values, not binary floating-point calculations.
- Start with one currency per project/invoice and no foreign-exchange conversion.
- Display amounts to two decimal places and apply a consistent rounding rule.
- Keep tax rate/configuration explicit and configurable. Do not assume a rate or jurisdiction in source code.
- A multi-currency extension would need a rate source, rate date/type and rounding policy; it is outside the MVP.

## Invoice data and PDFs

Store invoice header, line items, tax, totals, lifecycle dates/status, payment details and source links in the database. Generate a PDF on demand from the stored values. On issue, freeze the invoice's financial/descriptive values as an immutable snapshot so a later change to rates or master data cannot alter an already-issued invoice. Permanent PDF storage is deferred unless required by policy.

For T&M lines, keep durable links to the exact approved timesheet entries billed and prevent those entries from being billed twice. For fixed-fee lines, link to the project/milestone/contract item. Retainer lines reference the relevant billing period/retainer agreement.

## Email and notifications

Persist in-app notifications and delivery status. Send real email from the start using an approved SMTP relay or transactional email API; SAP Alert Notification service is a candidate for event-based alert delivery if available in the BTP subaccount. Keep the email provider behind an adapter. Do not mock email delivery, and do not commit credentials. If provider configuration is not yet available, leave actual email sending unconfigured and request the necessary details rather than silently using a mock.

## Soft-delete / inactivation and audit retention

Soft-delete means marking a record inactive rather than physically removing its row. For this PSA, prefer inactivation for employees, clients, departments and tasks once they are referenced by historical timesheets or invoices. That preserves history and prevents old invoices losing their customer/task references.

Audit retention is how long change history must be kept before it may be archived or deleted. The safe MVP behavior is append-only audit records with restricted access and no automatic purge. The legally required retention duration must be confirmed; do not invent a legal period.

## Model refinements to implement

1. Replace the separate Managers person entity with the single Employees model after checking references; add `isManager` and a reporting-manager association as appropriate.
2. Add controlled enums/code lists for billing type, project/task/milestone status, timesheet status, invoice lifecycle and priority.
3. Enforce unique client, employee and project codes and exactly one budget per project with appropriate database/transaction constraints.
4. Add invoice lines and source links so T&M entries cannot be billed twice and fixed fees can reference milestones/contract items.
5. Persist notification, email-delivery and threshold-crossing state.
6. Add currency codes and explicit decimal/tax configuration without FX in MVP.
7. Validate milestone/task dates against parent dates and ensure a task's milestone and project are consistent.
8. Define HR external IDs and sync state for later integration; use mock HR data first.
9. Use inactivation rather than destructive deletion for referenced business records.
10. Add audit coverage and access restrictions; keep retention policy pending confirmation.
