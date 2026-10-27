using BillingService as srv from '../../srv/psa-services';

annotate srv.Invoices with @(
  UI.HeaderInfo: {
    TypeName: 'Invoice', TypeNamePlural: 'Invoices',
    Title: { Value: project_name_snapshot },
    Description: { Value: invoice_number }
  },
  UI.SelectionFields: [ payment_status, client_ID, project_ID, invoice_date ],
  UI.LineItem: [
    { $Type: 'UI.DataFieldForAction', Action: 'BillingService.EntityContainer/generateInvoice', Label: 'Generate Invoice' },
    { Value: invoice_number },
    { Value: client_name_snapshot },
    { Value: project_name_snapshot },
    { Value: period_from },
    { Value: period_to },
    { Value: billable_hours },
    { Value: total_amt },
    { Value: due_date },
    { Value: payment_status, Criticality: statusCriticality }
  ],
  UI.PresentationVariant: { SortOrder: [{ Property: createdAt, Descending: true }], Visualizations: ['@UI.LineItem'] },
  UI.HeaderFacets: [
    { $Type: 'UI.ReferenceFacet', Target: '@UI.DataPoint#status' },
    { $Type: 'UI.ReferenceFacet', Target: '@UI.DataPoint#total' }
  ],
  UI.DataPoint #status: { Value: payment_status, Title: 'Status', Criticality: statusCriticality },
  UI.DataPoint #total: { Value: total_amt, Title: 'Total' },
  UI.Identification: [
    { $Type: 'UI.DataFieldForAction', Action: 'BillingService.issueInvoice', Label: 'Issue' },
    { $Type: 'UI.DataFieldForAction', Action: 'BillingService.markInvoicePaid', Label: 'Mark Paid' },
    { $Type: 'UI.DataFieldForAction', Action: 'BillingService.cancelInvoice', Label: 'Cancel Draft' }
  ],
  UI.FieldGroup #General: { Data: [
    { Value: invoice_number }, { Value: client_name_snapshot }, { Value: project_name_snapshot },
    { Value: period_from }, { Value: period_to }, { Value: invoice_date }, { Value: due_date },
    { Value: payment_status, Criticality: statusCriticality }, { Value: cancellation_reason }
  ]},
  UI.FieldGroup #Amounts: { Data: [
    { Value: billable_hours }, { Value: subtotal_amt }, { Value: tax_rate }, { Value: tax_amt }, { Value: total_amt }, { Value: currency_code }
  ]},
  UI.Facets: [
    { $Type: 'UI.CollectionFacet', ID: 'Overview', Label: 'Overview', Facets: [
      { $Type: 'UI.ReferenceFacet', ID: 'General', Label: 'General', Target: '@UI.FieldGroup#General' },
      { $Type: 'UI.ReferenceFacet', ID: 'Amounts', Label: 'Amounts', Target: '@UI.FieldGroup#Amounts' }
    ]},
    { $Type: 'UI.ReferenceFacet', ID: 'Lines', Label: 'Invoice Lines', Target: 'lines/@UI.LineItem' }
  ]
) {
  project @Common.ValueList: {
    CollectionPath: 'Projects',
    Parameters: [
      { $Type: 'Common.ValueListParameterInOut', LocalDataProperty: project_ID, ValueListProperty: 'ID' },
      { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'project_code' }
    ]
  };
  client @Common.ValueList: {
    CollectionPath: 'Clients',
    Parameters: [
      { $Type: 'Common.ValueListParameterInOut', LocalDataProperty: client_ID, ValueListProperty: 'ID' },
      { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'client_code' }
    ]
  };
};

annotate srv.Invoices actions {
  issueInvoice @Core.OperationAvailable: { $edmJson: { $Eq: [ { $Path: 'in/payment_status' }, 'Draft' ] } }
    @Common.SideEffects: { TargetProperties: [ 'in/payment_status', 'in/invoice_number', 'in/invoice_date', 'in/due_date', 'in/statusCriticality' ] };
  markInvoicePaid @Core.OperationAvailable: { $edmJson: { $Or: [
      { $Eq: [ { $Path: 'in/payment_status' }, 'Issued' ] }, { $Eq: [ { $Path: 'in/payment_status' }, 'Overdue' ] } ] } }
    @Common.SideEffects: { TargetProperties: [ 'in/payment_status', 'in/paid_at', 'in/statusCriticality' ] }
    (paymentDate @title: 'Payment Date');
  cancelInvoice @Core.OperationAvailable: { $edmJson: { $Eq: [ { $Path: 'in/payment_status' }, 'Draft' ] } }
    @Common.SideEffects: { TargetProperties: [ 'in/payment_status', 'in/cancellation_reason', 'in/statusCriticality' ] }
    (reason @title: 'Cancellation Reason');
};

// Refresh the invoice list after generating.
annotate srv.generateInvoice with @Common.SideEffects: { TargetEntities: [ '/BillingService.EntityContainer/Invoices' ] };
annotate srv.generateInvoice with (
  projectID @title: 'Project' @Common.ValueList: {
    CollectionPath: 'Projects',
    Parameters: [
      { $Type: 'Common.ValueListParameterOut', LocalDataProperty: projectID, ValueListProperty: 'ID' },
      { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'project_code' },
      { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'project_name' },
      { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'billing_type' }
    ]
  },
  periodFrom @title: 'Period From',
  periodTo @title: 'Period To'
);

annotate srv.Projects with @UI.LineItem: [ { Value: project_code }, { Value: project_name }, { Value: billing_type }, { Value: client_ID } ];

annotate srv.InvoiceLines with @(
  UI.LineItem: [
    { Value: description }, { Value: source_type }, { Value: quantity }, { Value: unit_price },
    { Value: line_subtotal }, { Value: tax_amt }, { Value: line_total }
  ]
);
