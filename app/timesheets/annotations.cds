using EmployeeService as srv from '../../srv/psa-services';

annotate srv.MyTimesheets with @(
  UI.UpdateHidden: locked,
  UI.DeleteHidden: locked,
  Common.SideEffects #week: { SourceProperties: [ week_start_date ], TargetProperties: [ 'week_end_date' ] },
  UI.HeaderInfo: {
    TypeName: 'Timesheet', TypeNamePlural: 'My Timesheets',
    Title: { Value: project.project_name },
    Description: { Value: week_start_date }
  },
  UI.SelectionFields: [ status, project_ID, week_start_date ],
  UI.LineItem: [
    { Value: week_start_date },
    { Value: week_end_date },
    { Value: project_ID },
    { Value: status, Criticality: statusCriticality },
    { Value: total_billable_hours },
    { Value: submitted_date },
    { Value: rejection_reason }
  ],
  UI.PresentationVariant: { SortOrder: [{ Property: week_start_date, Descending: true }], Visualizations: ['@UI.LineItem'] },
  UI.HeaderFacets: [
    { $Type: 'UI.ReferenceFacet', Target: '@UI.DataPoint#status' },
    { $Type: 'UI.ReferenceFacet', Target: '@UI.DataPoint#hours' }
  ],
  UI.DataPoint #status: { Value: status, Title: 'Status', Criticality: statusCriticality },
  UI.DataPoint #hours: { Value: total_billable_hours, Title: 'Billable Hours' },
  UI.Identification: [
    { $Type: 'UI.DataFieldForAction', Action: 'EmployeeService.submitTimesheet', Label: 'Submit' }
  ],
  UI.FieldGroup #General: { Data: [
    { Value: project_ID },
    { Value: week_start_date },
    { Value: week_end_date },
    { Value: status, Criticality: statusCriticality },
    { Value: submitted_date },
    { Value: approved_date },
    { Value: rejection_reason }
  ]},
  UI.Facets: [
    { $Type: 'UI.ReferenceFacet', ID: 'General', Label: 'General', Target: '@UI.FieldGroup#General' },
    { $Type: 'UI.ReferenceFacet', ID: 'Entries', Label: 'Time Entries', Target: 'entries/@UI.LineItem' }
  ]
) {
  project @Common.ValueList: {
    CollectionPath: 'Projects',
    Parameters: [
      { $Type: 'Common.ValueListParameterInOut', LocalDataProperty: project_ID, ValueListProperty: 'ID' },
      { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'project_code' },
      { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'project_name' }
    ]
  } @Common.ValueListWithFixedValues;
  week_start_date @Common.FieldControl: { $edmJson: { $If: [ { $Eq: [ { $Path: 'IsActiveEntity' }, false ] }, 3, 1 ] } };
};

// Submit is only offered for saved Draft / Rejected timesheets.
annotate srv.MyTimesheets actions {
  submitTimesheet @Core.OperationAvailable: { $edmJson: { $And: [
    { $Eq: [ { $Path: 'in/IsActiveEntity' }, true ] },
    { $Or: [ { $Eq: [ { $Path: 'in/status' }, 'Draft' ] }, { $Eq: [ { $Path: 'in/status' }, 'Rejected' ] } ] }
  ] } } @Common.SideEffects: { TargetProperties: [ 'in/status', 'in/submitted_date', 'in/total_billable_hours', 'in/rejection_reason', 'in/statusCriticality' ] };
};

annotate srv.MyTimesheetEntries with @(
  UI.LineItem: [
    { Value: work_date },
    { Value: task_ID },
    { Value: hours },
    { Value: is_billable },
    { Value: notes }
  ]
) {
  task @Common.ValueList: {
    CollectionPath: 'MyTasks',
    Parameters: [
      { $Type: 'Common.ValueListParameterInOut', LocalDataProperty: task_ID, ValueListProperty: 'ID' },
      { $Type: 'Common.ValueListParameterIn', LocalDataProperty: timesheet.project_ID, ValueListProperty: 'project_ID' },
      { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'task_name' },
      { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'milestone_ID' },
      { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'status' }
    ]
  };
};

annotate srv.MyTasks with @UI.LineItem: [ { Value: task_name }, { Value: project_ID }, { Value: milestone_ID }, { Value: status } ];
