# PSA Open-Decision Log

These unresolved items come from the FRD and current source draft. Do not silently choose values that affect business outcomes, security or deployment.

| ID | Decision | Why it matters | Safe interim treatment | Owner / evidence |
|---|---|---|---|---|
| DEC-001 | Which HR system is authoritative and what is the employee key? | Sync and identity mapping | Define a contract only; do not assume SuccessFactors is provisioned | HR / landscape inventory |
| DEC-002 | Which finance system receives issued invoices? | Payload and lifecycle | No live integration claim until confirmed | Finance/architecture |
| DEC-003 | Which document-management service stores invoice PDFs? | API, permissions and retention | Leave adapter unconfigured | BTP administrator |
| DEC-004 | Which identity provider attributes supply employeeId, managerId and departmentId? | Row-level access and approver identity | Deny if identity cannot be resolved; never trust user-supplied identity | Security/BTP |
| DEC-005 | Are Managers also Employees? What is canonical manager ID? | Prevent duplicate person records | Keep separate until confirmed | HR/business |
| DEC-006 | Which timesheet states count toward task actual hours? How are rejected entries treated? | Task burn correctness | Keep status-aware calculation explicit | Product owner |
| DEC-007 | Is budget consumption based on submitted or approved billable hours? | Financial reporting | Do not finalize the basis until approved | Finance/product |
| DEC-008 | How are Fixed and Retainer invoices calculated? | Hourly multiplication only fits some T&M cases | Do not describe draft handler as full billing | Finance/product |
| DEC-009 | What tax jurisdictions, rates, exemptions and rounding rules apply? | Financial/compliance correctness | No hard-coded tax rate | Finance/tax |
| DEC-010 | Invoice numbering, due date, cancellation and overdue rules? | Lifecycle and audit | Do not issue real invoices until defined | Finance |
| DEC-011 | How are invoice lines linked to source time/milestones? | Reconciliation and duplicate-billing prevention | Require durable source mapping before production billing | Finance/product |
| DEC-012 | How do threshold crossing, recovery and repeat alerts work? | Notification volume and semantics | Keep task burn 80/100 separate from alert defaults 75/90/100 | Product owner |
| DEC-013 | Alert recipients, channels, retries and escalation? | Reliable notifications | Contract only until confirmed | Operations/business |
| DEC-014 | Tracker schema, task-ID mapping and duplicate key? | Safe import | Report unmapped rows; do not silently drop them | Tracker owner |
| DEC-015 | Which BTP service plans exist in DEV/QAS/PROD? | Valid MTA resources/bindings | Do not invent services or credentials | BTP administrator |
| DEC-016 | Which SAP CI/CD tenant/pipeline is available? | Pipeline without GitHub workflows | Document intent only | DevOps owner |
| DEC-017 | Audit retention, privacy and deletion rules? | Employee/financial data governance | Restrict audit access; never log secrets | Security/legal |
| DEC-018 | Budget boundary at exactly 80% and 100%? | Consistent status | Draft interpretation: At Risk >=80%, Breached >100% | Product/finance |
| DEC-019 | Currency precision and foreign-exchange behavior? | Accurate monetary calculations | Store currency; no FX without rules | Finance |
| DEC-020 | Are master-data codes case-sensitive for uniqueness? | Duplicate prevention | Normalize only after decision | Master-data owner |

## Distinct threshold rules from the FRD

- Task burn: warning at 80% of estimated task hours; error at 100%.
- Configurable task/project alerts: default thresholds 75%, 90%, 100%, with in-app/email notification once per crossing.
- Budget status: Within Budget below 80%; At Risk at 80% through 100%; Breached above 100%.

These rules are related but not interchangeable.
