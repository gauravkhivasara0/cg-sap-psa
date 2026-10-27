const cds = require('@sap/cds');
const { SELECT } = cds.ql;
const { currentEmployeeID } = require('../common/identity');
const { audit } = require('../common/audit');
const { recalculateProject, round2 } = require('./rollup');
const { assertUnique } = require('../common/unique');

const BILLING_TYPES = ['TM', 'Fixed', 'Retainer'];
const PROJECT_STATUSES = ['Draft', 'Active', 'On Hold', 'Completed', 'Cancelled'];
const TASK_STATUSES = ['To Do', 'In Progress', 'Done', 'Blocked'];
const MILESTONE_STATUSES = ['Not Started', 'In Progress', 'Completed', 'Delayed'];
const PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];

const keyOf = req => {
  const p = req.params?.[0];
  return typeof p === 'object' ? p.ID : p;
};

/** Validates a project document including its deep budget / milestones / tasks. */
const validateProject = (req, d) => {
  if (d.project_code !== undefined && !String(d.project_code || '').trim()) req.error(400, 'Project code is required.', 'project_code');
  if (d.start_date && d.end_date && d.end_date < d.start_date) req.error(400, 'Project end date must be on or after start date.', 'end_date');
  if (d.billing_type && !BILLING_TYPES.includes(d.billing_type)) req.error(400, 'Billing type must be TM, Fixed or Retainer.', 'billing_type');
  if (d.status && !PROJECT_STATUSES.includes(d.status)) req.error(400, `Project status must be one of ${PROJECT_STATUSES.join(', ')}.`, 'status');
  if (d.priority && !PRIORITIES.includes(d.priority)) req.error(400, `Priority must be one of ${PRIORITIES.join(', ')}.`, 'priority');

  if (req.event === 'CREATE' && !d.budget) req.error(400, 'A project needs exactly one budget (amount, billing rate, currency).', 'budget');
  if (d.budget) {
    const b = d.budget;
    if (b.budget_amt === undefined || b.budget_amt === null || Number(b.budget_amt) <= 0) req.error(400, 'Budget amount must be greater than zero.', 'budget/budget_amt');
    if (b.billing_rate_hr === undefined || b.billing_rate_hr === null || Number(b.billing_rate_hr) < 0) req.error(400, 'Billing rate per hour is required and cannot be negative.', 'budget/billing_rate_hr');
    if (!b.currency_code || !/^[A-Z]{3}$/.test(b.currency_code)) req.error(400, 'Currency must be a three-letter uppercase ISO code, e.g. USD.', 'budget/currency_code');
  }

  for (const [i, m] of (d.milestones || []).entries()) {
    const target = `milestones[${i}]`;
    if (m.start_date && m.end_date && m.end_date < m.start_date) req.error(400, `Milestone "${m.milestone_name}" ends before it starts.`, target);
    if (m.status && !MILESTONE_STATUSES.includes(m.status)) req.error(400, `Milestone "${m.milestone_name}": invalid status.`, target);
    if (d.start_date && m.start_date && m.start_date < d.start_date) req.error(400, `Milestone "${m.milestone_name}" starts before the project.`, target);
    if (d.end_date && m.end_date && m.end_date > d.end_date) req.error(400, `Milestone "${m.milestone_name}" ends after the project.`, target);
    for (const t of m.tasks || []) {
      if (t.estimated_hours === undefined || t.estimated_hours === null || Number(t.estimated_hours) <= 0) req.error(400, `Task "${t.task_name}": estimated hours must be greater than zero.`, target);
      if (t.start_date && t.end_date && t.end_date < t.start_date) req.error(400, `Task "${t.task_name}" ends before it starts.`, target);
      if (m.start_date && t.start_date && t.start_date < m.start_date) req.error(400, `Task "${t.task_name}" starts before its milestone.`, target);
      if (m.end_date && t.end_date && t.end_date > m.end_date) req.error(400, `Task "${t.task_name}" ends after its milestone.`, target);
      if (t.status && !TASK_STATUSES.includes(t.status)) req.error(400, `Task "${t.task_name}": invalid status.`, target);
    }
  }
};

module.exports = function registerProjectHandlers(srv) {
  const { Projects } = srv.entities;

  // New project drafts belong to the creating manager and start with an empty budget.
  srv.before('NEW', Projects.drafts, req => {
    req.data.manager_ID = currentEmployeeID(req);
    req.data.status ??= 'Active';
    req.data.priority ??= 'Medium';
    req.data.billing_type ??= 'TM';
    req.data.budget ??= { currency_code: 'USD', budget_status: 'Within Budget' };
  });

  srv.before(['CREATE', 'UPDATE'], Projects, async req => {
    const d = req.data;
    await assertUnique(req, cds.entities('psa').Projects, 'project_code', 'Project code');
    if (req.event === 'CREATE') d.manager_ID = currentEmployeeID(req);
    else delete d.manager_ID; // ownership cannot be transferred through the UI
    validateProject(req, d);
    // Tasks carry a denormalised project reference used for queries and alerts.
    const projectID = d.ID || keyOf(req);
    for (const m of d.milestones || []) for (const t of m.tasks || []) t.project_ID = projectID;
    if (d.budget) {
      const consumed = Number(d.budget.consumed_amt || 0);
      d.budget.consumed_amt = consumed;
      d.budget.remaining_amt = round2(Number(d.budget.budget_amt) - consumed);
    }
  });

  srv.after(['CREATE', 'UPDATE'], Projects, async (_, req) => {
    await recalculateProject(cds.tx(req), req.data.ID || keyOf(req));
  });

  srv.on('recalculateBudget', Projects, async req => {
    const projectID = keyOf(req);
    const tx = cds.tx(req);
    const project = await tx.run(SELECT.one.from(Projects).where({ ID: projectID }));
    if (!project) return req.reject(404, 'Project not found.');
    const result = await recalculateProject(tx, projectID);
    await audit(req, 'Budgets', projectID, 'RECALCULATE', result.previous, {
      consumed_amt: result.consumed_amt, remaining_amt: result.remaining_amt, budget_status: result.budget_status
    });
    return tx.run(SELECT.one.from(Projects).where({ ID: projectID }));
  });

  srv.on('getBurnSummary', async req => {
    const { projectID } = req.data;
    // Read through the service so the manager's row-level restriction applies.
    const project = await srv.run(SELECT.one.from(Projects).columns(p => {
      p.ID, p.planned_hours, p.consumed_hours, p.budget(b => { b.budget_amt, b.consumed_amt, b.remaining_amt, b.budget_status, b.currency_code })
    }).where({ ID: projectID }));
    if (!project) return req.reject(404, 'Project not found.');
    const b = project.budget || {};
    return {
      projectID,
      budget_amt: b.budget_amt,
      consumed_amt: b.consumed_amt,
      remaining_amt: b.remaining_amt,
      consumed_pct: Number(b.budget_amt) > 0 ? round2(Number(b.consumed_amt) / Number(b.budget_amt) * 100) : 0,
      planned_hours: project.planned_hours,
      consumed_hours: project.consumed_hours,
      budget_status: b.budget_status,
      currency_code: b.currency_code
    };
  });
};
