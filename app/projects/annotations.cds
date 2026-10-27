using ProjectService as srv from '../../srv/psa-services';

annotate srv.Projects with @(
  UI.HeaderInfo: {
    TypeName: 'Project', TypeNamePlural: 'My Projects',
    Title: { Value: project_name },
    Description: { Value: project_code }
  },
  UI.SelectionFields: [ project_code, status, client_ID, billing_type, priority ],
  UI.LineItem: [
    { Value: project_code },
    { Value: project_name },
    { Value: client_ID },
    { Value: billing_type },
    { Value: status },
    { Value: priority },
    { Value: budget.budget_status, Label: 'Budget Status', Criticality: budget.statusCriticality },
    { Value: budget.consumed_pct, Label: 'Budget Consumed %', Criticality: budget.statusCriticality },
    { Value: consumed_hours },
    { Value: planned_hours },
    { Value: end_date }
  ],
  UI.HeaderFacets: [
    { $Type: 'UI.ReferenceFacet', Target: 'budget/@UI.DataPoint#status' },
    { $Type: 'UI.ReferenceFacet', Target: 'budget/@UI.DataPoint#consumed' },
    { $Type: 'UI.ReferenceFacet', Target: '@UI.DataPoint#hours' }
  ],
  UI.DataPoint #hours: { Value: consumed_hours, TargetValue: planned_hours, Title: 'Consumed vs Planned Hours', Visualization: #Progress },
  UI.Identification: [
    { $Type: 'UI.DataFieldForAction', Action: 'ProjectService.recalculateBudget', Label: 'Recalculate Budget' }
  ],
  UI.FieldGroup #General: { Data: [
    { Value: project_code }, { Value: project_name }, { Value: client_ID }, { Value: billing_type },
    { Value: status }, { Value: priority }, { Value: start_date }, { Value: end_date }, { Value: manager_ID }
  ]},
  UI.FieldGroup #Effort: { Data: [
    { Value: planned_hours }, { Value: consumed_hours },
    { Value: fixed_fee_amt }, { Value: retainer_fee_amt }, { Value: retainer_period }
  ]},
  UI.Facets: [
    { $Type: 'UI.CollectionFacet', ID: 'Overview', Label: 'Overview', Facets: [
      { $Type: 'UI.ReferenceFacet', ID: 'General', Label: 'General', Target: '@UI.FieldGroup#General' },
      { $Type: 'UI.ReferenceFacet', ID: 'Effort', Label: 'Effort and Fees', Target: '@UI.FieldGroup#Effort' }
    ]},
    { $Type: 'UI.ReferenceFacet', ID: 'Budget', Label: 'Budget', Target: 'budget/@UI.FieldGroup#Budget' },
    { $Type: 'UI.ReferenceFacet', ID: 'Milestones', Label: 'Milestones', Target: 'milestones/@UI.LineItem' },
    { $Type: 'UI.ReferenceFacet', ID: 'Timesheets', Label: 'Timesheets', Target: 'timesheets/@UI.LineItem' }
  ]
) {
  manager @readonly;
  client @Common.ValueList: {
    CollectionPath: 'Clients',
    Parameters: [
      { $Type: 'Common.ValueListParameterInOut', LocalDataProperty: client_ID, ValueListProperty: 'ID' },
      { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'client_code' },
      { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'client_name' }
    ]
  };
  billing_type @Common.ValueList: { CollectionPath: 'BillingTypes', Parameters: [
    { $Type: 'Common.ValueListParameterInOut', LocalDataProperty: billing_type, ValueListProperty: 'code' },
    { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'name' }
  ]} @Common.ValueListWithFixedValues;
  status @Common.ValueList: { CollectionPath: 'ProjectStatuses', Parameters: [
    { $Type: 'Common.ValueListParameterInOut', LocalDataProperty: status, ValueListProperty: 'code' }
  ]} @Common.ValueListWithFixedValues;
  priority @Common.ValueList: { CollectionPath: 'Priorities', Parameters: [
    { $Type: 'Common.ValueListParameterInOut', LocalDataProperty: priority, ValueListProperty: 'code' }
  ]} @Common.ValueListWithFixedValues;
  project_code @mandatory;
  project_name @mandatory;
  client @mandatory;
  start_date @mandatory;
  end_date @mandatory;
};

