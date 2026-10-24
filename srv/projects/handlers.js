const cds = require('@sap/cds');
const { SELECT, UPDATE } = cds.ql;

module.exports = function registerProjectHandlers({ service, Projects, Budgets, Milestones, Tasks, Timesheets, TimesheetEntries, audit }) {
  service.before(['CREATE', 'UPDATE'], 'Projects', req => {
    const d = req.data;
    if (d.project_code !== undefined && !String(d.project_code).trim()) req.error(400, 'Project code is required.');
    if (d.start_date && d.end_date && d.end_date < d.start_date) req.error(400, 'Project end date must be on or after start date.');
    if (d.billing_type && !['Fixed', 'TM', 'Retainer'].includes(d.billing_type)) req.error(400, 'Billing type must be Fixed, TM, or Retainer.');
  });

  service.before(['CREATE', 'UPDATE'], 'Budgets', req => {
    const d = req.data;
    if (d.budget_amt !== undefined && Number(d.budget_amt) <= 0) req.error(400, 'Budget amount must be greater than zero.');
    if (d.billing_rate_hr !== undefined && Number(d.billing_rate_hr) < 0) req.error(400, 'Billing rate cannot be negative.');
    if (d.currency_code && !/^[A-Z]{3}$/.test(d.currency_code)) req.error(400, 'Currency must be a three-letter uppercase ISO currency code.');
  });

  service.before(['CREATE', 'UPDATE'], 'Milestones', req => {
    const d = req.data;
    if (d.start_date && d.end_date && d.end_date < d.start_date) req.error(400, 'Milestone end date must be on or after its start date.');
  });

  service.before(['CREATE', 'UPDATE'], 'Tasks', req => {
    const d = req.data;
    if (d.estimated_hours !== undefined && Number(d.estimated_hours) <= 0) req.error(400, 'Estimated task hours must be greater than zero.');
    if (d.start_date && d.end_date && d.end_date < d.start_date) req.error(400, 'Task end date must be on or after its start date.');
    if (d.status && !['To Do', 'In Progress', 'Done', 'Blocked'].includes(d.status)) req.error(400, 'Invalid task status.');
  });

  service.on('recalculateBudget', 'ProjectService', async req => {
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
};
