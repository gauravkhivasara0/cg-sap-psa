using BillingService as service from '../../srv/psa-services';
annotate service.Invoices with @(
    UI.FieldGroup #GeneratedGroup : {
        $Type : 'UI.FieldGroupType',
        Data : [
            {
                $Type : 'UI.DataField',
                Label : 'invoice_number',
                Value : invoice_number,
            },
            {
                $Type : 'UI.DataField',
                Label : 'invoice_date',
                Value : invoice_date,
            },
            {
                $Type : 'UI.DataField',
                Label : 'due_date',
                Value : due_date,
            },
            {
                $Type : 'UI.DataField',
                Label : 'period_from',
                Value : period_from,
            },
            {
                $Type : 'UI.DataField',
                Label : 'period_to',
                Value : period_to,
            },
            {
                $Type : 'UI.DataField',
                Label : 'billable_hours',
                Value : billable_hours,
            },
            {
                $Type : 'UI.DataField',
                Label : 'subtotal_amt',
                Value : subtotal_amt,
            },
            {
                $Type : 'UI.DataField',
                Label : 'total_amt',
                Value : total_amt,
            },
            {
                $Type : 'UI.DataField',
                Label : 'tax_amt',
                Value : tax_amt,
            },
            {
                $Type : 'UI.DataField',
                Label : 'tax_rate',
                Value : tax_rate,
            },
            {
                $Type : 'UI.DataField',
                Label : 'currency_code',
                Value : currency_code,
            },
            {
                $Type : 'UI.DataField',
                Label : 'payment_status',
                Value : payment_status,
            },
            {
                $Type : 'UI.DataField',
                Label : 'issued_at',
                Value : issued_at,
            },
            {
                $Type : 'UI.DataField',
                Label : 'paid_at',
                Value : paid_at,
            },
            {
                $Type : 'UI.DataField',
                Label : 'cancelled_at',
                Value : cancelled_at,
            },
            {
                $Type : 'UI.DataField',
                Label : 'cancellation_reason',
                Value : cancellation_reason,
            },
            {
                $Type : 'UI.DataField',
                Label : 'client_name_snapshot',
                Value : client_name_snapshot,
            },
            {
                $Type : 'UI.DataField',
                Label : 'project_name_snapshot',
                Value : project_name_snapshot,
            },
            {
                $Type : 'UI.DataField',
                Label : 'immutable_on_issue',
                Value : immutable_on_issue,
            },
        ],
    },
    UI.Facets : [
        {
            $Type : 'UI.ReferenceFacet',
            ID : 'GeneratedFacet1',
            Label : 'General Information',
            Target : '@UI.FieldGroup#GeneratedGroup',
        },
    ],
    UI.LineItem : [
        {
            $Type : 'UI.DataField',
            Label : 'invoice_number',
            Value : invoice_number,
        },
        {
            $Type : 'UI.DataField',
            Label : 'invoice_date',
            Value : invoice_date,
        },
        {
            $Type : 'UI.DataField',
            Label : 'due_date',
            Value : due_date,
        },
        {
            $Type : 'UI.DataField',
            Label : 'period_from',
            Value : period_from,
        },
        {
            $Type : 'UI.DataField',
            Label : 'period_to',
            Value : period_to,
        },
    ],
);

annotate service.Invoices with {
    client @Common.ValueList : {
        $Type : 'Common.ValueListType',
        CollectionPath : 'Clients',
        Parameters : [
            {
                $Type : 'Common.ValueListParameterInOut',
                LocalDataProperty : client_ID,
                ValueListProperty : 'ID',
            },
            {
                $Type : 'Common.ValueListParameterDisplayOnly',
                ValueListProperty : 'client_code',
            },
            {
                $Type : 'Common.ValueListParameterDisplayOnly',
                ValueListProperty : 'client_name',
            },
            {
                $Type : 'Common.ValueListParameterDisplayOnly',
                ValueListProperty : 'email',
            },
            {
                $Type : 'Common.ValueListParameterDisplayOnly',
                ValueListProperty : 'phone',
            },
        ],
    }
};

annotate service.Invoices with {
    project @Common.ValueList : {
        $Type : 'Common.ValueListType',
        CollectionPath : 'Projects',
        Parameters : [
            {
                $Type : 'Common.ValueListParameterInOut',
                LocalDataProperty : project_ID,
                ValueListProperty : 'ID',
            },
            {
                $Type : 'Common.ValueListParameterDisplayOnly',
                ValueListProperty : 'project_code',
            },
            {
                $Type : 'Common.ValueListParameterDisplayOnly',
                ValueListProperty : 'project_name',
            },
            {
                $Type : 'Common.ValueListParameterDisplayOnly',
                ValueListProperty : 'billing_type',
            },
            {
                $Type : 'Common.ValueListParameterDisplayOnly',
                ValueListProperty : 'start_date',
            },
        ],
    }
};

