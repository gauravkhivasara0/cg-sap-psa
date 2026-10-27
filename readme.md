# Enterprise PSA – SAP BTP CAP + Fiori

Minimum functional Professional Services Automation app built from the Team 1 FRD:
CAP (Node.js) OData v4 services, Fiori Elements UIs, a standalone approuter and
XSUAA authentication with five role collections that you assign in the BTP cockpit.

```
Browser ──> psa-approuter (XSUAA login, Fiori apps, /odata proxy)
                │  forwards the user's JWT
                ▼
            psa-srv (CAP, @requires/@restrict per role, row-level filters)
                │
                ▼
            psa-db (HANA Cloud HDI container)
```

## What works

| FRD | Feature | Who |
|---|---|---|
| FR-001 | Maintain clients, departments, employees (unique e-mail / codes); inactive employees cannot log time | Admin |
| FR-002/003 | Create projects with exactly one budget, milestones and tasks (date and hour validation) | Manager |
| FR-004 | Weekly timesheet with daily entries, billable flag, save as draft, submit (≤ 24 h/day, 0.25 h steps, no duplicate task/day) | Employee |
| FR-006 | Approve / reject (reason mandatory); no self-approval; employee notified in-app | Manager |
| FR-007/008/009 | Approval rolls up task hours, milestone completion, project hours and budget (75 / 90 / 100 % thresholds, task burn 80 / 100 %) and raises one in-app alert per threshold | automatic |
| FR-010/011 | Generate invoices for T&M (approved billable hours × rate), Fixed (completed billable milestones) and Retainer (fee per period); never bills a source twice; Draft → Issued (numbered, frozen) → Paid; cancel Draft releases its hours; Overdue derived | Finance |
| FR-012 | Role-based access with row-level restrictions; audit log of all writes (user, time, old/new values) | all |
| – | Department portfolio with budget health | Dept. Head |

Not in this minimum version: e-mail delivery (notifications are stored in-app), PDF/DIM storage,
HR/finance/time-tracker integrations, tax rules (tax is 0 %), Work Zone launchpad.

## Roles and role collections

`xs-security.json` defines one scope per role and creates these role collections on deploy:

| Role collection | CAP role | Fiori apps (tiles on the launchpad) | Data visible |
|---|---|---|---|
| `PSA_Employee` | `EmployeeRole` | My Timesheets | own timesheets only |
| `PSA_Manager` | `ManagerRole` | Approve Timesheets, Manage Projects | projects where the user is the project manager |
| `PSA_Finance` | `FinanceRole` | Billing Workbench | all invoices |
| `PSA_DeptHead` | `DeptHeadRole` | Department Portfolio | projects of managers in the user's department |
| `PSA_Admin` | `AdminRole` | Employees, Clients, Departments | all master data, audit log |

A user can hold several collections. The launchpad only shows tiles for the user's roles,
and every OData call is checked again on the server (`@requires` / `@restrict` in
`srv/psa-services.cds`).

**Link between a BTP user and PSA data:** after login, CAP looks up the `Employee` whose
`email` equals the user's login e-mail (`srv/auth/user-context.js`). Employee, Manager and
Dept. Head screens stay empty until an admin has created that Employee record. Finance
and Admin users do not need one.

## Run locally

```bash
npm install
npx cds watch            # http://localhost:4004/launchpad/index.html
npm test                 # API tests: auth, row-level security, all workflows
```

Locally, authentication is mocked (basic auth, password `pass`):

| User | Roles |
|---|---|
| `alice.admin@example.test` | Admin |
| `morgan.manager@example.test` | Manager, Employee, Dept. Head (manages PRJ-001/002) |
| `casey.lead@example.test` | Manager, Employee, Dept. Head (manages PRJ-003) |
| `taylor.engineer@example.test`, `jordan.consultant@example.test` | Employee |
| `fiona.finance@example.test` | Finance |
| `nobody@example.test` | no role (gets 403 everywhere) |

