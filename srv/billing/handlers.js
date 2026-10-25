const cds = require('@sap/cds');
const { SELECT, UPDATE } = cds.ql;

const generateTimeAndMaterialInvoice = require('./generate-time-and-material-invoice');
const invoiceLifecycle = require('./invoice-lifecycle');

module.exports = function registerBillingHandlers({ service, Projects, Budgets, Clients, Timesheets, TimesheetEntries, Invoices, InvoiceLines, InvoiceSourceLinks, audit }) {
  // Prevent direct edits to issued financial facts; payment updates use a dedicated action.
  service.before('UPDATE', 'Invoices', async req => {
    const tx = cds.tx(req);
    const invoiceID = req.data.ID || req.params?.[0]?.ID;
    if (!invoiceID) return;
    const current = await tx.run(SELECT.one.from(Invoices).where({ ID: invoiceID }));
    if (!current?.immutable_on_issue) return;
    const frozen = ['client_ID', 'project_ID', 'invoice_number', 'invoice_date', 'due_date',
      'period_from', 'period_to', 'billable_hours', 'subtotal_amt', 'total_amt', 'tax_amt',
      'tax_rate', 'currency_code', 'client_name_snapshot', 'project_name_snapshot'];
    if (frozen.some(field => Object.prototype.hasOwnProperty.call(req.data, field))) {
      req.error(409, 'Issued invoice financial details are immutable.');
    }
  });

  service.before(['CREATE', 'UPDATE', 'DELETE'], 'InvoiceLines', async req => {
    const tx = cds.tx(req);
    let invoiceID = req.data?.invoice_ID || req.data?.invoice?.ID || req.params?.[0]?.invoice_ID;
    const lineID = req.data?.ID || req.params?.[0]?.ID;
    if (!invoiceID && lineID) {
      const currentLine = await tx.run(SELECT.one.from(InvoiceLines).where({ ID: lineID }));
      invoiceID = currentLine?.invoice_ID;
    }
    if (!invoiceID) return;
    const invoice = await tx.run(SELECT.one.from(Invoices).where({ ID: invoiceID }));
    if (invoice?.immutable_on_issue) req.error(409, 'Lines belonging to an issued invoice cannot be changed.');
  });

  service.on('generateInvoice', async req => {
    const tx = cds.tx(req);
    return generateTimeAndMaterialInvoice({
      req,
      tx,
      entities: {
        Projects,
        Budgets,
        Clients,
        Timesheets,
        TimesheetEntries,
        Invoices,
        InvoiceLines,
        InvoiceSourceLinks
      },
      audit
    });
  });

  service.on('issueInvoice', async req => invoiceLifecycle.issueInvoice({
    req,
    tx: cds.tx(req),
    Invoices,
    InvoiceLines,
    InvoiceNumberCounter: cds.entities('psa').InvoiceNumberCounter,
    audit
  }));

  service.on('markInvoicePaid', async req => invoiceLifecycle.markInvoicePaid({
    req,
    tx: cds.tx(req),
    Invoices,
    audit
  }));
};
