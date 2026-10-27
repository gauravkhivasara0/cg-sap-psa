sap.ui.define([
    "sap/fe/test/JourneyRunner",
	"com/psa/billing/psabilling/test/integration/pages/InvoicesList.gen",
	"com/psa/billing/psabilling/test/integration/pages/InvoicesObjectPage.gen"
], function (JourneyRunner, InvoicesListGenerated, InvoicesObjectPageGenerated) {
    'use strict';

    const runner = new JourneyRunner({
        launchUrl: sap.ui.require.toUrl('com/psa/billing/psabilling') + '/test/flp.html#app-preview',
        pages: {
			onTheInvoicesListGenerated: InvoicesListGenerated,
			onTheInvoicesObjectPageGenerated: InvoicesObjectPageGenerated
        },
        async: true
    });

    return runner;
});