## Deploy to SAP BTP (Cloud Foundry, trial us10)

Prerequisites: Cloud Foundry space, an SAP HANA Cloud instance that is **running** and mapped
to the space, `cf` CLI with the MultiApps plugin, and the Cloud MTA Build Tool (`npm i -g mbt`).

```bash
cf login -a https://api.cf.us10-001.hana.ondemand.com
mbt build
cf deploy mta_archives/psa_1.0.0.mtar
```

This creates the services `psa-auth` (XSUAA, plan application) and `psa-db` (HDI container), and
the apps `psa-srv`, `psa-db-deployer` (runs once) and `psa-approuter`. Open the approuter
URL printed by `cf apps` (`https://<org>-<space>-psa-approuter.cfapps.us10-001.hana.ondemand.com`).

### Assign roles in the BTP cockpit

1. BTP cockpit → your subaccount → **Security → Users** → select your user (create it with your
   e-mail if needed; identity provider *Default identity provider*).
2. **Assign Role Collection** → choose e.g. `PSA_Admin` (and any of `PSA_Employee`, `PSA_Manager`,
   `PSA_Finance`, `PSA_DeptHead`).
   Alternatively: **Security → Role Collections → PSA_xxx → Edit → Users**.
3. Log out of the app (`Log out` link) and log in again; roles are read at login time.

### First login checklist

1. Give yourself `PSA_Admin`, log in, open **Employees** and create an Employee whose
   **Login E-mail** is exactly your BTP login e-mail (tick *Manager* if you will manage projects).
2. Give yourself `PSA_Employee` / `PSA_Manager` etc., log out and in again. The tiles for those
   roles appear; without a role the launchpad shows a "no PSA role" message and the API returns 403.
3. As manager: **Manage Projects → Create** (fill General, Budget, add a Milestone with Tasks, Save).
   As employee: **My Timesheets → Create** → pick the project, add entries, Save, Submit.
   As manager: **Approve Timesheets** → Approve / Reject. As finance: **Billing Workbench →
   Generate Invoice** → Issue → Mark Paid.

The demo CSV data (in `db/data`) is deployed too. Its users use `@example.test` e-mails, so it
does not grant anything to real users. Re-deploying resets the rows that came from CSV files.

### Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Launchpad says "no PSA role" | No PSA role collection assigned, or you did not log out and in again after assigning it |
| Tiles show but lists are empty, warning "not registered as a PSA employee" | Create an Employee with your exact login e-mail (Admin → Employees) |
| `xsappname` / role-collection name already exists on deploy | Another deployment in the same subaccount uses these role-collection names; rename them in `xs-security.json` |
| Login redirect error (`redirect_uri`) | Your approuter is not under `*.cfapps.us10-001.hana.ondemand.com`; add your URL to `oauth2-configuration.redirect-uris` in `xs-security.json` and redeploy |
| `psa-db-deployer` fails | HANA Cloud instance stopped (trial instances stop nightly) or not mapped to the space |

## Project layout

| Path | Content |
|---|---|
| `db/schema.cds`, `db/data/` | Domain model, code lists, demo data |
| `srv/psa-services.cds` | Services, roles (`@requires`) and row-level rules (`@restrict`) |
| `srv/auth/user-context.js` | Maps the logged-in user to an Employee (`$user.employeeId`, `$user.departmentId`) |
| `srv/<domain>/` | Business logic: `timesheets`, `projects` (roll-up), `billing`, `admin`, `common` (audit, notifications) |
| `app/<app>/` | Fiori Elements apps (annotations + `webapp/`) |
| `app/launchpad/` | Role-based launchpad and the shared header |
| `app/xs-app.json`, `app/package.json` | Standalone approuter |
| `xs-security.json`, `mta.yaml` | XSUAA scopes / role collections, deployment descriptor |
| `test/psa.test.js` | End-to-end API tests |
