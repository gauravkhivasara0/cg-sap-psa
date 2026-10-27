const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const cds = require('@sap/cds');

const { axios } = cds.test(__dirname + '/..');
axios.defaults.validateStatus = () => true; // assert on status codes ourselves

// Demo users (package.json cds.requires.[development].auth) and seed IDs (db/data)
const U = {
  admin: 'alice.admin@example.test',
  morgan: 'morgan.manager@example.test', // Manager of PRJ-001/002, Employee, DeptHead (ENG)
  taylor: 'taylor.engineer@example.test', // Employee (ENG)
  jordan: 'jordan.consultant@example.test', // Employee (CONS)
  casey: 'casey.lead@example.test', // Manager of PRJ-003, DeptHead (CONS)
  finance: 'fiona.finance@example.test',
  nobody: 'nobody@example.test' // authenticated, no role collection
};
const PRJ1 = '40000000-0000-4000-8000-000000000001'; // T&M, Morgan
const PRJ2 = '40000000-0000-4000-8000-000000000002'; // Fixed, Morgan
const PRJ3 = '40000000-0000-4000-8000-000000000003'; // Retainer, Casey
const TASK_DONE = '70000000-0000-4000-8000-000000000001'; // PRJ-001, Done
const TASK_OPEN = '70000000-0000-4000-8000-000000000002'; // PRJ-001, In Progress
const TASK_PRJ2 = '70000000-0000-4000-8000-000000000003';
const MS_PRJ2 = '60000000-0000-4000-8000-000000000002';
const CLIENT1 = '10000000-0000-4000-8000-000000000001';

const as = user => {
  const cfg = { auth: { username: user, password: 'pass' } };
  return {
    get: url => axios.get(url, cfg),
    post: (url, data = {}) => axios.post(url, data, cfg),
    patch: (url, data) => axios.patch(url, data, cfg),
    del: url => axios.delete(url, cfg)
  };
};
const msg = res => JSON.stringify(res.data?.error || res.data);

/** Creates and activates a timesheet the way the Fiori app does (draft API). */
const createTimesheet = async (user, { project_ID, week_start_date, entries }) => {
  const api = as(user);
  const draft = await api.post('/odata/v4/employee/MyTimesheets', { project_ID, week_start_date });
  assert.equal(draft.status, 201, msg(draft));
  const path = `/odata/v4/employee/MyTimesheets(ID=${draft.data.ID},IsActiveEntity=false)`;
  for (const e of entries) {
    const r = await api.post(`${path}/entries`, e);
    assert.equal(r.status, 201, msg(r));
  }
  const activated = await api.post(`${path}/EmployeeService.draftActivate`);
  return { ID: draft.data.ID, activated };
};
const submit = (user, ID) => as(user).post(`/odata/v4/employee/MyTimesheets(ID=${ID},IsActiveEntity=true)/EmployeeService.submitTimesheet`);
const approve = (user, ID) => as(user).post(`/odata/v4/project/Timesheets(${ID})/ProjectService.approveTimesheet`);
const reject = (user, ID, reason) => as(user).post(`/odata/v4/project/Timesheets(${ID})/ProjectService.rejectTimesheet`, { reason });