annotate srv.Projects actions {
  recalculateBudget @Core.OperationAvailable: { $edmJson: { $Eq: [ { $Path: 'in/IsActiveEntity' }, true ] } }
    @Common.SideEffects: { TargetEntities: [ 'in/budget', 'in/milestones', 'in/tasks' ], TargetProperties: [ 'in/consumed_hours' ] };
};

annotate srv.Budgets with @(
  UI.DataPoint #status: { Value: budget_status, Title: 'Budget Status', Criticality: statusCriticality },
  UI.DataPoint #consumed: { Value: consumed_pct, TargetValue: 100, Title: 'Budget Consumed %', Visualization: #Progress, Criticality: statusCriticality },
  UI.FieldGroup #Budget: { Data: [
    { Value: budget_amt }, { Value: billing_rate_hr }, { Value: currency_code },
    { Value: consumed_amt }, { Value: remaining_amt },
    { Value: budget_status, Criticality: statusCriticality }
  ]}
) {
  budget_amt @mandatory;
  billing_rate_hr @mandatory;
  currency_code @mandatory;
};

annotate srv.Milestones with @(
  UI.HeaderInfo: { TypeName: 'Milestone', TypeNamePlural: 'Milestones', Title: { Value: milestone_name }, Description: { Value: status } },
  UI.LineItem: [
    { Value: milestone_name }, { Value: start_date }, { Value: end_date }, { Value: status },
    { Value: completion_percent }, { Value: is_billable }, { Value: fixed_fee_amt }
  ],
  UI.FieldGroup #General: { Data: [
    { Value: milestone_name }, { Value: description }, { Value: start_date }, { Value: end_date },
    { Value: status }, { Value: priority }, { Value: completion_percent }, { Value: is_billable }, { Value: fixed_fee_amt }
  ]},
  UI.Facets: [
    { $Type: 'UI.ReferenceFacet', ID: 'General', Label: 'General', Target: '@UI.FieldGroup#General' },
    { $Type: 'UI.ReferenceFacet', ID: 'Tasks', Label: 'Tasks', Target: 'tasks/@UI.LineItem' }
  ]
) {
  status @Common.ValueList: { CollectionPath: 'MilestoneStatuses', Parameters: [
    { $Type: 'Common.ValueListParameterInOut', LocalDataProperty: status, ValueListProperty: 'code' }
  ]} @Common.ValueListWithFixedValues;
  priority @Common.ValueList: { CollectionPath: 'Priorities', Parameters: [
    { $Type: 'Common.ValueListParameterInOut', LocalDataProperty: priority, ValueListProperty: 'code' }
  ]} @Common.ValueListWithFixedValues;
  milestone_name @mandatory;
  start_date @mandatory;
  end_date @mandatory;
};

annotate srv.Tasks with @(
  UI.LineItem: [
    { Value: task_name }, { Value: status }, { Value: priority }, { Value: start_date }, { Value: end_date },
    { Value: estimated_hours }, { Value: actual_hours }, { Value: burn_pct, Criticality: burnCriticality }
  ],
  UI.LineItem #Burn: [
    { Value: task_name }, { Value: milestone_ID }, { Value: status },
    { Value: estimated_hours }, { Value: actual_hours }, { Value: burn_pct, Criticality: burnCriticality }
  ]
) {
  status @Common.ValueList: { CollectionPath: 'TaskStatuses', Parameters: [
    { $Type: 'Common.ValueListParameterInOut', LocalDataProperty: status, ValueListProperty: 'code' }
  ]} @Common.ValueListWithFixedValues;
  priority @Common.ValueList: { CollectionPath: 'Priorities', Parameters: [
    { $Type: 'Common.ValueListParameterInOut', LocalDataProperty: priority, ValueListProperty: 'code' }
  ]} @Common.ValueListWithFixedValues;
  task_name @mandatory;
  start_date @mandatory;
  end_date @mandatory;
  estimated_hours @mandatory;
};
