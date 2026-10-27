using AdminService as srv from '../../srv/psa-services';

annotate srv.Clients with @(
  UI.HeaderInfo: { TypeName: 'Client', TypeNamePlural: 'Clients', Title: { Value: client_name }, Description: { Value: client_code } },
  UI.SelectionFields: [ client_code, client_name, is_active ],
  UI.LineItem: [ { Value: client_code }, { Value: client_name }, { Value: email }, { Value: phone }, { Value: is_active } ],
  UI.FieldGroup #General: { Data: [
    { Value: client_code }, { Value: client_name }, { Value: email }, { Value: phone }, { Value: address }, { Value: is_active }
  ]},
  UI.Facets: [ { $Type: 'UI.ReferenceFacet', ID: 'General', Label: 'General', Target: '@UI.FieldGroup#General' } ]
) {
  client_code @mandatory;
  client_name @mandatory;
};
