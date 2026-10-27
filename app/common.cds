using { psa } from '../db/schema';

// Field labels and texts shared by all Fiori apps.

annotate psa.Clients with @title: 'Client' {
  ID          @UI.Hidden  @Common.Text: client_name  @Common.TextArrangement: #TextOnly;
  client_code @title: 'Client Code';
  client_name @title: 'Client Name';
  email       @title: 'E-mail';
  phone       @title: 'Phone';
  address     @title: 'Billing Address'  @UI.MultiLineText;
  is_active   @title: 'Active';
};

annotate psa.Departments with @title: 'Department' {
  ID              @UI.Hidden  @Common.Text: department_name  @Common.TextArrangement: #TextOnly;
  department_code @title: 'Department Code';
  department_name @title: 'Department';
  description     @title: 'Description';
  head            @title: 'Head'  @Common.Text: head.full_name  @Common.TextArrangement: #TextOnly;
};

annotate psa.Employees with @title: 'Employee' {
  ID            @UI.Hidden  @Common.Text: full_name  @Common.TextArrangement: #TextOnly;
  employee_code @title: 'Employee Code';
  full_name     @title: 'Name';
  email         @title: 'Login E-mail'  @Common.QuickInfo: 'Must equal the user''s BTP login e-mail';
  is_manager    @title: 'Manager';
  is_active     @title: 'Active';
  department    @title: 'Department'  @Common.Text: department.department_name  @Common.TextArrangement: #TextOnly;
  manager       @title: 'Line Manager'  @Common.Text: manager.full_name  @Common.TextArrangement: #TextOnly;
  external_hr_id   @title: 'HR ID';
  identity_subject @UI.Hidden;
};

annotate psa.Projects with @title: 'Project' {
  ID               @UI.Hidden  @Common.Text: project_name  @Common.TextArrangement: #TextOnly;
  project_code     @title: 'Project Code';
  project_name     @title: 'Project Name';
  client           @title: 'Client'  @Common.Text: client.client_name  @Common.TextArrangement: #TextOnly;
  manager          @title: 'Project Manager'  @Common.Text: manager.full_name  @Common.TextArrangement: #TextOnly;
  billing_type     @title: 'Billing Type';
  start_date       @title: 'Start Date';
  end_date         @title: 'End Date';
  status           @title: 'Status';
  priority         @title: 'Priority';
  planned_hours    @title: 'Planned Hours';
  consumed_hours   @title: 'Consumed Hours'  @readonly;
  fixed_fee_amt    @title: 'Fixed Fee';
  retainer_fee_amt @title: 'Retainer Fee';
  retainer_period  @title: 'Retainer Period';
};

annotate psa.Budgets with @title: 'Budget' {
  ID              @UI.Hidden;
  project         @UI.Hidden;
  budget_amt      @title: 'Budget Amount'  @Measures.ISOCurrency: currency_code;
  consumed_amt    @title: 'Consumed'  @Measures.ISOCurrency: currency_code  @readonly;
  remaining_amt   @title: 'Remaining'  @Measures.ISOCurrency: currency_code  @readonly;
  billing_rate_hr @title: 'Billing Rate / Hour'  @Measures.ISOCurrency: currency_code;
  budget_status   @title: 'Budget Status'  @readonly;
  currency_code   @title: 'Currency';
  consumed_pct    @title: 'Consumed %';
  statusCriticality @UI.Hidden;
};

annotate psa.Milestones with @title: 'Milestone' {
  ID                 @UI.Hidden  @Common.Text: milestone_name  @Common.TextArrangement: #TextOnly;
  project            @UI.Hidden;
  milestone_name     @title: 'Milestone';
  description        @title: 'Deliverables / Exit Criteria'  @UI.MultiLineText;
  start_date         @title: 'Start Date';
  end_date           @title: 'End Date';
  completion_percent @title: 'Completion %'  @readonly;
  status             @title: 'Status';
  priority           @title: 'Priority';
  fixed_fee_amt      @title: 'Fixed Fee';
  is_billable        @title: 'Billable (Fixed Fee)';
};

