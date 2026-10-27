using AdminService as srv from '../../srv/psa-services';

annotate srv.Departments with @(
  UI.HeaderInfo: { TypeName: 'Department', TypeNamePlural: 'Departments', Title: { Value: department_name }, Description: { Value: department_code } },
  UI.SelectionFields: [ department_name ],
  UI.LineItem: [ { Value: department_code }, { Value: department_name }, { Value: head_ID }, { Value: description } ],
  UI.FieldGroup #General: { Data: [ { Value: department_code }, { Value: department_name }, { Value: head_ID }, { Value: description } ] },
  UI.Facets: [
    { $Type: 'UI.ReferenceFacet', ID: 'General', Label: 'General', Target: '@UI.FieldGroup#General' },
    { $Type: 'UI.ReferenceFacet', ID: 'Employees', Label: 'Employees', Target: 'employees/@UI.LineItem' }
  ]
) {
  department_name @mandatory;
  head @Common.ValueList: { CollectionPath: 'Employees', Parameters: [
    { $Type: 'Common.ValueListParameterInOut', LocalDataProperty: head_ID, ValueListProperty: 'ID' },
    { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'full_name' }
  ]};
};
