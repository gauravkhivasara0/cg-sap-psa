const cds = require('@sap/cds');

module.exports = cds.service.impl(async function () {
  const { Projects, Budgets, Milestones, Tasks, Timesheets, TimesheetEntries, Invoices, AuditLog } = cds.entities('psa');

  const audit = async (req, entityName, recordID, action, oldValues, newValues) => {
    const tx = cds.tx(req);
    await tx.run(INSERT.into(AuditLog).entries({
      entity_name: entityName,
      record_id: String(recordID || ''),
      action,
      actor: req.user?.id || 'unknown',
      changed_at: new Date().toISOString(),
      old_values: oldValues ? JSON.stringify(oldValues) : null,
      new_values: newValues ? JSON.stringify(newValues) : null
    }));
  };

  this.before(['CREATE', 'UPDATE'], 'Projects', req => {
    const d = req.data;
    if (d.project_code !== undefined && !String(d.project_code).trim()) req.error(400, 'Project code is required.');
    if (d.start_date && d.end_date && d.end_date < d.start_date) req.error(400, 'Project end date must be on or after start date.');
    if (d.billing_type && !['Fixed', 'TM', 'Retainer'].includes(d.billing_type)) req.error(400, 'Billing type must be Fixed, TM, or Retainer.');
  });

  this.before(['CREATE', 'UPDATE'], 'Budgets', req => {
    const d = req.data;
    if (d.budget_amt !== undefined && Number(d.budget_amt) <= 0) req.error(400, 'Budget amount must be greater than zero.');
    if (d.billing_rate_hr !== undefined && Number(d.billing_rate_hr) < 0) req.error(400, 'Billing rate cannot be negative.');
    if (d.currency_code && !/^[A-Z]{3}$/.test(d.currency_code)) req.error(400, 'Currency must be a three-letter uppercase ISO currency code.');
  });

  this.before(['CREATE', 'UPDATE'], 'Milestones', req => {
    const d = req.data;
    if (d.start_date && d.end_date && d.end_date < d.start_date) req.error(400, 'Milestone end date must be on or after its start date.');
  });

  this.before(['CREATE', 'UPDATE'], 'Tasks', req => {
    const d = req.data;
    if (d.estimated_hours !== undefined && Number(d.estimated_hours) <= 0) req.error(400, 'Estimated task hours must be greater than zero.');
    if (d.start_date && d.end_date && d.end_date < d.start_date) req.error(400, 'Task end date must be on or after its start date.');
    if (d.status && !['To Do', 'In Progress', 'Done', 'Blocked'].includes(d.status)) req.error(400, 'Invalid task status.');
  });

  this.before(['CREATE', 'UPDATE'], 'TimesheetEntries', async req => {
    const d = req.data;
    if (d.hours !== undefined && (Number(d.hours) < 0.25 || Number(d.hours) > 24)) req.error(400, 'Entry hours must be between 0.25 and 24.');
    if (d.hours !== undefined && Math.round(Number(d.hours) * 4) !== Number(d.hours) * 4) req.error(400, 'Entry hours must use 0.25-hour increments.');
    if (d.work_date && d.timesheet_ID) {
      const sheet = await SELECT.one.from(Timesheets).where({ ID: d.timesheet_ID });
      if (sheet && (d.work_date < sheet.week_start_date || d.work_date > sheet.week_end_date)) {
        req.error(400, 'Work date must fall within the timesheet week.');
      }
      if (sheet && sheet.status !== 'Draft') req.error(409, 'Only Draft timesheets can be edited.');
    }
    if (d.task_ID) {
      const task = await SELECT.one.from(Tasks).where({ ID: d.task_ID });
      if (task?.status === 'Done') req.error(400, 'Time cannot be recorded against a completed task.');
    }
  });

  this.on('submitTimesheet', 'EmployeeService', async req => {
    const { timesheetID } = req.data;
    const tx = cds.tx(req);
    const sheet = await tx.run(SELECT.one.from(Timesheets).where({ ID: timesheetID }));
    if (!sheet) return req.reject(404, 'Timesheet not found.');
    if (sheet.status !== 'Draft' && sheet.status !== 'Rejected') return req.reject(409, 'Only Draft or Rejected timesheets can be submitted.');
    const entries = await tx.run(SELECT.from(TimesheetEntries).where({ timesheet_ID: timesheetID }));
    if (!entries.length) return req.reject(400, 'A timesheet must contain at least one entry.');
    const totals = new Map();
    for (const entry of entries) {
      const day = String(entry.work_date);
      totals.set(day, (totals.get(day) || 0) + Number(entry.hours));
    }
    for (const [day, hours] of totals) {
      if (hours > 24) return req.reject(400, 'Daily total exceeds 24 hours on ' + day + '.');
    }
    const billable = entries.filter(e => e.is_billable).reduce((sum, e) => sum + Number(e.hours), 0);
    await tx.run(UPDATE(Timesheets).set({
      status: 'Submitted',
      submitted_date: new Date().toISOString().slice(0, 10),
      total_billable_hours: billable,
      rejection_reason: null
    }).where({ ID: timesheetID }));
    await audit(req, 'Timesheets', timesheetID, 'SUBMIT', { status: sheet.status }, { status: 'Submitted', total_billable_hours: billable });
    return { ID: timesheetID, status: 'Submitted', total_billable_hours: billable };
  });

  this.on('approveTimesheet', 'ProjectService', async req => {
    const { timesheetID } = req.data;
    const tx = cds.tx(req);
    const sheet = await tx.run(SELECT.one.from(Timesheets).where({ ID: timesheetID }));
    if (!sheet) return req.reject(404, 'Timesheet not found.');
    if (sheet.status !== 'Submitted') return req.reject(409, 'Only Submitted timesheets can be approved.');
    await tx.run(UPDATE(Timesheets).set({
      status: 'Approved',
      approved_date: new Date().toISOString().slice(0, 10),
      approvedBy_ID: req.user?.attr?.managerId || null
    }).where({ ID: timesheetID }));
    await audit(req, 'Timesheets', timesheetID, 'APPROVE', { status: sheet.status }, { status: 'Approved' });
    return { ID: timesheetID, status: 'Approved' };
  });

  this.on('rejectTimesheet', 'ProjectService', async req => {
    const { timesheetID, reason } = req.data;
    if (!reason || !String(reason).trim()) return req.reject(400, 'A rejection reason is required.');
    const tx = cds.tx(req);
    const sheet = await tx.run(SELECT.one.from(Timesheets).where({ ID: timesheetID }));
    if (!sheet) return req.reject(404, 'Timesheet not found.');
    if (sheet.status !== 'Submitted') return req.reject(409, 'Only Submitted timesheets can be rejected.');
    await tx.run(UPDATE(Timesheets).set({ status: 'Rejected', rejection_reason: String(reason).trim() }).where({ ID: timesheetID }));
    await audit(req, 'Timesheets', timesheetID, 'REJECT', { status: sheet.status }, { status: 'Rejected', reason: String(reason).trim() });
    return { ID: timesheetID, status: 'Rejected' };
  });

  this.on('recalculateBudget', 'ProjectService', async req => {
    const { budgetID } = req.data;
    const tx = cds.tx(req);
    const budget = await tx.run(SELECT.one.from(Budgets).where({ ID: budgetID }));
    if (!budget) return req.reject(404, 'Budget not found.');

    // Official actuals use Approved timesheet entries only. Draft, Submitted and
    // Rejected entries are intentionally excluded until approval is complete.
    const projectSheets = await tx.run(SELECT.from(Timesheets).where({
      project_ID: budget.project_ID,
      status: 'Approved'
    }));
    const sheetIDs = projectSheets.map(sheet => sheet.ID);
    const approvedEntries = sheetIDs.length
      ? await tx.run(SELECT.from(TimesheetEntries).where({
          timesheet_ID: { in: sheetIDs }
        }))
      : [];

    const approvedBillableEntries = approvedEntries.filter(entry => entry.is_billable);
    const approvedHours = approvedBillableEntries.reduce(
      (sum, entry) => sum + Number(entry.hours || 0), 0
    );
    const consumed = approvedHours * Number(budget.billing_rate_hr || 0);
    const remaining = Number(budget.budget_amt) - consumed;
    const pct = Number(budget.budget_amt) > 0
      ? consumed / Number(budget.budget_amt) * 100
      : 0;

    // Accepted defaults: <75% Within Budget; 75-<90% Warning;
    // 90-<100% At Risk; >=100% Breached.
    const status = pct >= 100
      ? 'Breached'
      : pct >= 90
        ? 'At Risk'
        : pct >= 75
          ? 'Warning'
          : 'Within Budget';

    await tx.run(UPDATE(Budgets).set({
      consumed_amt: consumed,
      remaining_amt: remaining,
      budget_status: status
    }).where({ ID: budgetID }));

    // Keep task actual hours consistent with the same approved-only rule.
    const projectTasks = await tx.run(SELECT.from(Tasks).where({
      project_ID: budget.project_ID
    }));
    const hoursByTask = new Map();
    for (const entry of approvedEntries) {
      const taskID = entry.task_ID;
      hoursByTask.set(taskID, (hoursByTask.get(taskID) || 0) + Number(entry.hours || 0));
    }
    for (const task of projectTasks) {
      await tx.run(UPDATE(Tasks).set({
        actual_hours: hoursByTask.get(task.ID) || 0
      }).where({ ID: task.ID }));
    }

    await audit(req, 'Budgets', budgetID, 'RECALCULATE', {
      consumed_amt: budget.consumed_amt,
      remaining_amt: budget.remaining_amt,
      budget_status: budget.budget_status
    }, {
      consumed_amt: consumed,
      remaining_amt: remaining,
      budget_status: status,
      approved_billable_hours: approvedHours
    });

    return {
      ID: budgetID,
      consumed_amt: consumed,
      remaining_amt: remaining,
      budget_status: status
    };
  });

  this.on('generateInvoice', 'BillingService', async req => {
    const { projectID, periodFrom, periodTo } = req.data;
    if (periodTo < periodFrom) return req.reject(400, 'Invoice period end must be on or after its start.');
    const tx = cds.tx(req);
    const project = await tx.run(SELECT.one.from(Projects).where({ ID: projectID }));
    if (!project) return req.reject(404, 'Project not found.');
    const sheets = await tx.run(SELECT.from(Timesheets).where({
      project_ID: projectID, status: 'Approved',
      week_start_date: { between: [periodFrom, periodTo] }
    }));
    if (!sheets.length) return req.reject(400, 'No approved timesheets found for the selected period.');
    const sheetIDs = sheets.map(s => s.ID);
    const entries = await tx.run(SELECT.from(TimesheetEntries).where({ timesheet_ID: { in: sheetIDs }, is_billable: true }));
    if (!entries.length) return req.reject(400, 'No billable entries are available for invoicing.');
    const hours = entries.reduce((sum, e) => sum + Number(e.hours), 0);
    const budget = await tx.run(SELECT.one.from(Budgets).where({ project_ID: projectID }));
    if (!budget) return req.reject(400, 'Project has no budget and billing rate configured.');
    const subtotal = hours * Number(budget.billing_rate_hr);
    const invoiceID = cds.utils.uuid();
    await tx.run(INSERT.into(Invoices).entries({
      ID: invoiceID, client_ID: project.client_ID, project_ID: projectID,
      invoice_date: new Date().toISOString().slice(0, 10),
      billable_hours: hours, total_amt: subtotal, tax_amt: 0,
      currency_code: budget.currency_code, payment_status: 'Draft'
    }));
    await audit(req, 'Invoices', invoiceID, 'GENERATE', null, { projectID, hours, subtotal });
    return invoiceID;
  });

  this.on('issueInvoice', 'BillingService', async req => {
    const { invoiceID } = req.data;
    const tx = cds.tx(req);
    const invoice = await tx.run(SELECT.one.from(Invoices).where({ ID: invoiceID }));
    if (!invoice) return req.reject(404, 'Invoice not found.');
    if (invoice.payment_status !== 'Draft') return req.reject(409, 'Only Draft invoices can be issued.');
    await tx.run(UPDATE(Invoices).set({ payment_status: 'Issued', issued_at: new Date().toISOString() }).where({ ID: invoiceID }));
    await audit(req, 'Invoices', invoiceID, 'ISSUE', { payment_status: 'Draft' }, { payment_status: 'Issued' });
    return { ID: invoiceID, payment_status: 'Issued' };
  });

  this.on('markInvoicePaid', 'BillingService', async req => {
    const { invoiceID, paymentDate } = req.data;
    const tx = cds.tx(req);
    const invoice = await tx.run(SELECT.one.from(Invoices).where({ ID: invoiceID }));
    if (!invoice) return req.reject(404, 'Invoice not found.');
    if (!['Issued', 'Overdue'].includes(invoice.payment_status)) return req.reject(409, 'Only Issued or Overdue invoices can be marked Paid.');
    await tx.run(UPDATE(Invoices).set({ payment_status: 'Paid', paid_at: new Date(paymentDate).toISOString() }).where({ ID: invoiceID }));
    await audit(req, 'Invoices', invoiceID, 'PAY', { payment_status: invoice.payment_status }, { payment_status: 'Paid', paymentDate });
    return { ID: invoiceID, payment_status: 'Paid' };
  });
});
