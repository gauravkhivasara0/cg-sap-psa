const cds = require('@sap/cds');

module.exports = async function generateRetainerInvoice({ req, tx, entities, audit }) {
  const { Projects, Budgets, Clients, Invoices, InvoiceLines, InvoiceSourceLinks } = entities;
  const { projectID, periodFrom, periodTo } = req.data;
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  const realDate = value => datePattern.test(String(value)) &&
    !Number.isNaN(Date.parse(String(value) + 'T00:00:00Z')) &&
    new Date(String(value) + 'T00:00:00Z').toISOString().slice(0, 10) === String(value);
  if (!realDate(periodFrom) || !realDate(periodTo) || periodTo < periodFrom) {
    return req.reject(400, 'A valid calendar-month invoice period is required.');
  }
  const start = new Date(String(periodFrom) + 'T00:00:00Z');
  const year = start.getUTCFullYear();
  const month = start.getUTCMonth();
  const expectedFrom = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
  const expectedTo = new Date(Date.UTC(year, month + 1, 0)).toISOString().slice(0, 10);
  if (periodFrom !== expectedFrom || periodTo !== expectedTo) {
    return req.reject(400, 'Retainer invoices must cover one complete calendar month.');
  }

  const project = await tx.run(cds.ql.SELECT.one.from(Projects).where({ ID: projectID }));
  if (!project) return req.reject(404, 'Project not found.');
  if (!['RET', 'RETAINER', 'Retainer', 'retainer'].includes(project.billing_type)) {
    return req.reject(400, 'This project is not configured for Retainer billing.');
  }
  const fee = Number(project.retainer_fee_amt);
  if (!Number.isFinite(fee) || fee <= 0) return req.reject(400, 'A positive retainer fee must be configured on the project.');
  const client = await tx.run(cds.ql.SELECT.one.from(Clients).where({ ID: project.client_ID }));
  const budget = await tx.run(cds.ql.SELECT.one.from(Budgets).where({ project_ID: projectID }));
  if (!client || !budget) return req.reject(400, 'The project client and budget currency must be configured.');
  if (!budget.currency_code || !/^[A-Z]{3}$/.test(budget.currency_code)) {
    return req.reject(400, 'Project budget must have a valid three-letter currency code.');
  }

  const sourceKey = 'Retainer:' + projectID + ':' + year + '-' + String(month + 1).padStart(2, '0');
  const existing = await tx.run(cds.ql.SELECT.one.from(InvoiceSourceLinks).where({ source_key: sourceKey }));
  if (existing) return req.reject(409, 'A retainer invoice already exists for this project and calendar month.');

  const invoiceID = cds.utils.uuid();
  const lineID = cds.utils.uuid();
  const amount = Math.round(fee * 100) / 100;
  const invoiceDate = new Date().toISOString().slice(0, 10);
  await tx.run(cds.ql.INSERT.into(Invoices).entries({
    ID: invoiceID, client_ID: project.client_ID, project_ID: projectID,
    invoice_date: invoiceDate, period_from: periodFrom, period_to: periodTo,
    billable_hours: 0, subtotal_amt: amount, tax_amt: 0, tax_rate: 0, total_amt: amount,
    currency_code: budget.currency_code, payment_status: 'Draft',
    client_name_snapshot: client.client_name, project_name_snapshot: project.project_name,
    immutable_on_issue: false
  }));
  await tx.run(cds.ql.INSERT.into(InvoiceLines).entries({
    ID: lineID, invoice_ID: invoiceID, description: 'Monthly retainer (' + year + '-' + String(month + 1).padStart(2, '0') + ')',
    source_type: 'Retainer', quantity: 1, unit_price: amount, line_subtotal: amount,
    tax_rate: 0, tax_amt: 0, line_total: amount
  }));
  await tx.run(cds.ql.INSERT.into(InvoiceSourceLinks).entries({
    ID: cds.utils.uuid(), invoiceLine_ID: lineID, source_key: sourceKey
  }));
  await audit(req, 'Invoices', invoiceID, 'GENERATE_RETAINER', null, {
    projectID, periodFrom, periodTo, amount, sourceKey
  });
  return invoiceID;
};
