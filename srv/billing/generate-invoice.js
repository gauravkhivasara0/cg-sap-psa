const cds = require('@sap/cds');
const { SELECT, INSERT, UPDATE } = cds.ql;
const { round2 } = require('../projects/rollup');

const isRealDate = v => /^\d{4}-\d{2}-\d{2}$/.test(String(v))
  && new Date(String(v) + 'T00:00:00Z').toISOString().slice(0, 10) === String(v);

// TODO(CONFIG): tax is provisional zero until an approved tax configuration exists (DEC-009).
const TAX_RATE = 0;

const line = ({ description, source_type, quantity, unit_price, milestone_ID }) => {
  const subtotal = round2(quantity * unit_price);
  const tax = round2(subtotal * TAX_RATE / 100);
  return {
    ID: cds.utils.uuid(), description, source_type, quantity, unit_price,
    line_subtotal: subtotal, tax_rate: TAX_RATE, tax_amt: tax, line_total: round2(subtotal + tax),
    milestone_ID
  };
};

/** T&M: approved, billable, not yet invoiced entries with work date in the period. */
const timeAndMaterialLines = async (tx, project, budget, periodFrom, periodTo, alreadyBilled) => {
  const { Timesheets, TimesheetEntries, Tasks } = cds.entities('psa');
  const sheets = await tx.run(SELECT.from(Timesheets).columns('ID')
    .where({ project_ID: project.ID, status: { in: ['Approved', 'Invoiced'] } }));
  if (!sheets.length) return [];
  const entries = await tx.run(SELECT.from(TimesheetEntries).where({
    timesheet_ID: { in: sheets.map(s => s.ID) }, work_date: { between: periodFrom, and: periodTo }, is_billable: true
  }).orderBy('work_date'));
  const open = entries.filter(e => !alreadyBilled.has('TimesheetEntry:' + e.ID));
  const tasks = open.length ? await tx.run(SELECT.from(Tasks).columns('ID', 'task_name').where({ ID: { in: [...new Set(open.map(e => e.task_ID))] } })) : [];
  const taskName = new Map(tasks.map(t => [t.ID, t.task_name]));
  return open.map(e => ({
    sourceKey: 'TimesheetEntry:' + e.ID,
    entry: e,
    line: line({
      description: `${taskName.get(e.task_ID) || 'Task'} - ${e.work_date}${e.notes ? ' - ' + e.notes : ''}`.slice(0, 255),
      source_type: 'TimeEntry', quantity: Number(e.hours), unit_price: Number(budget.billing_rate_hr)
    })
  }));
};

/** Fixed: completed, billable milestones with a fee, ending on or before the period end. */
const fixedFeeLines = async (tx, project, periodTo, alreadyBilled) => {
  const { Milestones } = cds.entities('psa');
  const milestones = await tx.run(SELECT.from(Milestones).where({
    project_ID: project.ID, is_billable: true, status: 'Completed', end_date: { '<=': periodTo }
  }));
  return milestones
    .filter(m => Number(m.fixed_fee_amt) > 0 && !alreadyBilled.has('Milestone:' + m.ID))
    .map(m => ({
      sourceKey: 'Milestone:' + m.ID,
      line: line({ description: `Milestone: ${m.milestone_name}`, source_type: 'Milestone', quantity: 1, unit_price: Number(m.fixed_fee_amt), milestone_ID: m.ID })
    }));
};

/** Retainer: one fee line per billing period. */
const retainerLines = (project, periodFrom, periodTo, alreadyBilled) => {
  const key = `Retainer:${project.ID}:${periodFrom}:${periodTo}`;
  if (alreadyBilled.has(key) || !(Number(project.retainer_fee_amt) > 0)) return [];
  return [{
    sourceKey: key,
    line: line({
      description: `Retainer fee ${project.retainer_period || ''} ${periodFrom} - ${periodTo}`.replace(/\s+/g, ' '),
      source_type: 'Retainer', quantity: 1, unit_price: Number(project.retainer_fee_amt)
    })
  }];
};

/**
 * generateInvoice(projectID, periodFrom, periodTo) - FR-010.
 * Builds a Draft invoice from un-invoiced sources according to billing_type and
 * records an InvoiceSourceLink per source so nothing can be billed twice.
 */
