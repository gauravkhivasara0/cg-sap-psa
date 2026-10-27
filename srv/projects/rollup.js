const cds = require('@sap/cds');
const { SELECT, UPDATE } = cds.ql;
const { notifyOnce } = require('../common/notify');

// Timesheet statuses whose hours count as official actuals (DEC-006).
const COUNTED_STATUSES = ['Approved', 'Invoiced'];
const DEFAULT_BUDGET_BANDS = [
  { threshold_pct: 100, severity: 'Breached' },
  { threshold_pct: 90, severity: 'At Risk' },
  { threshold_pct: 75, severity: 'Warning' }
];
const DEFAULT_TASK_BANDS = [
  { threshold_pct: 100, severity: 'Breached' },
  { threshold_pct: 80, severity: 'Warning' }
];

const round2 = n => Math.round(Number(n || 0) * 100) / 100;

const loadBands = async (tx, scope, defaults) => {
  const { ThresholdConfig } = cds.entities('psa');
  const rows = await tx.run(SELECT.from(ThresholdConfig).where({ scope, is_active: true }));
  const bands = rows.length ? rows : defaults;
  return bands.map(b => ({ pct: Number(b.threshold_pct), severity: b.severity })).sort((a, b) => b.pct - a.pct);
};

const bandFor = (bands, pct) => bands.find(b => pct >= b.pct);

/**
 * Recompute Task.actual_hours, Milestone.completion_percent,
 * Project.consumed_hours and the Budget figures/status for one project
 * from approved (or invoiced) timesheet entries, and raise threshold alerts.
 */
const recalculateProject = async (tx, projectID) => {
  const { Projects, Budgets, Milestones, Tasks, Timesheets, TimesheetEntries } = cds.entities('psa');
  const project = await tx.run(SELECT.one.from(Projects).where({ ID: projectID }));
  if (!project) return null;

  const sheets = await tx.run(SELECT.from(Timesheets).columns('ID')
    .where({ project_ID: projectID, status: { in: COUNTED_STATUSES } }));
  const entries = sheets.length
    ? await tx.run(SELECT.from(TimesheetEntries).where({ timesheet_ID: { in: sheets.map(s => s.ID) } }))
    : [];

  // Tasks
  const hoursByTask = new Map();
  for (const e of entries) hoursByTask.set(e.task_ID, (hoursByTask.get(e.task_ID) || 0) + Number(e.hours || 0));
  const milestones = await tx.run(SELECT.from(Milestones).where({ project_ID: projectID }));
  const tasks = milestones.length
    ? await tx.run(SELECT.from(Tasks).where({ milestone_ID: { in: milestones.map(m => m.ID) } }))
    : [];
  const taskBands = await loadBands(tx, 'TaskBurn', DEFAULT_TASK_BANDS);
  for (const t of tasks) {
    const actual = round2(hoursByTask.get(t.ID));
    if (Number(t.actual_hours) !== actual || t.project_ID !== projectID) {
      await tx.run(UPDATE(Tasks).set({ actual_hours: actual, project_ID: projectID }).where({ ID: t.ID }));
    }
    const pct = Number(t.estimated_hours) > 0 ? actual / Number(t.estimated_hours) * 100 : 0;
    const band = bandFor(taskBands, pct);
    if (band) {
      await notifyOnce(tx, {
        recipientID: project.manager_ID,
        eventType: 'TaskBurnThreshold',
        subject: `Task "${t.task_name}" reached ${band.pct}% of its estimate`,
        message: `Task "${t.task_name}" in project ${project.project_code} has ${actual} of ${t.estimated_hours} estimated hours (${round2(pct)}%).`,
        entity: 'Tasks', recordID: t.ID, key: `task:${t.ID}:${band.pct}`
      });
    }
  }

  // Milestones: completion = share of tasks in status Done
  for (const m of milestones) {
    const own = tasks.filter(t => t.milestone_ID === m.ID);
    const pct = own.length ? round2(own.filter(t => t.status === 'Done').length / own.length * 100) : 0;
    if (Number(m.completion_percent) !== pct) {
      await tx.run(UPDATE(Milestones).set({ completion_percent: pct }).where({ ID: m.ID }));
    }
  }

  // Project hours
  const consumedHours = round2(entries.reduce((s, e) => s + Number(e.hours || 0), 0));
  await tx.run(UPDATE(Projects).set({ consumed_hours: consumedHours }).where({ ID: projectID }));

  // Budget: billable approved hours x billing rate
  const budget = await tx.run(SELECT.one.from(Budgets).where({ project_ID: projectID }));
  if (!budget) return { projectID, consumed_hours: consumedHours };
  const billableHours = entries.filter(e => e.is_billable).reduce((s, e) => s + Number(e.hours || 0), 0);
  const consumed = round2(billableHours * Number(budget.billing_rate_hr || 0));
  const remaining = round2(Number(budget.budget_amt) - consumed);
  const pct = Number(budget.budget_amt) > 0 ? consumed / Number(budget.budget_amt) * 100 : 0;
  const budgetBands = await loadBands(tx, 'ProjectBudget', DEFAULT_BUDGET_BANDS);
  const band = bandFor(budgetBands, pct);
  const status = band ? band.severity : 'Within Budget';
  await tx.run(UPDATE(Budgets).set({ consumed_amt: consumed, remaining_amt: remaining, budget_status: status })
    .where({ ID: budget.ID }));
  if (band) {
    await notifyOnce(tx, {
      recipientID: project.manager_ID,
      eventType: 'BudgetThreshold',
      subject: `Project ${project.project_code} budget reached ${band.pct}% (${status})`,
      message: `Consumed ${consumed} of ${budget.budget_amt} ${budget.currency_code} (${round2(pct)}%).`,
      entity: 'Budgets', recordID: budget.ID, key: `budget:${budget.ID}:${band.pct}`
    });
  }

  return {
    projectID,
    budget_amt: Number(budget.budget_amt),
    consumed_amt: consumed,
    remaining_amt: remaining,
    consumed_pct: round2(pct),
    planned_hours: Number(project.planned_hours || 0),
    consumed_hours: consumedHours,
    budget_status: status,
    currency_code: budget.currency_code,
    previous: { consumed_amt: budget.consumed_amt, remaining_amt: budget.remaining_amt, budget_status: budget.budget_status }
  };
};

module.exports = { recalculateProject, COUNTED_STATUSES, round2 };
