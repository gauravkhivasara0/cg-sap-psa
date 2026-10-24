const cds = require('@sap/cds');

/**
 * Invoice lifecycle handlers kept separate from CAP service registration.
 * Invoice financial values are protected after issue; configuration-dependent
 * numbering and tax rules are explicitly tracked in docs/open-decisions.md.
 */
module.exports = {
  async issueInvoice({ req, tx, Invoices, InvoiceLines, audit }) {
    const { invoiceID } = req.data;
    const invoice = await tx.run(cds.ql.SELECT.one.from(Invoices).where({ ID: invoiceID }));
    if (!invoice) return req.reject(404, 'Invoice not found.');
    if (invoice.payment_status !== 'Draft') return req.reject(409, 'Only Draft invoices can be issued.');

    const lines = await tx.run(cds.ql.SELECT.from(InvoiceLines).where({ invoice_ID: invoiceID }));
    if (!lines.length) return req.reject(400, 'An invoice must have at least one line before it can be issued.');
    if (!invoice.currency_code || !/^[A-Z]{3}$/.test(invoice.currency_code)) {
      return req.reject(400, 'A valid three-letter invoice currency is required before issue.');
    }
    if (lines.some(line => !Number.isFinite(Number(line.line_total)) || Number(line.line_total) < 0)) {
      return req.reject(400, 'Invoice contains an invalid or negative line total.');
    }

    // TODO(CONFIG): Finance must confirm the 30-calendar-day due-date term.
    // TODO(CONFIG): wire approved tax rules and DB-backed invoice numbering before production issue.
    const issuedAt = new Date();
    const dueDate = new Date(issuedAt);
    dueDate.setUTCDate(dueDate.getUTCDate() + 30);
    const issuedDate = issuedAt.toISOString().slice(0, 10);
    const dueDateString = dueDate.toISOString().slice(0, 10);

    await tx.run(cds.ql.UPDATE(Invoices).set({
      payment_status: 'Issued',
      invoice_date: invoice.invoice_date || issuedDate,
      due_date: dueDateString,
      issued_at: issuedAt.toISOString(),
      immutable_on_issue: true
    }).where({ ID: invoiceID }));

    await audit(req, 'Invoices', invoiceID, 'ISSUE', {
      payment_status: 'Draft', total_amt: invoice.total_amt,
      tax_amt: invoice.tax_amt, currency_code: invoice.currency_code
    }, {
      payment_status: 'Issued', issued_at: issuedAt.toISOString(),
      due_date: dueDateString, immutable_on_issue: true
    });
    return { ID: invoiceID, payment_status: 'Issued', due_date: dueDateString };
  },

  async markInvoicePaid({ req, tx, Invoices, audit }) {
    const { invoiceID, paymentDate } = req.data;
    if (!paymentDate || !/^\d{4}-\d{2}-\d{2}$/.test(String(paymentDate)) || Number.isNaN(Date.parse(String(paymentDate) + 'T00:00:00Z'))) {
      return req.reject(400, 'A valid payment date in YYYY-MM-DD format is required.');
    }
    const txDate = new Date(String(paymentDate) + 'T00:00:00Z');
    if (txDate.toISOString().slice(0, 10) !== String(paymentDate)) {
      return req.reject(400, 'Payment date must be a real calendar date in YYYY-MM-DD format.');
    }

    const invoice = await tx.run(cds.ql.SELECT.one.from(Invoices).where({ ID: invoiceID }));
    if (!invoice) return req.reject(404, 'Invoice not found.');
    if (!['Issued', 'Overdue'].includes(invoice.payment_status)) {
      return req.reject(409, 'Only Issued or Overdue invoices can be marked Paid.');
    }
    await tx.run(cds.ql.UPDATE(Invoices).set({
      payment_status: 'Paid', paid_at: txDate.toISOString()
    }).where({ ID: invoiceID }));
    await audit(req, 'Invoices', invoiceID, 'PAY',
      { payment_status: invoice.payment_status },
      { payment_status: 'Paid', paymentDate: String(paymentDate) });
    return { ID: invoiceID, payment_status: 'Paid' };
  }
};
