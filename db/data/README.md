# PSA development seed data

These CSV files contain **fictional development-only data** for local CAP development and HANA deployment verification.

## Included scenarios

Every table has data:

| Table | Rows | Highlights |
|---|---|---|
| Code lists (billing types, statuses, priorities) | 3–5 each | Needed for the Fiori value helps |
| Clients | 4 | One inactive (CL-004) |
| Departments | 3 | Engineering, Consulting, Finance, each with a head |
| Employees | 7 | Two managers, one inactive employee (Sam Former), Fiona Finance |
| Projects / Budgets | 3 / 3 | T&M PRJ-001 and Fixed PRJ-002 (Morgan), Retainer PRJ-003 (Casey) |
| Milestones / Tasks | 3 / 4 | One completed milestone, one Done task |
| Timesheets / Entries | 6 / 11 | Every status: Draft, Submitted, Approved, Rejected, Invoiced |
| Invoices / Lines / Source links | 3 / 4 / 4 | INV-2026-0001 Paid (T&M, September), INV-2026-0002 issued and past due (shown as Overdue), October retainer Draft |
| ThresholdConfig | 5 | Budget 75/90/100 %, task burn 80/100 % |
| Notifications | 5 | Approval / rejection / submission notices |
| AuditLog | 7 | Submit, approve, reject, invoice generate/issue/pay, employee deactivation |

Budget and hour figures match the approved and invoiced entries (PRJ-001: 15 h, USD 1,625 consumed;
PRJ-003: 6 h, USD 900 consumed). Generate a T&M invoice for PRJ-001 for `2026-10-01`–`2026-10-31`
to bill the 6 approved October hours (USD 750).

## Important safety notes

- Names, addresses, identifiers, and email addresses are fictional. The `.example` and `.example.test` domains are reserved for examples and do not deliver real mail.
- The demo e-mails match the mocked users in `package.json` for local development only. Real BTP users are mapped by creating an Employee with their login e-mail.
- No tax rule is implied by the zero-tax sample context; invoice tax remains an unresolved configuration decision.
- Seed data is not a migration strategy and should not be loaded into a production tenant.
- CAP CSV seed files are loaded by CAP when the relevant database/development setup imports seed data. Confirm the project’s exact deployment process before loading to a shared HANA container.

## Suggested manual walkthrough

See `srv/request.http` and `test/psa.test.js` for the submit → approve → invoice flow with these records.
