const cds = require('@sap/cds');

/**
 * Generate a draft T&M invoice and preserve a source link for every billed
 * approved billable timesheet entry.
 *
 * Kept under srv/lib/billing so invoice rules stay separate from the CAP
 * service registration and can be extended for Fixed/Retainer billing.
 */
module.exports = async function generateTimeAndMaterialInvoice({ req, tx, entities, audit }) {
  const { Projects, Budgets, Clients, Timesheets, TimesheetEntries, Invoices, InvoiceLines, InvoiceSourceLinks } = entities;
  const { projectID, periodFrom, periodTo } = req.data;

  if (!projectID || !periodFrom || !periodTo) {
    return req.reject(400, 'Project and invoice period start/end are required.');
  }
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  const isRealDate = value => datePattern.test(String(value)) && !Number.isNaN(Date.parse(String(value) + 'T00:00:00Z')) && new Date(String(value) + 'T00:00:00Z').toISOString().slice(0, 10) === String(value);
  if (!isRealDate(periodFrom) || !isRealDate(periodTo)) {
    return req.reject(400, 'Invoice period dates must be real calendar dates in YYYY-MM-DD format.');
  }
  if (periodTo < periodFrom) {
    return req.reject(400, 'Invoice period end must be on or after its start.');
  }

  const project = await tx.run(cds.ql.SELECT.one.from(Projects).where({ ID: projectID }));
  if (!project) return req.reject(404, 'Project not found.');

  // This increment intentionally implements T&M only. Fixed-fee and Retainer
  // need their own source/period rules and must not be approximated as hourly.
  if (project.billing_type !== 'TM') {
    return req.reject(400, 'Invoice generation currently supports T&M projects only. Fixed and Retainer billing will be implemented separately.');
  }

  const client = await tx.run(cds.ql.SELECT.one.from(Clients).where({ ID: project.client_ID }));
  if (!client) return req.reject(400, 'The project client record could not be found.');

  const budget = await tx.run(cds.ql.SELECT.one.from(Budgets).where({ project_ID: projectID }));
  if (!budget) return req.reject(400, 'Project has no budget and billing rate configured.');
  const configuredRate = Number(budget.billing_rate_hr);
  if (!Number.isFinite(configuredRate) || configuredRate < 0) return req.reject(400, 'The project billing rate must be a valid non-negative number.');
  if (!budget.currency_code || !/^[A-Z]{3}$/.test(budget.currency_code)) {
    return req.reject(400, 'Project budget must have a valid three-letter currency code.');
  }

  const approvedSheets = await tx.run(cds.ql.SELECT.from(Timesheets).where({
    project_ID: projectID,
    status: 'Approved'
  }));
  const sheetIDs = approvedSheets.map(sheet => sheet.ID);
  if (!sheetIDs.length) return req.reject(400, 'No approved timesheets are available for this project.');

  // Filter entries by their actual work date, not the timesheet's week-start
  // date, so invoice period boundaries are applied to the billed work itself.
  const periodEntries = await tx.run(cds.ql.SELECT.from(TimesheetEntries).where({
    timesheet_ID: { in: sheetIDs },
    work_date: { between: [periodFrom, periodTo] },
    is_billable: true
  }));
  if (!periodEntries.length) return req.reject(400, 'No approved billable entries were found in the selected period.');

  const sourceKeys = periodEntries.map(entry => 'TimesheetEntry:' + entry.ID);
  const existingLinks = await tx.run(cds.ql.SELECT.from(InvoiceSourceLinks).where({
    source_key: { in: sourceKeys }
  }));
  const alreadyBilled = new Set(existingLinks.map(link => link.source_key));
  const duplicateKeys = sourceKeys.filter(key => alreadyBilled.has(key));
  if (duplicateKeys.length) {
    return req.reject(409, 'One or more approved time entries have already been linked to an invoice. Refresh the period and resolve existing draft invoices before generating another.');
  }

  const rate = configuredRate;
  const invoiceLines = periodEntries.map(entry => {
    const quantity = Number(entry.hours);
    const lineSubtotal = Math.round(quantity * rate * 100) / 100;
    return {
      entry,
      line: {
        ID: cds.utils.uuid(),
        description: 'Approved time entry ' + entry.ID + ' (' + entry.work_date + ')',
        source_type: 'TimeEntry',
        quantity,
        unit_price: rate,
        line_subtotal: lineSubtotal,
        tax_rate: 0, // TODO(CONFIG): apply an approved tax configuration; zero is provisional, not a tax determination.
        tax_amt: 0, // TODO(CONFIG): calculate tax after jurisdiction/rules are confirmed.
        line_total: lineSubtotal
      }
    };
  });

  const billableHours = invoiceLines.reduce((sum, item) => sum + item.line.quantity, 0);
  const subtotal = Math.round(invoiceLines.reduce((sum, item) => sum + item.line.line_subtotal, 0) * 100) / 100;
  // Tax is left at the schema's provisional zero until an approved tax setup is supplied.
  const taxAmount = 0;
  const total = subtotal + taxAmount;
  const invoiceID = cds.utils.uuid();
  const invoiceDate = new Date().toISOString().slice(0, 10);

  await tx.run(cds.ql.INSERT.into(Invoices).entries({
    ID: invoiceID,
    client_ID: project.client_ID,
    project_ID: projectID,
    invoice_date: invoiceDate,
    period_from: periodFrom,
    period_to: periodTo,
    billable_hours: billableHours,
    subtotal_amt: subtotal,
    total_amt: total,
    tax_amt: taxAmount,
    tax_rate: 0, // TODO(CONFIG): source this from approved tax configuration.
    currency_code: budget.currency_code,
    payment_status: 'Draft',
    client_name_snapshot: client.client_name,
    project_name_snapshot: project.project_name,
    immutable_on_issue: false
  }));

  for (const item of invoiceLines) {
    await tx.run(cds.ql.INSERT.into(InvoiceLines).entries({
      ...item.line,
      invoice_ID: invoiceID
    }));
    await tx.run(cds.ql.INSERT.into(InvoiceSourceLinks).entries({
      ID: cds.utils.uuid(),
      invoiceLine_ID: item.line.ID,
      timesheetEntry_ID: item.entry.ID,
      source_key: 'TimesheetEntry:' + item.entry.ID
    }));
  }

  await audit(req, 'Invoices', invoiceID, 'GENERATE', null, {
    projectID,
    periodFrom,
    periodTo,
    billableHours,
    subtotal,
    taxAmount,
    total,
    lineCount: invoiceLines.length,
    sourceEntryIDs: periodEntries.map(entry => entry.ID)
  });

  return invoiceID;
};
