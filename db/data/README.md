# PSA development seed data

These CSV files contain **fictional development-only data** for local CAP development and HANA deployment verification.

## Included scenarios

- Two demo clients, two departments, and three demo employees (one manager).
- A Time & Materials (T&M) project with a configured USD hourly rate and a separate Fixed-fee project.
- Project budgets, milestones, and tasks.
- One Approved timesheet with three approved billable entries dated 6–8 October 2026. Use the period `2026-10-01` through `2026-10-31` to exercise the current T&M invoice generator.
- One Draft timesheet and entry for a future submit/approval walkthrough.
- Budget and task threshold configuration rows.

## Important safety notes

- Names, addresses, identifiers, and email addresses are fictional. The `.example` and `.example.test` domains are reserved for examples and do not deliver real mail.
- Do not use these identities as real SAP Identity Provider subjects. Authentication and row-level authorization still require proper configuration and implementation.
- No tax rule is implied by the zero-tax sample context; invoice tax remains an unresolved configuration decision.
- Seed data is not a migration strategy and should not be loaded into a production tenant.
- The project currently implements T&M invoice generation only. Fixed and Retainer sample projects are included for domain exploration, not to imply those invoice generators are complete.
- CAP CSV seed files are loaded by CAP when the relevant database/development setup imports seed data. Confirm the project’s exact deployment process before loading to a shared HANA container.

## Suggested manual walkthrough after you approve checks

1. Read the demo projects and budget values.
2. Generate a T&M draft invoice for project ID `40000000-0000-4000-8000-000000000001`, period `2026-10-01` to `2026-10-31`.
3. Confirm the invoice has 6 billable hours and a provisional subtotal of USD 750.00 (tax configuration is not implemented).
4. Confirm each invoice line has a source link to its corresponding approved timesheet entry.
5. Use the Draft timesheet to explore submission, but do not approve it as the same manager/employee without resolving the current authorization gaps first.

No build, deployment, test, or runtime command has been run as part of adding these seed files.