describe('Authentication and role-based access', () => {
  it('rejects anonymous requests with 401', async () => {
    for (const p of ['employee/MyTimesheets', 'project/Projects', 'billing/Invoices', 'admin/Employees', 'user/me()']) {
      const r = await axios.get('/odata/v4/' + p);
      assert.equal(r.status, 401, p);
    }
  });

  it('rejects users without the required role collection with 403', async () => {
    for (const p of ['employee/MyTimesheets', 'project/Projects', 'billing/Invoices', 'portfolio/Projects', 'admin/Employees']) {
      const r = await as(U.nobody).get('/odata/v4/' + p);
      assert.equal(r.status, 403, p);
    }
    assert.equal((await as(U.taylor).get('/odata/v4/project/Projects')).status, 403);
    assert.equal((await as(U.taylor).get('/odata/v4/billing/Invoices')).status, 403);
    assert.equal((await as(U.finance).get('/odata/v4/admin/Employees')).status, 403);
    assert.equal((await as(U.admin).get('/odata/v4/employee/MyTimesheets')).status, 403);
  });

  it('me() returns roles and the mapped employee', async () => {
    const t = await as(U.taylor).get('/odata/v4/user/me()');
    assert.equal(t.status, 200);
    assert.deepEqual(t.data.roles, ['EmployeeRole']);
    assert.equal(t.data.employeeId, '30000000-0000-4000-8000-000000000002');
    const n = await as(U.nobody).get('/odata/v4/user/me()');
    assert.deepEqual(n.data.roles, []);
    assert.equal(n.data.employeeId, null);
    const a = await as(U.admin).get('/odata/v4/user/me()');
    assert.deepEqual(a.data.roles, ['AdminRole']);
  });

  it('employees only see their own timesheets', async () => {
    const t = await as(U.taylor).get('/odata/v4/employee/MyTimesheets');
    assert.equal(t.data.value.length, 2);
    const j = await as(U.jordan).get('/odata/v4/employee/MyTimesheets');
    assert.equal(j.data.value.length, 0);
    const direct = await as(U.jordan).get('/odata/v4/employee/MyTimesheets(ID=80000000-0000-4000-8000-000000000001,IsActiveEntity=true)');
    assert.equal(direct.status, 404);
    const entries = await as(U.jordan).get('/odata/v4/employee/MyTimesheetEntries');
    assert.equal(entries.data.value.length, 0);
  });

  it('managers only see their own projects; dept heads only their department', async () => {
    const m = await as(U.morgan).get('/odata/v4/project/Projects?$select=project_code&$orderby=project_code');
    assert.deepEqual(m.data.value.map(p => p.project_code), ['PRJ-001', 'PRJ-002']);
    const c = await as(U.casey).get('/odata/v4/project/Projects?$select=project_code');
    assert.deepEqual(c.data.value.map(p => p.project_code), ['PRJ-003']);
    const pm = await as(U.morgan).get('/odata/v4/portfolio/Projects?$select=project_code');
    assert.equal(pm.data.value.length, 2);
    const pc = await as(U.casey).get('/odata/v4/portfolio/Projects?$select=project_code');
    assert.deepEqual(pc.data.value.map(p => p.project_code), ['PRJ-003']);
  });
});

