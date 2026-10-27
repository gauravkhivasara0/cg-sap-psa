const cds = require('@sap/cds');

module.exports = async function generateFixedFeeInvoice({ req, tx, entities, audit }) {
  const { Projects, Budgets, Clients, Milestones, Invoices, InvoiceLines, InvoiceSourceLinks } = entities;
  const { projectID, periodFrom, periodTo } = req.data;
  const project = await tx.run(cds.ql.SELECT.one.from(Projects).where({ ID: projectID }));
  if (!project) return req.reject(404, 'Project not found.');
  if (!['FIXED', 'Fixed', 'fixed'].includes(project.billing_type)) {
    return req.reject(400, 'This project is not configured for Fixed billing.');
  }
  if (!periodFrom || !periodTo || String(periodTo) < String(periodFrom)) {
    return req.reject(400, 'A valid invoice period start and end are required.');
  }

  const client = await tx.run(cds.ql.SELECT.one.from(Clients).where({ ID: project.client_ID }));
  const budget = await tx.run(cds.ql.SELECT.one.from(Budgets).where({ project_ID: projectID }));
  if (!client || !budget) return req.reject(400, 'The project client and budget currency must be configured.');
  if (!budget.currency_code || !/^[A-Z]{3}$/.test(budget.currency_code)) {
    return req.reject(400, 'Project budget must have a valid three-letter currency code.');
  }

  const milestones = await tx.run(cds.ql.SELECT.from(Milestones).where({
    project_ID: projectID, status: 'Completed', is_billable: true
  }));
  if (!milestones.length) return req.reject(400, 'No Completed, billable milestones are available to invoice.');

  const sourceKeys = milestones.map(item => 'Milestone:' + item.ID);
  const existing = await tx.run(cds.ql.SELECT.from(InvoiceSourceLinks).where({ source_key: { in: sourceKeys } }));
  const billed = new Set(existing.map(item => item.source_key));
  const eligible = milestones.filter(item => !billed.has('Milestone:' + item.ID));
  if (!eligible.length) return req.reject(409, 'All Completed, billable milestones have already been invoiced.');
  if (eligible.some(item => !Number.isFinite(Number(item.fixed_fee_amt)) || Number(item.fixed_fee_amt) <= 0)) {
    return req.reject(400, 'Every eligible milestone must have a configured fee greater than zero.');
  }

  const invoiceID = cds.utils.uuid();
  const invoiceDate = new Date().toISOString().slice(0, 10);
  const lines = eligible.map(milestone => ({
    ID: cds.utils.uuid(),
    milestone,
    sourceKey: 'Milestone:' + milestone.ID,
    description: 'Completed milestone: ' + milestone.milestone_name,
    quantity: 1,
    unit_price: Number(milestone.fixed_fee_amt),
    line_subtotal: Math.round(Number(milestone.fixed_fee_amt) * 100) / 100,
    tax_rate: 0,
    tax_amt: 0,
    line_total: Math.round(Number(milestone.fixed_fee_amt) * 100) / 100
  }));
  const subtotal = Math.round(lines.reduce((sum, line) => sum + line.line_subtotal, 0) * 100) / 100;

  await tx.run(cds.ql.INSERT.into(Invoices).entries({
    ID: invoiceID, client_ID: project.client_ID, project_ID: projectID,
    invoice_date: invoiceDate, period_from: periodFrom, period_to: periodTo,
    billable_hours: 0, subtotal_amt: subtotal, tax_amt: 0, tax_rate: 0, total_amt: subtotal,
    currency_code: budget.currency_code, payment_status: 'Draft',
    client_name_snapshot: client.client_name, project_name_snapshot: project.project_name,
    immutable_on_issue: false
  }));
  for (const line of lines) {
    await tx.run(cds.ql.INSERT.into(InvoiceLines).entries({
      ID: line.ID, invoice_ID: invoiceID, description: line.description,
      source_type: 'Milestone', quantity: line.quantity, unit_price: line.unit_price,
      line_subtotal: line.line_subtotal, tax_rate: line.tax_rate, tax_amt: line.tax_amt,
      line_total: line.line_total, milestone_ID: line.milestone.ID
    }));
    await tx.run(cds.ql.INSERT.into(InvoiceSourceLinks).entries({
      ID: cds.utils.uuid(), invoiceLine_ID: line.ID, source_key: line.sourceKey
    }));
  }
  await audit(req, 'Invoices', invoiceID, 'GENERATE_FIXED', null, {
    projectID, periodFrom, periodTo, subtotal, milestoneIDs: eligible.map(item => item.ID)
  });
  return invoiceID;
};
