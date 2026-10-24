using { ProjectService, BillingService } from '../../srv/psa-services';

annotate ProjectService.Projects with @(
  UI.HeaderInfo: {
    TypeName: 'Project',
    TypeNamePlural: 'Projects',
    Title: { Value: project_name },
    Description: { Value: project_code }
  },
  UI.SelectionFields: [project_code, project_name, status, priority],
  UI.LineItem: [
    { Value: project_code, Label: 'Project Code' },
    { Value: project_name, Label: 'Project Name' },
    { Value: client.client_name, Label: 'Client' },
    { Value: status, Label: 'Status' },
    { Value: priority, Label: 'Priority' },
    { Value: start_date, Label: 'Start Date' },
    { Value: end_date, Label: 'End Date' }
  ],
  UI.FieldGroup #General: {
    Data: [
      { Value: project_code, Label: 'Project Code' },
      { Value: project_name, Label: 'Project Name' },
      { Value: billing_type, Label: 'Billing Type' },
      { Value: status, Label: 'Status' },
      { Value: priority, Label: 'Priority' }
    ]
  },
  UI.Facets: [
    { $Type: 'UI.ReferenceFacet', Label: 'General', Target: '@UI.FieldGroup#General' }
  ]
);

annotate ProjectService.Tasks with @(
  UI.LineItem: [
    { Value: task_name, Label: 'Task' },
    { Value: status, Label: 'Status' },
    { Value: estimated_hours, Label: 'Estimated Hours' },
    { Value: actual_hours, Label: 'Actual Hours' },
    { Value: priority, Label: 'Priority' }
  ]
);

annotate ProjectService.Timesheets with @(
  UI.LineItem: [
    { Value: employee.full_name, Label: 'Employee' },
    { Value: project.project_name, Label: 'Project' },
    { Value: week_start_date, Label: 'Week Start' },
    { Value: week_end_date, Label: 'Week End' },
    { Value: status, Label: 'Status' },
    { Value: total_billable_hours, Label: 'Billable Hours' }
  ]
);

annotate BillingService.Invoices with @(
  UI.LineItem: [
    { Value: invoice_number, Label: 'Invoice Number' },
    { Value: project.project_name, Label: 'Project' },
    { Value: invoice_date, Label: 'Invoice Date' },
    { Value: billable_hours, Label: 'Billable Hours' },
    { Value: total_amt, Label: 'Total Amount' },
    { Value: payment_status, Label: 'Payment Status' }
  ]
);