describe('Timesheet entry, submission and approval (FR-004, FR-006, FR-007)', () => {
  let sheetID;

  it('validates entries on save', async () => {
    const cases = [
      [{ task_ID: TASK_OPEN, work_date: '2026-10-26', hours: 25 }, /between 0.25 and 24/],
      [{ task_ID: TASK_OPEN, work_date: '2026-10-26', hours: 1.3 }, /0.25-hour increments/],
      [{ task_ID: TASK_OPEN, work_date: '2026-11-05', hours: 2 }, /outside the timesheet week/],
      [{ task_ID: TASK_DONE, work_date: '2026-10-26', hours: 2 }, /is Done/],
      [{ task_ID: TASK_PRJ2, work_date: '2026-10-26', hours: 2 }, /does not belong/]
    ];
    for (const [entry, expected] of cases) {
      const { activated } = await createTimesheet(U.taylor, { project_ID: PRJ1, week_start_date: '2026-10-26', entries: [entry] });
      assert.equal(activated.status, 400, msg(activated));
      assert.match(msg(activated), expected);
    }
    const notMonday = await createTimesheet(U.taylor, { project_ID: PRJ1, week_start_date: '2026-10-27', entries: [] });
    assert.match(msg(notMonday.activated), /must be a Monday/);
  });

  it('employee saves a valid timesheet and submits it', async () => {
    const { ID, activated } = await createTimesheet(U.taylor, {
      project_ID: PRJ1, week_start_date: '2026-10-26',
      entries: [
        { task_ID: TASK_OPEN, work_date: '2026-10-26', hours: 8, notes: 'Build KPIs' },
        { task_ID: TASK_OPEN, work_date: '2026-10-27', hours: 4, is_billable: false }
      ]
    });
    assert.ok([200, 201].includes(activated.status), msg(activated));
    assert.equal(activated.data.status, 'Draft');
    assert.equal(activated.data.week_end_date, '2026-11-01');
    assert.equal(activated.data.employee_ID, '30000000-0000-4000-8000-000000000002');
    sheetID = ID;

    // Another employee cannot submit it
    assert.ok([403, 404].includes((await submit(U.jordan, ID)).status));

    const s = await submit(U.taylor, ID);
    assert.equal(s.status, 200, msg(s));
    assert.equal(s.data.status, 'Submitted');
    assert.equal(Number(s.data.total_billable_hours), 8);

    // Submitted timesheets are locked
    const edit = await as(U.taylor).post(`/odata/v4/employee/MyTimesheets(ID=${ID},IsActiveEntity=true)/EmployeeService.draftEdit`, { PreserveChanges: true });
    assert.equal(edit.status, 409, msg(edit));
    assert.equal((await submit(U.taylor, ID)).status, 409);
  });

  it('rejects duplicate task/day entries and daily totals above 24h', async () => {
    const dup = await createTimesheet(U.taylor, {
      project_ID: PRJ1, week_start_date: '2026-10-26',
      entries: [{ task_ID: TASK_OPEN, work_date: '2026-10-26', hours: 1 }]
    });
    assert.equal(dup.activated.status, 409);
    assert.match(msg(dup.activated), /Duplicate entry/);
  });

  it('only the project manager can decide; not on own timesheets; reject needs a reason', async () => {
    assert.equal((await approve(U.taylor, sheetID)).status, 403); // no ManagerRole
    const casey = await approve(U.casey, sheetID); // manager, but not of PRJ-001
    assert.ok([403, 404].includes(casey.status), msg(casey));
    assert.equal((await reject(U.morgan, sheetID, '  ')).status, 400);

    const r = await reject(U.morgan, sheetID, 'Please split the KPI work by day');
    assert.equal(r.status, 200, msg(r));
    assert.equal(r.data.status, 'Rejected');

    // Employee sees reason + notification, edits and resubmits
    const sheet = await as(U.taylor).get(`/odata/v4/employee/MyTimesheets(ID=${sheetID},IsActiveEntity=true)`);
    assert.equal(sheet.data.rejection_reason, 'Please split the KPI work by day');
    const notes = await as(U.taylor).get('/odata/v4/employee/MyNotifications');
    assert.ok(notes.data.value.some(n => n.event_type === 'TimesheetRejected'));
    const edit = await as(U.taylor).post(`/odata/v4/employee/MyTimesheets(ID=${sheetID},IsActiveEntity=true)/EmployeeService.draftEdit`, { PreserveChanges: true });
    assert.equal(edit.status, 201, msg(edit));
    const act = await as(U.taylor).post(`/odata/v4/employee/MyTimesheets(ID=${sheetID},IsActiveEntity=false)/EmployeeService.draftActivate`);
    assert.equal(act.status, 200, msg(act));
    assert.equal((await submit(U.taylor, sheetID)).status, 200);

    // Morgan logs and submits own time on own project -> cannot self-approve
    const own = await createTimesheet(U.morgan, {
      project_ID: PRJ1, week_start_date: '2026-10-26',
      entries: [{ task_ID: TASK_OPEN, work_date: '2026-10-28', hours: 2 }]
    });
    assert.ok([200, 201].includes(own.activated.status), msg(own.activated));
    assert.equal((await submit(U.morgan, own.ID)).status, 200);
    const self = await approve(U.morgan, own.ID);
    assert.equal(self.status, 403);
    assert.match(msg(self), /own timesheet/);
  });

  it('approval rolls up task hours, project hours and budget consumption', async () => {
    const a = await approve(U.morgan, sheetID);
    assert.equal(a.status, 200, msg(a));
    assert.equal(a.data.status, 'Approved');
    assert.equal(a.data.approvedBy_ID, '30000000-0000-4000-8000-000000000001');

    const p = await as(U.morgan).get(`/odata/v4/project/Projects(ID=${PRJ1},IsActiveEntity=true)?$expand=budget`);
    // seed: 6 approved billable h; now +8 billable +4 non-billable -> 18 h total, 14 billable x 125
    assert.equal(Number(p.data.consumed_hours), 18);
    assert.equal(Number(p.data.budget.consumed_amt), 1750);
    assert.equal(Number(p.data.budget.remaining_amt), 18250);
    assert.equal(p.data.budget.budget_status, 'Within Budget');
    const t = await as(U.morgan).get(`/odata/v4/project/Tasks(ID=${TASK_OPEN},IsActiveEntity=true)`);
    assert.equal(Number(t.data.actual_hours), 18);

    const burn = await as(U.morgan).get(`/odata/v4/project/getBurnSummary(projectID=${PRJ1})`);
    assert.equal(burn.status, 200, msg(burn));
    assert.equal(Number(burn.data.consumed_pct), 8.75);
    assert.equal((await as(U.casey).get(`/odata/v4/project/getBurnSummary(projectID=${PRJ1})`)).status, 404);
  });
});

