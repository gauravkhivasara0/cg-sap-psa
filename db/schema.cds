namespace psa;
using { cuid, managed } from '@sap/cds/common';

entity Clients : cuid, managed {
  client_code : String(20) @mandatory;
  client_name : String(100) @mandatory;
  email : String(254);
  phone : String(30);
  address : String(500);
  is_active : Boolean default true;
  projects : Association to many Projects on projects.client = $self;
  invoices : Association to many Invoices on invoices.client = $self;
}
entity Departments : cuid, managed {
  department_code : String(20);
  department_name : String(100) @mandatory;
  description : String(255);
  head : Association to Employees;
  employees : Association to many Employees on employees.department = $self;
}
entity Employees : cuid, managed {
  employee_code : String(30) @mandatory;
  external_hr_id : String(100); // TODO(CONFIG): map to authoritative HR employee key.
  identity_subject : String(255); // TODO(CONFIG): map trusted IdP subject server-side; never accept from client.
  full_name : String(120) @mandatory;
  email : String(254) @mandatory;
  is_manager : Boolean default false;
  is_active : Boolean default true;
  department : Association to Departments;
  manager : Association to Employees;
  timesheets : Association to many Timesheets on timesheets.employee = $self;
  managed_projects : Association to many Projects on managed_projects.manager = $self;
  approvals : Association to many Timesheets on approvals.approvedBy = $self;
}
entity Projects : cuid, managed {
  project_code : String(20) @mandatory;
  project_name : String(100) @mandatory;
  client : Association to one Clients @mandatory;
  manager : Association to one Employees @mandatory;
  billing_type : String(10) @mandatory; // TODO: controlled enum/code list in next model pass.
  start_date : Date @mandatory;
  end_date : Date @mandatory;
  status : String(20) default 'Active';
  priority : String(10) default 'Medium';
  planned_hours : Decimal(10,2);
  consumed_hours : Decimal(10,2) default 0;
  fixed_fee_amt : Decimal(15,2);
  retainer_fee_amt : Decimal(15,2);
  retainer_period : String(20); // TODO(CONFIG): confirm allowed billing periods.
  budget : Association to one Budgets;
  milestones : Composition of many Milestones on milestones.project = $self;
  tasks : Association to many Tasks on tasks.project = $self;
  timesheets : Association to many Timesheets on timesheets.project = $self;
  invoices : Association to many Invoices on invoices.project = $self;
}
entity Budgets : cuid, managed {
  project : Association to one Projects @mandatory;
  budget_amt : Decimal(15,2) @mandatory;
  consumed_amt : Decimal(15,2) default 0;
  remaining_amt : Decimal(15,2) default 0;
  billing_rate_hr : Decimal(15,2) @mandatory;
  budget_status : String(15) default 'Within Budget';
  currency_code : String(3) @mandatory;
}
entity Milestones : cuid, managed {
  project : Association to one Projects @mandatory;
  milestone_name : String(100) @mandatory;
  description : String(500);
  start_date : Date @mandatory;
  end_date : Date @mandatory;
  completion_percent : Decimal(5,2) default 0;
  status : String(15) default 'Not Started';
  priority : String(10) default 'Medium';
  fixed_fee_amt : Decimal(15,2);
  is_billable : Boolean default false;
  tasks : Composition of many Tasks on tasks.milestone = $self;
}
entity Tasks : cuid, managed {
  project : Association to one Projects @mandatory;
  milestone : Association to one Milestones @mandatory;
  task_name : String(100) @mandatory;
  description : String(500);
  start_date : Date @mandatory;
  end_date : Date @mandatory;
  priority : String(10) default 'Medium';
  status : String(15) default 'To Do';
  estimated_hours : Decimal(10,2) @mandatory;
  actual_hours : Decimal(10,2) default 0; // Official actuals count Approved entries only.
  timesheetEntries : Association to many TimesheetEntries on timesheetEntries.task = $self;
}
entity Timesheets : cuid, managed {
  employee : Association to one Employees @mandatory;
  project : Association to one Projects @mandatory;
  approvedBy : Association to Employees;
  week_start_date : Date @mandatory;
  week_end_date : Date @mandatory;
  total_billable_hours : Decimal(10,2) default 0;
  submitted_date : Date;
  approved_date : Date;
  status : String(10) default 'Draft';
  rejection_reason : String(255);
  entries : Composition of many TimesheetEntries on entries.timesheet = $self;
}
entity TimesheetEntries : cuid, managed {
  timesheet : Association to one Timesheets @mandatory;
  task : Association to one Tasks @mandatory;
  work_date : Date @mandatory;
  hours : Decimal(4,2) @mandatory;
  is_billable : Boolean default true;
  notes : String(255);
}
entity Invoices : cuid, managed {
  client : Association to one Clients @mandatory;
  project : Association to one Projects @mandatory;
  invoice_number : String(30);
  invoice_date : Date;
  due_date : Date;
  period_from : Date;
  period_to : Date;
  billable_hours : Decimal(10,2) default 0;
  subtotal_amt : Decimal(15,2) default 0;
  total_amt : Decimal(15,2) default 0;
  tax_amt : Decimal(15,2) default 0;
  tax_rate : Decimal(5,2) default 0;
  currency_code : String(3) @mandatory;
  payment_status : String(10) default 'Draft';
  issued_at : Timestamp;
  paid_at : Timestamp;
  cancelled_at : Timestamp;
  cancellation_reason : String(255);
  client_name_snapshot : String(100);
  project_name_snapshot : String(100);
  immutable_on_issue : Boolean default false;
  lines : Composition of many InvoiceLines on lines.invoice = $self;
}
entity InvoiceLines : cuid, managed {
  invoice : Association to one Invoices @mandatory;
  description : String(255) @mandatory;
  source_type : String(20) @mandatory; // TimeEntry, Milestone, Retainer
  quantity : Decimal(10,2) @mandatory;
  unit_price : Decimal(15,2) @mandatory;
  line_subtotal : Decimal(15,2) @mandatory;
  tax_rate : Decimal(5,2) default 0;
  tax_amt : Decimal(15,2) default 0;
  line_total : Decimal(15,2) @mandatory;
  milestone : Association to Milestones;
  sourceLinks : Composition of many InvoiceSourceLinks on sourceLinks.invoiceLine = $self;
}
entity InvoiceSourceLinks : cuid, managed {
  invoiceLine : Association to one InvoiceLines @mandatory;
  timesheetEntry : Association to TimesheetEntries;
  source_key : String(100) @mandatory; // Stable key for duplicate-billing checks.
}
entity ThresholdConfig : cuid, managed {
  scope : String(20) @mandatory; // ProjectBudget or TaskBurn
  threshold_pct : Decimal(5,2) @mandatory;
  severity : String(20) @mandatory;
  is_active : Boolean default true;
  // TODO(CONFIG): seed budget 75/90/100 and task 80/100 thresholds in bootstrap data.
}
entity Notifications : cuid, managed {
  recipient : Association to Employees @mandatory;
  event_type : String(40) @mandatory;
  subject : String(255) @mandatory;
  message : LargeString @mandatory;
  delivery_status : String(20) default 'Pending';
  delivered_at : Timestamp;
  related_entity : String(100);
  related_record_id : String(36);
  deduplication_key : String(160);
  // TODO(CONFIG): real email provider settings must be injected securely, never committed.
}
entity AuditLog : cuid {
  entity_name : String(100) @mandatory;
  record_id : String(36) @mandatory;
  action : String(20) @mandatory;
  actor : String(254);
  changed_at : Timestamp @mandatory;
  old_values : LargeString;
  new_values : LargeString;
}