annotate psa.Tasks with @title: 'Task' {
  ID              @UI.Hidden  @Common.Text: task_name  @Common.TextArrangement: #TextOnly;
  project         @title: 'Project'  @Common.Text: project.project_name  @Common.TextArrangement: #TextOnly  @readonly;
  milestone       @title: 'Milestone'  @Common.Text: milestone.milestone_name  @Common.TextArrangement: #TextOnly;
  task_name       @title: 'Task';
  description     @title: 'Description'  @UI.MultiLineText;
  start_date      @title: 'Start Date';
  end_date        @title: 'End Date';
  priority        @title: 'Priority';
  status          @title: 'Status';
  estimated_hours @title: 'Estimated Hours';
  actual_hours    @title: 'Actual Hours'  @readonly;
  burn_pct        @title: 'Burn %';
  burnCriticality @UI.Hidden;
};

annotate psa.Timesheets with @title: 'Timesheet' {
  ID                   @UI.Hidden;
  employee             @title: 'Employee'  @Common.Text: employee.full_name  @Common.TextArrangement: #TextOnly;
  project              @title: 'Project'  @Common.Text: project.project_name  @Common.TextArrangement: #TextOnly;
  approvedBy           @title: 'Decided By'  @Common.Text: approvedBy.full_name  @Common.TextArrangement: #TextOnly;
  week_start_date      @title: 'Week Start (Monday)';
  week_end_date        @title: 'Week End'  @readonly;
  total_billable_hours @title: 'Billable Hours'  @readonly;
  submitted_date       @title: 'Submitted On'  @readonly;
  approved_date        @title: 'Approved On'  @readonly;
  status               @title: 'Status'  @readonly;
  rejection_reason     @title: 'Rejection Reason'  @readonly;
  statusCriticality    @UI.Hidden;
  locked               @UI.Hidden;
};

annotate psa.TimesheetEntries with @title: 'Time Entry' {
  ID          @UI.Hidden;
  timesheet   @UI.Hidden;
  task        @title: 'Task'  @Common.Text: task.task_name  @Common.TextArrangement: #TextOnly;
  work_date   @title: 'Date';
  hours       @title: 'Hours';
  is_billable @title: 'Billable';
  notes       @title: 'Notes';
};

annotate psa.Invoices with @title: 'Invoice' {
  ID                    @UI.Hidden;
  client                @title: 'Client'  @Common.Text: client.client_name  @Common.TextArrangement: #TextOnly;
  project               @title: 'Project'  @Common.Text: project.project_name  @Common.TextArrangement: #TextOnly;
  invoice_number        @title: 'Invoice Number';
  invoice_date          @title: 'Invoice Date';
  due_date              @title: 'Due Date';
  period_from           @title: 'Period From';
  period_to             @title: 'Period To';
  billable_hours        @title: 'Billable Hours';
  subtotal_amt          @title: 'Subtotal'  @Measures.ISOCurrency: currency_code;
  tax_amt               @title: 'Tax'  @Measures.ISOCurrency: currency_code;
  tax_rate              @title: 'Tax Rate %';
  total_amt             @title: 'Total'  @Measures.ISOCurrency: currency_code;
  currency_code         @title: 'Currency';
  payment_status        @title: 'Status';
  issued_at             @title: 'Issued At';
  paid_at               @title: 'Paid At';
  cancelled_at          @title: 'Cancelled At';
  cancellation_reason   @title: 'Cancellation Reason';
  client_name_snapshot  @title: 'Client';
  project_name_snapshot @title: 'Project';
  immutable_on_issue    @UI.Hidden;
  statusCriticality     @UI.Hidden;
};

annotate psa.InvoiceLines with @title: 'Invoice Line' {
  ID            @UI.Hidden;
  invoice       @UI.Hidden;
  description   @title: 'Description';
  source_type   @title: 'Source';
  quantity      @title: 'Quantity';
  unit_price    @title: 'Unit Price';
  line_subtotal @title: 'Subtotal';
  tax_rate      @title: 'Tax Rate %';
  tax_amt       @title: 'Tax';
  line_total    @title: 'Line Total';
};

annotate psa.Notifications with @title: 'Notification' {
  ID         @UI.Hidden;
  event_type @title: 'Type';
  subject    @title: 'Subject';
  message    @title: 'Message';
  createdAt  @title: 'Created At';
};

annotate psa.AuditLog with @title: 'Audit Log' {
  entity_name @title: 'Entity';
  record_id   @title: 'Record';
  action      @title: 'Action';
  actor       @title: 'User';
  changed_at  @title: 'Changed At';
  old_values  @title: 'Old Values';
  new_values  @title: 'New Values';
};