module.exports = async function generateInvoice(req) {
  const tx = cds.tx(req);
  const { projectID, periodFrom, periodTo } = req.data;
  const { Projects, Budgets, Clients, Invoices, InvoiceLines, InvoiceSourceLinks, Timesheets, TimesheetEntries } = cds.entities('psa');

  if (!isRealDate(periodFrom) || !isRealDate(periodTo)) return req.reject(400, 'Invoice period dates must be real dates (YYYY-MM-DD).');
  if (periodTo < periodFrom) return req.reject(400, 'Invoice period end must be on or after its start.');

  const project = await tx.run(SELECT.one.from(Projects).where({ ID: projectID }));
  if (!project) return req.reject(404, 'Project not found.');
  const client = await tx.run(SELECT.one.from(Clients).where({ ID: project.client_ID }));
  if (!client) return req.reject(400, 'The project client could not be found.');
  const budget = await tx.run(SELECT.one.from(Budgets).where({ project_ID: projectID }));
  if (!budget) return req.reject(400, 'The project has no budget / billing rate configured.');
  if (!/^[A-Z]{3}$/.test(budget.currency_code || '')) return req.reject(400, 'The project budget needs a valid currency code.');

  // Sources already linked to a (non-cancelled) invoice
  const links = await tx.run(SELECT.from(InvoiceSourceLinks).columns('source_key')
    .where`invoiceLine.invoice.project_ID = ${projectID}`);
  const alreadyBilled = new Set(links.map(l => l.source_key));

  let items;
  if (project.billing_type === 'TM') items = await timeAndMaterialLines(tx, project, budget, periodFrom, periodTo, alreadyBilled);
  else if (project.billing_type === 'Fixed') items = await fixedFeeLines(tx, project, periodTo, alreadyBilled);
  else if (project.billing_type === 'Retainer') items = retainerLines(project, periodFrom, periodTo, alreadyBilled);
  else return req.reject(400, `Unsupported billing type ${project.billing_type}.`);

  if (!items.length) {
    const what = { TM: 'approved, billable, un-invoiced hours', Fixed: 'completed billable milestones that are not yet invoiced', Retainer: 'retainer fee for this period that is not yet invoiced' }[project.billing_type];
    return req.reject(400, `Nothing to invoice: no ${what} in ${periodFrom} - ${periodTo}.`);
  }

  const invoiceID = cds.utils.uuid();
  const subtotal = round2(items.reduce((s, i) => s + i.line.line_subtotal, 0));
  const tax = round2(items.reduce((s, i) => s + i.line.tax_amt, 0));
  const hours = round2(items.filter(i => i.entry).reduce((s, i) => s + i.line.quantity, 0));
  await tx.run(INSERT.into(Invoices).entries({
    ID: invoiceID, client_ID: project.client_ID, project_ID: projectID,
    invoice_date: new Date().toISOString().slice(0, 10), period_from: periodFrom, period_to: periodTo,
    billable_hours: hours, subtotal_amt: subtotal, tax_amt: tax, tax_rate: TAX_RATE, total_amt: round2(subtotal + tax),
    currency_code: budget.currency_code, payment_status: 'Draft',
    client_name_snapshot: client.client_name, project_name_snapshot: project.project_name, immutable_on_issue: false
  }));
  await tx.run(INSERT.into(InvoiceLines).entries(items.map(i => ({ ...i.line, invoice_ID: invoiceID }))));
  await tx.run(INSERT.into(InvoiceSourceLinks).entries(items.map(i => ({
    invoiceLine_ID: i.line.ID, timesheetEntry_ID: i.entry?.ID || null, source_key: i.sourceKey
  }))));

  // Timesheets whose billable entries are now all invoiced become 'Invoiced' (locked).
  const sheetIDs = [...new Set(items.filter(i => i.entry).map(i => i.entry.timesheet_ID))];
  for (const sheetID of sheetIDs) {
    const billable = await tx.run(SELECT.from(TimesheetEntries).columns('ID').where({ timesheet_ID: sheetID, is_billable: true }));
    const linked = await tx.run(SELECT.from(InvoiceSourceLinks).columns('ID')
      .where({ source_key: { in: billable.map(e => 'TimesheetEntry:' + e.ID) } }));
    if (linked.length === billable.length) await tx.run(UPDATE(Timesheets).set({ status: 'Invoiced' }).where({ ID: sheetID }));
  }

  return { invoiceID, lineCount: items.length, subtotal, tax, hours };
};
