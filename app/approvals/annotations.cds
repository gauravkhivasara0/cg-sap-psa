using ProjectService as srv from '../../srv/psa-services';

annotate srv.Timesheets with @(
  UI.HeaderInfo: {
    TypeName: 'Timesheet', TypeNamePlural: 'Timesheets to Approve',
    Title: { Value: employee.full_name },
    Description: { Value: project.project_name }
  },
  UI.SelectionFields: [ status, employee_ID, project_ID, week_start_date ],
  UI.LineItem: [
    { $Type: 'UI.DataFieldForAction', Action: 'ProjectService.approveTimesheet', Label: 'Approve' },
    { $Type: 'UI.DataFieldForAction', Action: 'ProjectService.rejectTimesheet', Label: 'Reject' },
    { Value: employee_ID },
    { Value: project_ID },
    { Value: week_start_date },
    { Value: week_end_date },
    { Value: total_billable_hours },
    { Value: submitted_date },
    { Value: status, Criticality: statusCriticality }
  ],
  UI.SelectionVariant #Submitted: {
    Text: 'Pending Approval',
    SelectOptions: [{ PropertyName: status, Ranges: [{ Sign: #I, Option: #EQ, Low: 'Submitted' }] }]
  },
  UI.PresentationVariant: { SortOrder: [{ Property: week_start_date, Descending: true }], Visualizations: ['@UI.LineItem'] },
  UI.HeaderFacets: [
    { $Type: 'UI.ReferenceFacet', Target: '@UI.DataPoint#status' },
    { $Type: 'UI.ReferenceFacet', Target: '@UI.DataPoint#hours' }
  ],
  UI.DataPoint #status: { Value: status, Title: 'Status', Criticality: statusCriticality },
  UI.DataPoint #hours: { Value: total_billable_hours, Title: 'Billable Hours' },
  UI.Identification: [
    { $Type: 'UI.DataFieldForAction', Action: 'ProjectService.approveTimesheet', Label: 'Approve' },
    { $Type: 'UI.DataFieldForAction', Action: 'ProjectService.rejectTimesheet', Label: 'Reject' }
  ],
  UI.FieldGroup #General: { Data: [
    { Value: employee_ID }, { Value: project_ID }, { Value: week_start_date }, { Value: week_end_date },
    { Value: submitted_date }, { Value: status, Criticality: statusCriticality },
    { Value: approvedBy_ID }, { Value: approved_date }, { Value: rejection_reason }
  ]},
  UI.Facets: [
    { $Type: 'UI.ReferenceFacet', ID: 'General', Label: 'General', Target: '@UI.FieldGroup#General' },
    { $Type: 'UI.ReferenceFacet', ID: 'Entries', Label: 'Time Entries', Target: 'entries/@UI.LineItem' }
  ]
) {
  employee @Common.ValueList: {
    CollectionPath: 'Employees',
    Parameters: [
      { $Type: 'Common.ValueListParameterInOut', LocalDataProperty: employee_ID, ValueListProperty: 'ID' },
      { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'full_name' }
    ]
  };
  project @Common.ValueList: {
    CollectionPath: 'Projects',
    Parameters: [
      { $Type: 'Common.ValueListParameterInOut', LocalDataProperty: project_ID, ValueListProperty: 'ID' },
      { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'project_code' },
      { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'project_name' }
    ]
  };
  status @Common.ValueList: {
    CollectionPath: 'TimesheetStatuses',
    Parameters: [{ $Type: 'Common.ValueListParameterInOut', LocalDataProperty: status, ValueListProperty: 'code' }]
  } @Common.ValueListWithFixedValues;
};

annotate srv.Timesheets actions {
  approveTimesheet @Core.OperationAvailable: { $edmJson: { $Eq: [ { $Path: 'in/status' }, 'Submitted' ] } }
    @Common.SideEffects: { TargetProperties: [ 'in/status', 'in/approved_date', 'in/approvedBy_ID', 'in/statusCriticality' ] };
  rejectTimesheet @Core.OperationAvailable: { $edmJson: { $Eq: [ { $Path: 'in/status' }, 'Submitted' ] } }
    @Common.SideEffects: { TargetProperties: [ 'in/status', 'in/rejection_reason', 'in/statusCriticality' ] }
    (reason @title: 'Rejection Reason' @UI.MultiLineText);
};

annotate srv.TimesheetEntries with @(
  UI.LineItem: [ { Value: work_date }, { Value: task_ID }, { Value: hours }, { Value: is_billable }, { Value: notes } ]
);