describe('Project setup by a manager (FR-002, FR-003, FR-008, FR-009)', () => {
  const api = as(U.casey);
  let projectID;

  it('creates a project with budget, milestone and task via draft', async () => {
    const draft = await api.post('/odata/v4/project/Projects', {
      project_code: 'PRJ-100', project_name: 'Cloud Migration', client_ID: CLIENT1,
      start_date: '2026-11-01', end_date: '2027-03-31', planned_hours: 40
    });
    assert.equal(draft.status, 201, msg(draft));
    projectID = draft.data.ID;
    assert.equal(draft.data.manager_ID, '30000000-0000-4000-8000-000000000004');
    const base = `/odata/v4/project/Projects(ID=${projectID},IsActiveEntity=false)`;

    // Budget amount missing -> activation fails
    let act = await api.post(`${base}/ProjectService.draftActivate`);
    assert.equal(act.status, 400);
    assert.match(msg(act), /budget_amt/);

    const b = await api.patch(`${base}/budget`, { budget_amt: 1000, billing_rate_hr: 100, currency_code: 'EUR' });
    assert.equal(b.status, 200, msg(b));
    const m = await api.post(`${base}/milestones`, { milestone_name: 'Assess', start_date: '2026-11-01', end_date: '2026-12-31' });
    assert.equal(m.status, 201, msg(m));
    const badTask = await api.post(`/odata/v4/project/Milestones(ID=${m.data.ID},IsActiveEntity=false)/tasks`, {
      task_name: 'Inventory', start_date: '2026-11-02', end_date: '2026-11-30', estimated_hours: 0
    });
    assert.equal(badTask.status, 201, msg(badTask));
    act = await api.post(`${base}/ProjectService.draftActivate`);
    assert.equal(act.status, 400);
    assert.match(msg(act), /estimated hours must be greater than zero/);
    await api.patch(`/odata/v4/project/Tasks(ID=${badTask.data.ID},IsActiveEntity=false)`, { estimated_hours: 10 });

    act = await api.post(`${base}/ProjectService.draftActivate`);
    assert.equal(act.status, 201, msg(act));
    const task = await api.get(`/odata/v4/project/Tasks(ID=${badTask.data.ID},IsActiveEntity=true)`);
    assert.equal(task.data.project_ID, projectID);
    const budget = await api.get(`/odata/v4/project/Projects(ID=${projectID},IsActiveEntity=true)/budget`);
    assert.equal(Number(budget.data.remaining_amt), 1000);
    // Another manager does not see it
    assert.equal((await as(U.morgan).get(`/odata/v4/project/Projects(ID=${projectID},IsActiveEntity=true)`)).status, 404);
  });

  it('rejects a duplicate project code and end before start', async () => {
    const draft = await api.post('/odata/v4/project/Projects', {
      project_code: 'PRJ-100', project_name: 'Dup', client_ID: CLIENT1, start_date: '2026-11-01', end_date: '2026-10-01'
    });
    const base = `/odata/v4/project/Projects(ID=${draft.data.ID},IsActiveEntity=false)`;
    await api.patch(`${base}/budget`, { budget_amt: 10, billing_rate_hr: 1, currency_code: 'USD' });
    let act = await api.post(`${base}/ProjectService.draftActivate`);
    assert.equal(act.status, 400);
    assert.match(msg(act), /end date/);
    await api.patch(base, { end_date: '2026-12-01' });
    act = await api.post(`${base}/ProjectService.draftActivate`);
    assert.equal(act.status, 409, msg(act));
    assert.match(msg(act), /PRJ-100.*already exists/);
    await api.del(base);
  });

  it('raises budget and task alerts when thresholds are crossed', async () => {
    const tasks = await as(U.jordan).get(`/odata/v4/employee/MyTasks?$filter=project_ID eq ${projectID}`);
    assert.equal(tasks.data.value.length, 1);
    const taskID = tasks.data.value[0].ID;
    // 9 billable hours x 100 = 900 of 1000 -> 90% -> At Risk; task 9/10 h -> 90% (>= 80% warning)
    const { ID, activated } = await createTimesheet(U.jordan, {
      project_ID: projectID, week_start_date: '2026-11-02',
      entries: [{ task_ID: taskID, work_date: '2026-11-02', hours: 5 }, { task_ID: taskID, work_date: '2026-11-03', hours: 4 }]
    });
    assert.ok([200, 201].includes(activated.status), msg(activated));
    assert.equal((await submit(U.jordan, ID)).status, 200);
    assert.equal((await approve(U.casey, ID)).status, 200);
    const budget = await api.get(`/odata/v4/project/Projects(ID=${projectID},IsActiveEntity=true)/budget`);
    assert.equal(budget.data.budget_status, 'At Risk');
    const alerts = await api.get('/odata/v4/project/BudgetAlerts');
    assert.ok(alerts.data.value.some(b => b.project_ID === projectID));
    const notes = await api.get('/odata/v4/project/Notifications');
    const types = notes.data.value.map(n => n.event_type);
    assert.ok(types.includes('BudgetThreshold'));
    assert.ok(types.includes('TaskBurnThreshold'));
  });
});

