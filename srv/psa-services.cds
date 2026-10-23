using { psa as db } from '../db/schema';

@path: '/admin'
@requires: 'AdminRole'
service AdminService {
  entity Clients       as projection on db.Clients;
  entity Departments   as projection on db.Departments;
  entity Employees     as projection on db.Employees;
  entity Managers      as projection on db.Managers;
  entity ThresholdConfig as projection on db.ThresholdConfig;
  @readonly entity AuditLog as projection on db.AuditLog;
}

@path: '/employee'
@requires: 'EmployeeRole'
service EmployeeService {
  entity MyTimesheets as projection on db.Timesheets;
  entity MyTimesheetEntries as projection on db.TimesheetEntries;
  @readonly entity MyTasks as projection on db.Tasks;
  @readonly entity Projects as projection on db.Projects;
}

@path: '/project'
@requires: 'ManagerRole'
service ProjectService {
  entity Projects as projection on db.Projects;
  entity Budgets as projection on db.Budgets;
  entity Milestones as projection on db.Milestones;
  entity Tasks as projection on db.Tasks;
  entity Timesheets as projection on db.Timesheets;
  @readonly entity TimesheetEntries as projection on db.TimesheetEntries;
  @readonly entity BudgetAlerts as projection on db.Budgets;
}

@path: '/billing'
@requires: 'FinanceRole'
service BillingService {
  entity Invoices as projection on db.Invoices;
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
