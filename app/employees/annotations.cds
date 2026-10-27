using AdminService as srv from '../../srv/psa-services';

annotate srv.Employees with @(
  UI.HeaderInfo: { TypeName: 'Employee', TypeNamePlural: 'Employees', Title: { Value: full_name }, Description: { Value: email } },
  UI.SelectionFields: [ full_name, email, department_ID, is_active ],
  UI.LineItem: [
    { Value: employee_code }, { Value: full_name }, { Value: email }, { Value: department_ID },
    { Value: manager_ID }, { Value: is_manager }, { Value: is_active }
  ],
  UI.FieldGroup #General: { Data: [
    { Value: employee_code }, { Value: full_name }, { Value: email }, { Value: department_ID },
    { Value: manager_ID }, { Value: is_manager }, { Value: is_active }, { Value: external_hr_id }
  ]},
  UI.Facets: [ { $Type: 'UI.ReferenceFacet', ID: 'General', Label: 'General', Target: '@UI.FieldGroup#General' } ]
) {
  employee_code @mandatory;
  full_name @mandatory;
  email @mandatory;
  department @Common.ValueList: { CollectionPath: 'Departments', Parameters: [
    { $Type: 'Common.ValueListParameterInOut', LocalDataProperty: department_ID, ValueListProperty: 'ID' },
    { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'department_name' }
  ]};
  manager @Common.ValueList: { CollectionPath: 'Employees', Parameters: [
    { $Type: 'Common.ValueListParameterInOut', LocalDataProperty: manager_ID, ValueListProperty: 'ID' },
    { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'full_name' },
    { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'email' }
  ]};
};
