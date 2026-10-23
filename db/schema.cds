namespace psa;

using { cuid, managed } from '@sap/cds/common';

entity Clients : cuid, managed {
  client_code : String(20) @mandatory;
  client_name : String(100) @mandatory;
  email       : String(254);
  phone       : String(30);
  address     : String(500);
  is_active   : Boolean default true;
  projects    : Association to many Projects on projects.client = $self;
  invoices    : Association to many Invoices on invoices.client = $self;
}

entity Departments : cuid, managed {
  department_name : String(100) @mandatory;
  description     : String(255);
  head            : Association to Managers;
  employees       : Association to many Employees on employees.department = $self;
}

entity Employees : cuid, managed {
  employee_code : String(30) @mandatory;
  full_name     : String(120) @mandatory;
  email         : String(254) @mandatory;
  is_active     : Boolean default true;
  department    : Association to Departments;
  manager       : Association to Managers;
  timesheets    : Association to many Timesheets on timesheets.employee = $self;
}

entity Managers : cuid, managed {
  employee      : Association to one Employees;
  email         : String(254) @mandatory;
  projects      : Association to many Projects on projects.manager = $self;
  approvals     : Association to many Timesheets on approvals.approvedBy = $self;
}

entity Projects : cuid, managed {
  project_code   : String(20) @mandatory;
  project_name   : String(100) @mandatory;
  client         : Association to one Clients @mandatory;
  manager        : Association to one Managers @mandatory;
  billing_type   : String(10) @mandatory; // Fixed, TM, Retainer
  start_date     : Date @mandatory;
  end_date       : Date @mandatory;
  status         : String(20) default 'Active';
  priority       : String(10) default 'Medium';
  planned_hours  : Decimal(10,2);
  consumed_hours : Decimal(10,2) default 0;
  budget         : Association to one Budgets;
  milestones     : Composition of many Milestones on milestones.project = $self;
  tasks          : Association to many Tasks on tasks.project = $self;
  timesheets     : Association to many Timesheets on timesheets.project = $self;
  invoices       : Association to many Invoices on invoices.project = $self;
}

entity Budgets : cuid, managed {
  project        : Association to one Projects @mandatory;
  budget_amt     : Decimal(15,2) @mandatory;
  consumed_amt   : Decimal(15,2) default 0;
  remaining_amt  : Decimal(15,2) default 0;
  billing_rate_hr: Decimal(15,2) @mandatory;
  budget_status  : String(15) default 'Within Budget';
  currency_code  : String(3) @mandatory;
}

entity Milestones : cuid, managed {
  project            : Association to one Projects @mandatory;
  milestone_name     : String(100) @mandatory;
  description        : String(500);
  start_date         : Date @mandatory;
  end_date           : Date @mandatory;
  completion_percent : Decimal(5,2) default 0;
  status             : String(15) default 'Not Started';
  priority           : String(10) default 'Medium';
  tasks              : Composition of many Tasks on tasks.milestone = $self;
}

entity Tasks : cuid, managed {
  project         : Association to one Projects @mandatory;
  milestone       : Association to one Milestones @mandatory;
  task_name       : String(100) @mandatory;
  description     : String(500);
  start_date      : Date @mandatory;
  end_date        : Date @mandatory;
  priority        : String(10) default 'Medium';
  status          : String(15) default 'To Do';
  estimated_hours : Decimal(10,2) @mandatory;
  actual_hours    : Decimal(10,2) default 0;
  timesheetEntries: Association to many TimesheetEntries on timesheetEntries.task = $self;
}

entity Timesheets : cuid, managed {
  employee           : Association to one Employees @mandatory;
  project            : Association to one Projects @mandatory;
  approvedBy         : Association to Managers;
  invoice            : Association to Invoices;
  week_start_date    : Date @mandatory;
  week_end_date      : Date @mandatory;
  total_billable_hours : Decimal(10,2) default 0;
  submitted_date     : Date;
  approved_date      : Date;
  status             : String(10) default 'Draft';
  rejection_reason   : String(255);
  entries            : Composition of many TimesheetEntries on entries.timesheet = $self;
}

entity TimesheetEntries : cuid, managed {
  timesheet   : Association to one Timesheets @mandatory;
  task        : Association to one Tasks @mandatory;
  work_date   : Date @mandatory;
  hours       : Decimal(4,2) @mandatory;
  is_billable : Boolean default true;
  notes       : String(255);
}

entity Invoices : cuid, managed {
  client          : Association to one Clients @mandatory;
  project         : Association to one Projects @mandatory;
  invoice_number  : String(30);
  invoice_date    : Date;
  due_date        : Date;
  billable_hours  : Decimal(10,2) default 0;
  total_amt       : Decimal(15,2) default 0;
  tax_amt         : Decimal(15,2) default 0;
  tax_rate        : Decimal(5,2) default 0;
  currency_code   : String(3) @mandatory;
  payment_status  : String(10) default 'Draft';
  issued_at       : Timestamp;
  paid_at         : Timestamp;
}

entity ThresholdConfig : cuid, managed {
  scope          : String(20) @mandatory; // Task or Project
  threshold_pct  : Decimal(5,2) @mandatory;
  is_active      : Boolean default true;
}

entity AuditLog : cuid {
  entity_name : String(100) @mandatory;
  record_id   : String(36) @mandatory;
  action      : String(20) @mandatory;
  actor       : String(254);
  changed_at  : Timestamp @mandatory;
  old_values  : LargeString;
  new_values  : LargeString;
}
