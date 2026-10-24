using { psa as db } from '../db/schema';

@path: '/admin'
@requires: 'AdminRole'
service AdminService {
  entity Clients as projection on db.Clients;
  entity Departments as projection on db.Departments;
  entity Employees as projection on db.Employees;
  entity ThresholdConfig as projection on db.ThresholdConfig;
  @readonly entity AuditLog as projection on db.AuditLog;
  @readonly entity Notifications as projection on db.Notifications;
}

@path: '/employee'
@requires: 'EmployeeRole'
service EmployeeService {
  entity MyTimesheets as projection on db.Timesheets;
  action submitTimesheet(timesheetID: UUID);
  entity MyTimesheetEntries as projection on db.TimesheetEntries;
  @readonly entity MyTasks as projection on db.Tasks;
  @readonly entity Projects as projection on db.Projects;
  @readonly entity MyNotifications as projection on db.Notifications;
}

@path: '/project'
@requires: 'ManagerRole'
service ProjectService {
  entity Projects as projection on db.Projects;
  @cds.redirection.target: true
  entity Budgets as projection on db.Budgets;
  entity Milestones as projection on db.Milestones;
  entity Tasks as projection on db.Tasks;
  entity Timesheets as projection on db.Timesheets;
  action approveTimesheet(timesheetID: UUID);
  action rejectTimesheet(timesheetID: UUID, reason: String(255));
  action recalculateBudget(budgetID: UUID);
  function getBurnSummary(projectID: UUID) returns LargeString;
  @readonly entity TimesheetEntries as projection on db.TimesheetEntries;
  @readonly @cds.redirection.target: false entity BudgetAlerts as projection on db.Budgets;
  @readonly entity Notifications as projection on db.Notifications;
}

@path: '/billing'
@requires: 'FinanceRole'
service BillingService {
  entity Invoices as projection on db.Invoices;
  entity InvoiceLines as projection on db.InvoiceLines;
  entity InvoiceSourceLinks as projection on db.InvoiceSourceLinks;
  action generateInvoice(projectID: UUID, periodFrom: Date, periodTo: Date) returns UUID;
  action issueInvoice(invoiceID: UUID);
  action markInvoicePaid(invoiceID: UUID, paymentDate: Date);
  entity Clients as projection on db.Clients;
  @readonly entity Projects as projection on db.Projects;
  @readonly entity Timesheets as projection on db.Timesheets;
}

@path: '/portfolio'
@requires: 'DeptHeadRole'
service PortfolioService {
  @readonly entity Projects as projection on db.Projects;
  @readonly entity Budgets as projection on db.Budgets;
  @readonly entity Employees as projection on db.Employees;
}