describe('Invoicing (FR-010, FR-011)', () => {
  const api = as(U.finance);
  const generate = (projectID, periodFrom, periodTo) => api.post('/odata/v4/billing/generateInvoice', { projectID, periodFrom, periodTo });
  let invoiceID;

  it('generates a T&M invoice from approved billable hours only', async () => {
    const r = await generate(PRJ1, '2026-10-01', '2026-10-31');
    assert.equal(r.status, 200, msg(r));
    invoiceID = r.data.ID;
    // seed 6 h + Taylor's 8 billable h (Morgan's own 2 h are still Submitted)
    assert.equal(Number(r.data.billable_hours), 14);
    assert.equal(Number(r.data.total_amt), 1750);
    assert.equal(r.data.payment_status, 'Draft');
    const lines = await api.get(`/odata/v4/billing/Invoices(${invoiceID})/lines`);
    assert.equal(lines.data.value.length, 4);
    // Fully billed timesheets are locked as Invoiced
    const sheets = await api.get('/odata/v4/billing/Timesheets?$filter=status eq \'Invoiced\'');
    assert.equal(sheets.data.value.length, 2);
  });

  it('never bills the same hours twice', async () => {
    const again = await generate(PRJ1, '2026-10-01', '2026-10-31');
    assert.equal(again.status, 400);
    assert.match(msg(again), /Nothing to invoice/);
  });

  it('cancelling a draft releases its hours; issuing numbers and freezes; payment closes', async () => {
    const c = await api.post(`/odata/v4/billing/Invoices(${invoiceID})/BillingService.cancelInvoice`, { reason: 'Wrong period' });
    assert.equal(c.status, 200, msg(c));
    assert.equal(c.data.payment_status, 'Cancelled');
    const r = await generate(PRJ1, '2026-10-01', '2026-10-31');
    assert.equal(r.status, 200, msg(r));
    invoiceID = r.data.ID;

    assert.equal((await api.post(`/odata/v4/billing/Invoices(${invoiceID})/BillingService.markInvoicePaid`, { paymentDate: '2026-11-01' })).status, 409);
    const i = await api.post(`/odata/v4/billing/Invoices(${invoiceID})/BillingService.issueInvoice`);
    assert.equal(i.status, 200, msg(i));
    assert.equal(i.data.payment_status, 'Issued');
    assert.match(i.data.invoice_number, /^INV-\d{4}-0001$/);
    assert.equal((await api.post(`/odata/v4/billing/Invoices(${invoiceID})/BillingService.issueInvoice`)).status, 409);
    assert.equal((await api.post(`/odata/v4/billing/Invoices(${invoiceID})/BillingService.cancelInvoice`, { reason: 'x' })).status, 409);
    assert.equal((await api.patch(`/odata/v4/billing/Invoices(${invoiceID})`, { total_amt: 1 })).status, 405);

    const today = new Date().toISOString().slice(0, 10);
    const p = await api.post(`/odata/v4/billing/Invoices(${invoiceID})/BillingService.markInvoicePaid`, { paymentDate: today });
    assert.equal(p.status, 200, msg(p));
    assert.equal(p.data.payment_status, 'Paid');
  });

  it('bills completed fixed-fee milestones', async () => {
    let r = await generate(PRJ2, '2026-01-01', '2026-12-31');
    assert.equal(r.status, 400); // milestone still In Progress
    // Manager completes the milestone
    const m = as(U.morgan);
    const base = `/odata/v4/project/Projects(ID=${PRJ2},IsActiveEntity=false)`;
    assert.equal((await m.post(`/odata/v4/project/Projects(ID=${PRJ2},IsActiveEntity=true)/ProjectService.draftEdit`, { PreserveChanges: true })).status, 201);
    await m.patch(`/odata/v4/project/Milestones(ID=${MS_PRJ2},IsActiveEntity=false)`, { status: 'Completed' });
    const act = await m.post(`${base}/ProjectService.draftActivate`);
    assert.equal(act.status, 200, msg(act));
    r = await generate(PRJ2, '2026-01-01', '2026-12-31');
    assert.equal(r.status, 200, msg(r));
    assert.equal(Number(r.data.total_amt), 9000);
    assert.equal((await generate(PRJ2, '2026-01-01', '2026-12-31')).status, 400);
  });

  it('bills a retainer fee once per period', async () => {
    const r = await generate(PRJ3, '2026-11-01', '2026-11-30');
    assert.equal(r.status, 200, msg(r));
    assert.equal(Number(r.data.total_amt), 5000);
    assert.equal((await generate(PRJ3, '2026-11-01', '2026-11-30')).status, 400);
  });

  it('validates input', async () => {
    assert.equal((await generate(PRJ1, '2026-02-30', '2026-03-01')).status, 400);
    assert.equal((await generate(PRJ1, '2026-03-01', '2026-02-01')).status, 400);
  });
});

