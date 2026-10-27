# PSA development seed data

These CSV files contain **fictional development-only data** for local CAP development and HANA deployment verification.

## Included scenarios

- Two demo clients, two departments (with heads), and four demo employees (two managers).
- Code lists for billing types, project/milestone/task/timesheet statuses and priorities (required for value helps).
- A Time & Materials (T&M) project, a Fixed-fee project (both managed by Morgan) and a Retainer project (managed by Casey).
- Project budgets, milestones, and tasks.
- One Approved timesheet with three approved billable entries dated 6–8 October 2026. Use the period `2026-10-01` through `2026-10-31` to exercise the current T&M invoice generator.
- One Draft timesheet and entry for a future submit/approval walkthrough.
- Budget and task threshold configuration rows.

## Important safety notes

- Names, addresses, identifiers, and email addresses are fictional. The `.example` and `.example.test` domains are reserved for examples and do not deliver real mail.
- The demo e-mails match the mocked users in `package.json` for local development only. Real BTP users are mapped by creating an Employee with their login e-mail.
- No tax rule is implied by the zero-tax sample context; invoice tax remains an unresolved configuration decision.
- Seed data is not a migration strategy and should not be loaded into a production tenant.
- CAP CSV seed files are loaded by CAP when the relevant database/development setup imports seed data. Confirm the project’s exact deployment process before loading to a shared HANA container.

## Suggested manual walkthrough

See `srv/request.http` and `test/psa.test.js` for the submit → approve → invoice flow with these records.
