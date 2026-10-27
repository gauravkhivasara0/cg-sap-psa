using { psa as db } from '../db/schema';

// ---------------------------------------------------------------------------
// Authorization model
//   XSUAA scopes (xs-security.json)  ->  CAP roles used below
//   EmployeeRole | ManagerRole | FinanceRole | DeptHeadRole | AdminRole
//
// Row-level restrictions use user attributes filled by srv/auth/user-context.js,
// which maps the logged-in user (XSUAA e-mail / user name) to an Employee:
//   $user.employeeId   -> Employees.ID of the logged-in user
//   $user.departmentId -> that employee's department
// ---------------------------------------------------------------------------

/** Who am I? Used by the launchpad to show tiles for the user's roles. */
@path: 'user'
@requires: 'authenticated-user'
service UserService {
  type UserInfo {
    id           : String;
    email        : String;
    name         : String;
    employeeId   : UUID;
    departmentId : UUID;
    isManager    : Boolean;
    roles        : many String;
  }
  function me() returns UserInfo;
}

@path: 'employee'
@requires: 'EmployeeRole'
service EmployeeService {
  @odata.draft.enabled
  @restrict: [{ grant: '*', to: 'EmployeeRole', where: 'employee_ID = $user.employeeId' }]
  entity MyTimesheets as projection on db.Timesheets {
    *,
    entries : redirected to MyTimesheetEntries
  } excluding { approvedBy } actions {
    action submitTimesheet() returns MyTimesheets;
  };

  @restrict: [{ grant: '*', to: 'EmployeeRole', where: 'timesheet.employee_ID = $user.employeeId' }]
  entity MyTimesheetEntries as projection on db.TimesheetEntries;

  // No assignment entity exists yet, so employees may book on tasks of Active projects.
  @readonly entity MyTasks as projection on db.Tasks where project.status = 'Active';
  @readonly entity Projects as projection on db.Projects where status = 'Active';

  @readonly
  @restrict: [{ grant: 'READ', to: 'EmployeeRole', where: 'recipient_ID = $user.employeeId' }]
  entity MyNotifications as projection on db.Notifications;
}

@path: 'project'
@requires: 'ManagerRole'
service ProjectService {
  @odata.draft.enabled
  @restrict: [{ grant: '*', to: 'ManagerRole', where: 'manager_ID = $user.employeeId' }]
  entity Projects as projection on db.Projects actions {
    action recalculateBudget() returns Projects;
  };

  @restrict: [{ grant: '*', to: 'ManagerRole', where: 'project.manager_ID = $user.employeeId' }]
  entity Budgets as projection on db.Budgets;
  @restrict: [{ grant: '*', to: 'ManagerRole', where: 'project.manager_ID = $user.employeeId' }]
  entity Milestones as projection on db.Milestones;
  @restrict: [{ grant: '*', to: 'ManagerRole', where: 'milestone.project.manager_ID = $user.employeeId' }]
  entity Tasks as projection on db.Tasks;

  // Approval worklist: timesheets of the manager's own projects.
  @readonly
  @restrict: [{ grant: ['READ', 'approveTimesheet', 'rejectTimesheet'], to: 'ManagerRole', where: 'project.manager_ID = $user.employeeId' }]
  entity Timesheets as projection on db.Timesheets where status != 'Draft' actions {
    action approveTimesheet() returns Timesheets;
    action rejectTimesheet(reason : String(255) @mandatory) returns Timesheets;
  };
  @readonly
  @restrict: [{ grant: 'READ', to: 'ManagerRole', where: 'timesheet.project.manager_ID = $user.employeeId' }]
  entity TimesheetEntries as projection on db.TimesheetEntries;

  @readonly
  @restrict: [{ grant: 'READ', to: 'ManagerRole', where: 'project.manager_ID = $user.employeeId' }]
  @cds.redirection.target: false
  entity BudgetAlerts as projection on db.Budgets where budget_status != 'Within Budget';

  @readonly
  @restrict: [{ grant: 'READ', to: 'ManagerRole', where: 'recipient_ID = $user.employeeId' }]
  entity Notifications as projection on db.Notifications;

  // Value helps
  @readonly entity Clients as projection on db.Clients where is_active = true;
  @readonly entity Employees as projection on db.Employees;
  @readonly entity BillingTypes as projection on db.BillingTypes;
  @readonly entity ProjectStatuses as projection on db.ProjectStatuses;
  @readonly entity TaskStatuses as projection on db.TaskStatuses;
  @readonly entity Priorities as projection on db.Priorities;

  type BurnSummary {
    projectID        : UUID;
    budget_amt       : Decimal(15, 2);
    consumed_amt     : Decimal(15, 2);
    remaining_amt    : Decimal(15, 2);
    consumed_pct     : Decimal(7, 2);
    planned_hours    : Decimal(10, 2);
    consumed_hours   : Decimal(10, 2);
    budget_status    : String(15);
    currency_code    : String(3);
  }
  function getBurnSummary(projectID : UUID) returns BurnSummary;
}

@path: 'billing'
@requires: 'FinanceRole'
service BillingService {
  @readonly // created via generateInvoice, changed via actions only
  entity Invoices as projection on db.Invoices actions {
    action issueInvoice() returns Invoices;
    action markInvoicePaid(paymentDate : Date @mandatory) returns Invoices;
    action cancelInvoice(reason : String(255) @mandatory) returns Invoices;
  };
  @readonly entity InvoiceLines as projection on db.InvoiceLines;
  @readonly entity InvoiceSourceLinks as projection on db.InvoiceSourceLinks;

  action generateInvoice(projectID : UUID @mandatory, periodFrom : Date @mandatory, periodTo : Date @mandatory) returns Invoices;

  @readonly entity Clients as projection on db.Clients;
  @readonly entity Projects as projection on db.Projects;
  @readonly entity Timesheets as projection on db.Timesheets where status in ('Approved', 'Invoiced');
  @readonly entity TimesheetEntries as projection on db.TimesheetEntries;
}

@path: 'portfolio'
@requires: 'DeptHeadRole'
service PortfolioService {
  @readonly
  @restrict: [{ grant: 'READ', to: 'DeptHeadRole', where: 'manager.department_ID = $user.departmentId' }]
  entity Projects as projection on db.Projects;
  @readonly
  @restrict: [{ grant: 'READ', to: 'DeptHeadRole', where: 'project.manager.department_ID = $user.departmentId' }]
  entity Budgets as projection on db.Budgets;
  @readonly
  @restrict: [{ grant: 'READ', to: 'DeptHeadRole', where: 'department_ID = $user.departmentId' }]
  entity Employees as projection on db.Employees;
  @readonly entity Clients as projection on db.Clients;
}

@path: 'admin'
@requires: 'AdminRole'
service AdminService {
  @odata.draft.enabled entity Clients as projection on db.Clients;
  @odata.draft.enabled entity Departments as projection on db.Departments;
  @odata.draft.enabled entity Employees as projection on db.Employees;
  entity ThresholdConfig as projection on db.ThresholdConfig;
  @readonly entity AuditLog as projection on db.AuditLog;
  @readonly entity Notifications as projection on db.Notifications;
}
