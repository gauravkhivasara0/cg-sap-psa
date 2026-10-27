const cds = require('@sap/cds');
const { SELECT, UPDATE, DELETE } = cds.ql;

/**
 * Invoice lifecycle (FR-011): Draft -> Issued -> Paid, Draft -> Cancelled.
 * Overdue is derived (Issued and past due date). Financial values are frozen on issue.
 */
const isRealDate = v => /^\d{4}-\d{2}-\d{2}$/.test(String(v))
  && new Date(String(v) + 'T00:00:00Z').toISOString().slice(0, 10) === String(v);

const nextInvoiceNumber = async (tx, Invoices, year) => {
  const prefix = `INV-${year}-`;
  const rows = await tx.run(SELECT.from(Invoices).columns('invoice_number').where({ invoice_number: { like: prefix + '%' } }));
  const max = rows.reduce((m, r) => Math.max(m, Number(String(r.invoice_number).slice(prefix.length)) || 0), 0);
  return prefix + String(max + 1).padStart(4, '0');
};

module.exports = {
  async issueInvoice(req, ID, audit) {
    const tx = cds.tx(req);
    const { Invoices, InvoiceLines } = cds.entities('psa');
    const invoice = await tx.run(SELECT.one.from(Invoices).where({ ID }));
    if (!invoice) return req.reject(404, 'Invoice not found.');
    if (invoice.payment_status !== 'Draft') return req.reject(409, 'Only Draft invoices can be issued.');
    const lines = await tx.run(SELECT.from(InvoiceLines).where({ invoice_ID: ID }));
    if (!lines.length) return req.reject(400, 'An invoice must have at least one line before it can be issued.');

    // TODO(CONFIG): 30-day payment term is the MVP default (DEC-010).
    const issuedAt = new Date();
    const due = new Date(issuedAt);
    due.setUTCDate(due.getUTCDate() + 30);
    const values = {
      payment_status: 'Issued',
      invoice_number: invoice.invoice_number || await nextInvoiceNumber(tx, Invoices, issuedAt.getUTCFullYear()),
      invoice_date: issuedAt.toISOString().slice(0, 10),
      due_date: due.toISOString().slice(0, 10),
      issued_at: issuedAt.toISOString(),
      immutable_on_issue: true
    };
    await tx.run(UPDATE(Invoices).set(values).where({ ID }));
    await audit(req, 'Invoices', ID, 'ISSUE', { payment_status: invoice.payment_status }, values);
  },

  async markInvoicePaid(req, ID, audit) {
    const tx = cds.tx(req);
    const { Invoices } = cds.entities('psa');
    const { paymentDate } = req.data;
    if (!isRealDate(paymentDate)) return req.reject(400, 'A valid payment date (YYYY-MM-DD) is required.');
    const invoice = await tx.run(SELECT.one.from(Invoices).where({ ID }));
    if (!invoice) return req.reject(404, 'Invoice not found.');
    if (!['Issued', 'Overdue'].includes(invoice.payment_status)) return req.reject(409, 'Only Issued or Overdue invoices can be marked Paid.');
    if (invoice.invoice_date && paymentDate < invoice.invoice_date) return req.reject(400, 'Payment date cannot be before the invoice date.');
    await tx.run(UPDATE(Invoices).set({ payment_status: 'Paid', paid_at: new Date(paymentDate + 'T00:00:00Z').toISOString() }).where({ ID }));
    await audit(req, 'Invoices', ID, 'PAY', { payment_status: invoice.payment_status }, { payment_status: 'Paid', paymentDate });
  },

  /** Cancel a Draft invoice and release its sources so they can be billed again. */
  async cancelInvoice(req, ID, audit) {
    const tx = cds.tx(req);
    const { Invoices, InvoiceLines, InvoiceSourceLinks, Timesheets, TimesheetEntries } = cds.entities('psa');
    const reason = String(req.data.reason || '').trim();
    if (!reason) return req.reject(400, 'A cancellation reason is required.');
    const invoice = await tx.run(SELECT.one.from(Invoices).where({ ID }));
    if (!invoice) return req.reject(404, 'Invoice not found.');
    if (invoice.payment_status !== 'Draft') return req.reject(409, 'Only Draft invoices can be cancelled; issued invoices need a credit note.');
    const lineIDs = (await tx.run(SELECT.from(InvoiceLines).columns('ID').where({ invoice_ID: ID }))).map(l => l.ID);
    if (lineIDs.length) {
      const links = await tx.run(SELECT.from(InvoiceSourceLinks).columns('timesheetEntry_ID').where({ invoiceLine_ID: { in: lineIDs } }));
      const entryIDs = links.map(l => l.timesheetEntry_ID).filter(Boolean);
      await tx.run(DELETE.from(InvoiceSourceLinks).where({ invoiceLine_ID: { in: lineIDs } }));
      if (entryIDs.length) {
        await tx.run(UPDATE(Timesheets).set({ status: 'Approved' }).where({
          status: 'Invoiced', ID: { in: SELECT.distinct.from(TimesheetEntries).columns('timesheet_ID').where({ ID: { in: entryIDs } }) }
        }));
      }
    }
    await tx.run(UPDATE(Invoices).set({ payment_status: 'Cancelled', cancelled_at: new Date().toISOString(), cancellation_reason: reason }).where({ ID }));
    await audit(req, 'Invoices', ID, 'CANCEL', { payment_status: invoice.payment_status }, { payment_status: 'Cancelled', reason });
  }
};
