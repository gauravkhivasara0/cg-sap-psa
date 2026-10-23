# PSA Entity Mapping and Beginner Guide

This maps FRD concepts to the current CDS draft. It explains intended meaning; it does not claim the schema is complete.

| Entity | What it represents | Main relationships | FRD purpose / open work |
|---|---|---|---|
| Clients | Customer organization | One client has many projects and invoices | Enforce unique client code |
| Departments | Internal organizational unit | Has employees and a department head | Portfolio/utilization and row access |
| Employees | People recording time | Belongs to department, may report to manager, has timesheets | Inactive employee rule and HR identity mapping |
| Managers | Project owners/approvers | Owns projects and approves timesheets | Confirm whether each manager is also an employee |
| Projects | Customer engagement | One client and manager; has budget, milestones, tasks, timesheets and invoices | Unique code, date rules, exactly one budget |
| Budgets | Project financial allowance and consumption | Belongs to one project | Budget, rate, currency and derived status/remaining amount |
| Milestones | Delivery checkpoint | Belongs to project and contains tasks | Dates must be within project period |
| Tasks | Unit of work | Belongs to project and milestone; receives time entries | Estimated hours >0; actual-hours roll-up; To Do/In Progress/Done/Blocked |
| Timesheets | Employee weekly submission for a project | Belongs to employee/project; contains entries; may be approved and invoiced | Draft/Submitted/Approved/Rejected and date/approver validation |
| TimesheetEntries | Hours for a task on a date | Belongs to timesheet and task | 0.25–24 hours; daily sum <=24; no duplicate task/day |
| Invoices | Billing document | Belongs to client/project | Draft/Issued/Paid/Overdue/Cancelled; line-level source traceability missing |
| ThresholdConfig | Configurable alert threshold | Scope is Task or Project | Defaults 75/90/100; crossing/deduplication state missing |
| AuditLog | Append-only business change record | Entity name and record ID reference the changed row | Actor/time/old/new values; full automatic coverage missing |

## How associations work

- Association to one: a record points to one related record. Example: a Project points to one Client.
- Association to many: a record can have multiple related records. Example: a Client has multiple Projects.
- Composition of many: the child is modeled as part of the parent's lifecycle. Current draft uses this for Project→Milestones, Milestone→Tasks and Timesheet→Entries. Confirm deletion/retention rules before allowing destructive operations.
- managed: CAP adds common created/modified timestamps and user fields.
- cuid: CAP adds a generated UUID key.

## Refinements required in the data-model phase

1. Add enums/code lists for billing type, project/task/milestone status, timesheet status, invoice lifecycle and priority.
2. Enforce unique client, employee and project codes, and exactly one budget per project at database/transaction level.
3. Clarify the Manager↔Employee relationship and canonical identity key.
4. Add invoice-line or invoice-to-entry mapping to support reconciliation and prevent double billing.
5. Store alert-crossing/delivery state to avoid repeated notifications.
6. Define currency precision, rounding and tax configuration.
7. Confirm whether task actual hours include Submitted and Approved entries and how rejected entries are treated.
8. Validate milestone/task dates against parent dates and ensure a task's milestone and project are consistent.
9. Model HR external IDs and sync state if HR integration is approved.
10. Define soft-delete/inactivation and audit-retention rules.
