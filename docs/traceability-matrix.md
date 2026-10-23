# PSA FRD Traceability Matrix

Baseline: Enterprise PSA FRD and presentation supplied for this project. This is source/design inspection only; no tests, builds or runtime checks have been run.

Status meanings: Partial means a source artifact exists but the requirement is incomplete. Not started means no implementation evidence exists yet. Decision needed means a business or landscape answer is required.

| ID | Requirement / acceptance intent | Priority | Entities | Backend / service | Fiori interaction | Authorization | Status / gap |
|---|---|---|---|---|---|---|---|
| FR-001 | Maintain client, department, employee, manager and code-list data; enforce uniqueness; inactive employees cannot log time | Critical | Clients, Departments, Employees, Managers | AdminService exists; uniqueness and active-employee enforcement remain | Admin master-data app absent | AdminRole; reject inactive employee time | Partial |
| FR-002 | Create project for client; unique project code; exactly one budget; positive budget; valid dates | Critical | Projects, Budgets, Clients, Managers | Basic project/budget validation started; unique code and one-budget transaction missing | Project create/object page incomplete | ManagerRole plus project row restriction | Partial |
| FR-003 | Milestones/tasks with dates inside parent period and positive estimated hours | Critical | Milestones, Tasks, Projects | Basic date-order/estimate checks; parent-period checks missing | Project detail facets incomplete | ManagerRole/project restriction | Partial |
| FR-004 | Daily task time, billable flag, weekly draft/submit; daily total <=24; submitted entries lock | Critical | Timesheets, TimesheetEntries, Tasks, Employees | Submit and entry checks started; duplicate task/day, ownership and robust lock checks missing | Weekly timesheet grid absent | EmployeeRole and employee-row restriction | Partial |
| FR-005 | Tracker CSV/API import; report unmapped rows and ignore duplicates | High | Tasks, Timesheets, TimesheetEntries | No import adapter | Import feedback absent | Integration identity/access TBD | Not started |
| FR-006 | Manager approves/rejects; reason mandatory; record approver/date; notify employee | Critical | Timesheets, Employees, Managers, AuditLog | Actions started; identity mapping, self-approval prevention and notifications missing | Approval screen absent | ManagerRole; only authorized projects; no self-approval | Partial |
| FR-007 | Budget consumption updates dynamically and dashboard reflects change within 60 seconds | Critical | Budgets, Timesheets, TimesheetEntries | Manual recalculation started; automatic roll-up and evidence missing | Manager KPIs incomplete | Manager row restriction | Partial |
| FR-008 | Task burn warning at 80%, error at 100% of estimate | Critical | Tasks, TimesheetEntries | Full task-burn calculation absent | Indicators absent | Manager visibility | Not started |
| FR-009 | Configurable task/project alerts at 75%, 90%, 100%; in-app/email once per crossing | Critical | ThresholdConfig, Budgets, Tasks, AuditLog | Config entity exists; crossing detection/deduplication/notifications missing | Alert UI absent | Role-appropriate visibility | Partial |
| FR-010 | Finance invoices for Fixed/T&M/Retainer; totals reconcile to approved time; tax configured | Critical | Invoices, Timesheets, TimesheetEntries, Projects, Budgets | Basic billable-hours draft invoice only; other billing models/tax/reconciliation incomplete | Billing Workbench absent | FinanceRole; approved time read-only | Partial |
| FR-011 | Draft/Issued/Paid/Overdue/Cancelled lifecycle; PDF storage; no double billing; invoiced time locked | High | Invoices, Timesheets, TimesheetEntries | Basic issue/pay handlers; numbering, overdue/cancel, PDF, duplicate prevention and locks missing | Invoice lifecycle UI absent | FinanceRole; server-side state rules required | Partial |
| FR-012 | Role access, row restrictions and audit actor/time/old/new; finance cannot edit approved time | Critical | All business entities, AuditLog | Role templates and some audit calls exist; row restrictions and complete audit missing | Role-aware navigation incomplete | XSUAA + confirmed identity attributes | Partial |
| NFR-001 | Dashboard/list p95 load under 3 seconds | NFR | Projects, Budgets, planned views | No evidence | Query/KPI optimization pending | Relevant roles | Not started |
| NFR-002 | Support 300 concurrent users | NFR | All | Capacity not validated | N/A | N/A | Not started |
| NFR-003 | 99.5% business-hours availability | NFR | Platform | Monitoring/operations not configured | N/A | N/A | Not started |
| NFR-004 | 500 employees, 5,000 projects, 2 million time entries | NFR | Employees, Projects, TimesheetEntries | Index/query/volume evidence absent | N/A | N/A | Not started |
| NFR-005 | Roll-up within 60 seconds | NFR | Budgets, Tasks, TimesheetEntries | Automatic refresh and evidence absent | Refresh behavior pending | N/A | Not started |
| NFR-006 | Git-based pipeline via SAP CI/CD; no GitHub workflows | NFR | Deployment assets | MTA/pipeline absent | Deployment pipeline absent | BTP permissions needed | Not started |

## Required Fiori screens

| Screen | FRD intent | Current evidence | Gap |
|---|---|---|---|
| Manager Home | Analytical List Page, KPI cards, project table, drilldown | Project annotations only | KPI data, manifest, navigation and real services |
| Project Detail | Object Page with project, budget, milestones/tasks, timesheets, invoices | Starter annotations | Complete facets, actions, associations and restrictions |
| My Timesheet | Weekly task/day grid, billable toggle, Save Draft, Submit | Service/action declarations | UI app and interactions |
| Timesheet Approvals | Employee/project/week filters; approve/reject reason | Action declarations | List Report/Object Page, dialog and notifications |
| Billing Workbench | KPIs and Generate/Issue/Mark Paid | Action declarations | UI, tax/billing rules, PDF and integration |

An entity, action signature or annotation alone is not completion evidence. Mark a requirement complete only after implementation and agreed verification with observable evidence.
