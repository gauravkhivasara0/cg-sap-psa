using PortfolioService as srv from '../../srv/psa-services';

annotate srv.Projects with @(
  UI.HeaderInfo: {
    TypeName: 'Project', TypeNamePlural: 'Department Portfolio',
    Title: { Value: project_name },
    Description: { Value: project_code }
  },
  UI.SelectionFields: [ status, client_ID, manager_ID, billing_type ],
  UI.LineItem: [
    { Value: project_code },
    { Value: project_name },
    { Value: client_ID },
    { Value: manager_ID },
    { Value: status },
    { Value: budget.budget_amt, Label: 'Budget' },
    { Value: budget.consumed_amt, Label: 'Consumed' },
    { Value: budget.consumed_pct, Label: 'Consumed %', Criticality: budget.statusCriticality },
    { Value: budget.budget_status, Label: 'Budget Status', Criticality: budget.statusCriticality },
    { Value: consumed_hours },
    { Value: planned_hours }
  ],
  UI.HeaderFacets: [
    { $Type: 'UI.ReferenceFacet', Target: 'budget/@UI.DataPoint#status' },
    { $Type: 'UI.ReferenceFacet', Target: 'budget/@UI.DataPoint#consumed' }
  ],
  UI.FieldGroup #General: { Data: [
    { Value: project_code }, { Value: project_name }, { Value: client_ID }, { Value: manager_ID },
    { Value: billing_type }, { Value: status }, { Value: priority }, { Value: start_date }, { Value: end_date },
    { Value: planned_hours }, { Value: consumed_hours }
  ]},
  UI.Facets: [
    { $Type: 'UI.ReferenceFacet', ID: 'General', Label: 'General', Target: '@UI.FieldGroup#General' },
    { $Type: 'UI.ReferenceFacet', ID: 'Budget', Label: 'Budget', Target: 'budget/@UI.FieldGroup#Budget' }
  ]
);

annotate srv.Budgets with @(
  UI.DataPoint #status: { Value: budget_status, Title: 'Budget Status', Criticality: statusCriticality },
  UI.DataPoint #consumed: { Value: consumed_pct, TargetValue: 100, Title: 'Budget Consumed %', Visualization: #Progress, Criticality: statusCriticality },
  UI.FieldGroup #Budget: { Data: [
    { Value: budget_amt }, { Value: billing_rate_hr }, { Value: consumed_amt }, { Value: remaining_amt },
    { Value: budget_status, Criticality: statusCriticality }
  ]}
);
