const cds = require('@sap/cds');
const { SELECT } = cds.ql;
const { audit } = require('../common/audit');
const generateInvoice = require('./generate-invoice');
const lifecycle = require('./invoice-lifecycle');

const keyOf = req => {
  const p = req.params?.[0];
  return typeof p === 'object' ? p.ID : p;
};

module.exports = function registerBillingHandlers(srv) {
  const { Invoices } = srv.entities;
  const readInvoice = (req, ID) => cds.tx(req).run(SELECT.one.from(Invoices).where({ ID }));

  srv.on('generateInvoice', async req => {
    const result = await generateInvoice(req);
    if (!result) return; // rejected
    await audit(req, 'Invoices', result.invoiceID, 'GENERATE', null, { ...req.data, ...result });
    return readInvoice(req, result.invoiceID);
  });

  for (const action of ['issueInvoice', 'markInvoicePaid', 'cancelInvoice']) {
    srv.on(action, Invoices, async req => {
      const ID = keyOf(req);
      await lifecycle[action](req, ID, audit);
      return readInvoice(req, ID);
    });
  }

  // Overdue is derived on read: Issued and past its due date.
  srv.after('READ', Invoices, rows => {
    const today = new Date().toISOString().slice(0, 10);
    for (const r of Array.isArray(rows) ? rows : [rows]) {
      if (r?.payment_status === 'Issued' && r.due_date && r.due_date < today) r.payment_status = 'Overdue';
    }
  });
};