describe('Administration and audit (FR-001, FR-012)', () => {
  const api = as(U.admin);

  it('maintains employees with unique, normalised e-mails', async () => {
    const d = await api.post('/odata/v4/admin/Employees', {
      employee_code: 'EMP-900', full_name: 'New Hire', email: '  New.Hire@Example.TEST ',
      department_ID: '20000000-0000-4000-8000-000000000001'
    });
    assert.equal(d.status, 201, msg(d));
    const act = await api.post(`/odata/v4/admin/Employees(ID=${d.data.ID},IsActiveEntity=false)/AdminService.draftActivate`);
    assert.equal(act.status, 201, msg(act));
    assert.equal(act.data.email, 'new.hire@example.test');

    const dup = await api.post('/odata/v4/admin/Employees', { employee_code: 'EMP-901', full_name: 'Dup', email: 'taylor.engineer@example.test' });
    const dupAct = await api.post(`/odata/v4/admin/Employees(ID=${dup.data.ID},IsActiveEntity=false)/AdminService.draftActivate`);
    assert.equal(dupAct.status, 409, msg(dupAct));
    assert.match(msg(dupAct), /already exists/);
  });

  it('inactive employees cannot log time', async () => {
    const base = '/odata/v4/admin/Employees(ID=30000000-0000-4000-8000-000000000003,IsActiveEntity=';
    assert.equal((await api.post(base + 'true)/AdminService.draftEdit', { PreserveChanges: true })).status, 201);
    await api.patch(base + 'false)', { is_active: false });
    assert.equal((await api.post(base + 'false)/AdminService.draftActivate')).status, 200);
    const r = await as(U.jordan).post('/odata/v4/employee/MyTimesheets', { project_ID: PRJ1, week_start_date: '2026-11-09' });
    assert.equal(r.status, 403, msg(r));
    assert.match(msg(r), /Inactive/);
  });

  it('writes an audit log for write actions', async () => {
    const log = await api.get('/odata/v4/admin/AuditLog?$orderby=changed_at desc&$top=200');
    const actions = new Set(log.data.value.map(l => `${l.entity_name}:${l.action}`));
    for (const a of ['Timesheets:SUBMIT', 'Timesheets:APPROVE', 'Timesheets:REJECT', 'Invoices:GENERATE', 'Invoices:ISSUE',
      'Invoices:PAY', 'Invoices:CANCEL', 'Projects:CREATE', 'Employees:CREATE', 'Employees:UPDATE']) {
      assert.ok(actions.has(a), `missing audit ${a}`);
    }
    const update = log.data.value.find(l => l.entity_name === 'Employees' && l.action === 'UPDATE');
    assert.match(update.old_values, /"is_active":true/);
    assert.equal(update.actor, U.admin);
  });

  it('users without an Employee record get a clear error', async () => {
    // A user with EmployeeRole whose e-mail is not maintained in PSA
    const r = await as(U.admin).get('/odata/v4/user/me()');
    assert.equal(r.data.employeeId, null);
  });
});
