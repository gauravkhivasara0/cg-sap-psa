# PSA Entity Mapping and Beginner Guide

This guide describes the intended MVP model. It is a design proposal, not proof that the current CDS schema is complete or validated.

| Entity | What it represents | Main relationships | MVP rules / remaining work |
|---|---|---|---|
| Clients | Customer organization | One client has many projects and invoices | Unique normalized client code; deactivate rather than hard-delete once referenced. |
| Departments | Internal organizational unit | Has employees and a department head | Used for portfolio/utilization and row-level access. |
| Employees | One canonical person record, including people who act as managers | Belongs to a department; may report to another employee; has timesheets; may own/approve projects if authorized | PSA UUID internally; separate employee number/external HR ID; active/inactive state. |
| Managers | Manager role/capability, not a second copy of the same person | Prefer manager relationship/role on Employees; projects refer to their manager employee | Refine current separate Managers entity into a single-person model after reviewing current CDS references. |
| Projects | Customer engagement | One client and manager employee; has budget, milestones, tasks, timesheets and invoices | Unique project code, valid dates, exactly one budget. |
| Budgets | Project financial allowance and consumption | Belongs to one project | Amount > 0; currency code; consumption from approved billable hours × applicable rate; status bands documented in decision log. |
| Milestones | Delivery checkpoint | Belongs to project and contains tasks | Dates within project period; fixed-price invoice lines may refer to eligible milestones. |
| Tasks | Unit of work | Belongs to project and optionally a milestone; receives time entries | Estimated hours > 0; actual hours are Approved entries only; alert at 80% and >=100% of estimate. |
| Timesheets | Employee weekly submission for a project | Belongs to employee/project; contains entries; has optional approver and decision timestamps | Draft/Submitted/Approved/Rejected. Rejected hours do not affect actuals or budget. |
| TimesheetEntries | Hours for a task on a date | Belongs to timesheet and task | 0.25–24 hours per entry; date within week; daily sum <=24; no duplicate task/day; approved entry can be billed at most once. |
| Invoices | Billing document | Belongs to client/project; has invoice lines and source mappings | Draft/Issued/Paid/Overdue/Cancelled; durable source references; do not hard-delete issued invoices. |
| InvoiceLines / InvoiceSourceLinks | Invoice charge and the records supporting it | Invoice line maps to approved timesheet entries for T&M or a project/milestone/contract item for fixed-fee billing | Prevent double billing and support reconciliation; define exact CDS shape in model phase. |
| ThresholdConfig | Configurable alert threshold | Scope is Task or Project | Defaults and budget status bands are described in the decision log. |
| Notifications | User-facing notification record | Belongs to recipient; may reference project, task, timesheet or invoice | Persist in-app notification; mock email adapter for MVP. |
| AuditLog | Append-only business change record | Entity name and record ID reference the changed row | Actor/time/old/new values; restrict access; retention period requires policy confirmation. |

## How associations work

- **Association to one:** a record points to one related record. Example: a Project points to one Client.
- **Association to many:** a record can have multiple related records. Example: a Client has multiple Projects.
- **Composition of many:** a child is modeled as part of the parent's lifecycle. Example: a Timesheet contains entries. Do not assume cascading hard deletion is appropriate for invoiced or audited data.
- **managed:** CAP adds common created/modified timestamps and user fields.
- **cuid:** CAP adds a generated UUID key.

## Clarifications: Manager, Employee and canonical identity

A canonical identity is the one stable internal person record used throughout the PSA. If the same person is both an employee and a manager, they should not have two independent person IDs. The recommended design is one Employees record with a manager relationship (for reporting) and role/authorization data that allows them to act as a manager.

Keep separate:
1. Internal PSA UUID — primary key for associations.
2. Employee number/external HR ID — business/integration key.
3. Signed-in identity subject — trusted identity-provider identifier mapped server-side to the PSA employee.

This avoids duplicate people and makes it possible to replace the mock identity mapping with real SSO later. Exact identity-provider claim names depend on the actual BTP/identity setup and must not be guessed.

## Simple money model

- Store monetary values as decimal values, not binary floating-point calculations.
- Start with one currency per project/invoice and no foreign-exchange conversion.
- Display amounts to two decimal places; use a consistent rounding rule at line and invoice total calculation points.
- Keep tax rate/configuration explicit and configurable. Do not assume a rate or jurisdiction in source code.
- A multi-currency extension would need a rate source, rate date/type, and rounding policy; it is outside the MVP.

## Soft-delete / inactivation and audit retention

Soft-delete means marking a record inactive rather than physically removing its row. For this PSA, prefer inactivation for employees, clients, departments and tasks once they are referenced by historical timesheets or invoices. That preserves history and prevents old invoices from losing their customer/task references.

Audit retention is how long change history must be kept before it may be archived or deleted. The safe MVP behavior is append-only audit records with restricted access and no automatic purge. The legally required retention duration must be confirmed with the trainer/business owner; do not invent a legal period.

## Model refinements to implement

1. Add controlled enums/code lists for billing type, project/task/milestone status, timesheet status, invoice lifecycle and priority.
2. Enforce unique client, employee and project codes and exactly one budget per project with appropriate database/transaction constraints.
3. Review and simplify the current Manager/Employee model to one canonical person.
4. Add invoice lines and source links so T&M entries cannot be billed twice and fixed fees can reference milestones/contract items.
5. Persist notification and threshold-crossing/delivery state.
6. Add currency codes and explicit decimal/tax configuration without FX in MVP.
7. Validate milestone/task dates against parent dates and ensure a task's milestone and project are consistent.
8. Define HR external IDs and sync state for later integration; use mock data first.
9. Use inactivation rather than destructive deletion for referenced business records.
10. Add audit coverage and access restrictions; keep retention policy configurable/pending confirmation.
