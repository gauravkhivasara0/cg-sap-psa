const cds = require('@sap/cds');
const { SELECT, UPDATE } = cds.ql;
const { currentEmployeeID } = require('../common/identity');
const { audit } = require('../common/audit');
const { recalculateProject, round2 } = require('../projects/rollup');
const { notify } = require('../common/notify');

const EDITABLE = ['Draft', 'Rejected'];
const today = () => new Date().toISOString().slice(0, 10);
const addDays = (isoDate, days) => {
  const d = new Date(isoDate + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
const isMonday = isoDate => new Date(isoDate + 'T00:00:00Z').getUTCDay() === 1;
const keyOf = req => {
  const p = req.params?.[0];
  return typeof p === 'object' ? p.ID : p;
};

/**
 * Validates the entries of one timesheet (FRD 7.2):
 * hours 0.25-24 in quarter hours, work date within the week, task of the same
 * project and not Done, no duplicate task/day for the same employee.
 */
const validateEntries = async (req, tx, sheet, entries) => {
  const { Tasks, Milestones, Timesheets, TimesheetEntries } = cds.entities('psa');
  const taskIDs = [...new Set(entries.map(e => e.task_ID).filter(Boolean))];
  const tasks = taskIDs.length ? await tx.run(SELECT.from(Tasks).where({ ID: { in: taskIDs } })) : [];
  const milestoneIDs = [...new Set(tasks.map(t => t.milestone_ID))];
  const milestones = milestoneIDs.length ? await tx.run(SELECT.from(Milestones).where({ ID: { in: milestoneIDs } })) : [];
  const projectOfMilestone = new Map(milestones.map(m => [m.ID, m.project_ID]));
  const taskByID = new Map(tasks.map(t => [t.ID, t]));

  // Other timesheets of the same employee, for duplicate detection across weeks/projects.
  const otherSheets = await tx.run(SELECT.from(Timesheets).columns('ID')
    .where({ employee_ID: sheet.employee_ID, ID: { '!=': sheet.ID } }));
  const otherEntries = otherSheets.length
    ? await tx.run(SELECT.from(TimesheetEntries).columns('task_ID', 'work_date')
      .where({ timesheet_ID: { in: otherSheets.map(s => s.ID) } }))
    : [];
  const seen = new Set(otherEntries.map(e => `${e.task_ID}|${e.work_date}`));

  for (const [i, e] of entries.entries()) {
    const target = `entries[${i}]`;
    const hours = Number(e.hours);
    if (!e.task_ID) req.error(400, 'Every entry needs a task.', target);
    if (!e.work_date) req.error(400, 'Every entry needs a work date.', target);
    if (!Number.isFinite(hours) || hours < 0.25 || hours > 24) req.error(400, 'Entry hours must be between 0.25 and 24.', target);
    else if (Math.round(hours * 4) !== hours * 4) req.error(400, 'Entry hours must use 0.25-hour increments.', target);
    if (e.work_date && sheet.week_start_date && (e.work_date < sheet.week_start_date || e.work_date > sheet.week_end_date)) {
      req.error(400, `Work date ${e.work_date} is outside the timesheet week ${sheet.week_start_date} - ${sheet.week_end_date}.`, target);
    }
    const task = taskByID.get(e.task_ID);
    if (e.task_ID && !task) req.error(400, 'The selected task does not exist.', target);
    if (task) {
      const taskProject = projectOfMilestone.get(task.milestone_ID) || task.project_ID;
      if (sheet.project_ID && taskProject !== sheet.project_ID) req.error(400, `Task "${task.task_name}" does not belong to the timesheet's project.`, target);
      if (task.status === 'Done') req.error(400, `Task "${task.task_name}" is Done; time cannot be recorded against it.`, target);
    }
    const key = `${e.task_ID}|${e.work_date}`;
    if (e.task_ID && e.work_date && seen.has(key)) req.error(409, `Duplicate entry for task "${task?.task_name || e.task_ID}" on ${e.work_date}.`, target);
    seen.add(key);
  }
};

const loadEmployee = (tx, ID) => tx.run(SELECT.one.from(cds.entities('psa').Employees).where({ ID }));

/** EmployeeService: own timesheets (draft-enabled) and the submit action. */
const registerEmployeeHandlers = srv => {
  const { MyTimesheets, MyTimesheetEntries } = srv.entities;

  srv.before('NEW', MyTimesheets.drafts, async req => {
    const employeeID = currentEmployeeID(req);
    if (req.user.attr.employeeActive === false) return req.reject(403, 'Inactive employees cannot log time.');
    req.data.employee_ID = employeeID;
    req.data.status = 'Draft';
    if (!req.data.week_start_date) {
      const now = new Date();
      const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - ((now.getUTCDay() + 6) % 7)));
      req.data.week_start_date = monday.toISOString().slice(0, 10);
    }
    req.data.week_end_date = addDays(req.data.week_start_date, 6);
  });

  srv.before('PATCH', MyTimesheets.drafts, req => {
    if (req.data.week_start_date) req.data.week_end_date = addDays(req.data.week_start_date, 6);
  });

  srv.before('NEW', MyTimesheetEntries.drafts, req => {
    req.data.is_billable ??= true;
  });

  srv.before(['EDIT', 'DELETE'], MyTimesheets, async req => {
    const sheet = await cds.tx(req).run(SELECT.one.from(MyTimesheets).columns('status').where({ ID: keyOf(req) }));
    if (sheet && !EDITABLE.includes(sheet.status)) {
      return req.reject(409, `A ${sheet.status} timesheet cannot be changed; only Draft or Rejected timesheets can.`);
    }
  });

  // Activation of a draft (or a direct API write): validate the whole document.
  srv.before(['CREATE', 'UPDATE'], MyTimesheets, async req => {
    const tx = cds.tx(req);
    const d = req.data;
    const employeeID = currentEmployeeID(req);
    const ID = d.ID || keyOf(req);
    if (req.event === 'UPDATE') {
      const current = await tx.run(SELECT.one.from(cds.entities('psa').Timesheets).where({ ID }));
      if (current && !EDITABLE.includes(current.status)) return req.reject(409, 'Only Draft or Rejected timesheets can be edited.');
      d.status = current?.status || 'Draft';
    } else {
      d.status = 'Draft';
    }
    // Server-controlled fields
    d.employee_ID = employeeID;
    delete d.submitted_date; delete d.approved_date; delete d.approvedBy_ID; delete d.rejection_reason;

    const employee = await loadEmployee(tx, employeeID);
    if (employee && !employee.is_active) return req.reject(403, 'Inactive employees cannot log time.');
    if (!d.project_ID) return req.reject(400, 'Select the project for this timesheet.', 'project_ID');
    if (!d.week_start_date) return req.reject(400, 'Week start date is required.', 'week_start_date');
    if (!isMonday(d.week_start_date)) return req.reject(400, 'Week start date must be a Monday.', 'week_start_date');
    d.week_end_date = addDays(d.week_start_date, 6);

    const entries = d.entries || [];
    await validateEntries(req, tx, { ...d, ID }, entries);
    d.total_billable_hours = round2(entries.filter(e => e.is_billable !== false).reduce((s, e) => s + Number(e.hours || 0), 0));
  });

  srv.on('submitTimesheet', MyTimesheets, async req => {
    const tx = cds.tx(req);
    const ID = keyOf(req);
    const { Timesheets, TimesheetEntries } = cds.entities('psa');
    const sheet = await tx.run(SELECT.one.from(Timesheets).where({ ID, employee_ID: currentEmployeeID(req) }));
    if (!sheet) return req.reject(404, 'Timesheet not found. Save your draft before submitting.');
    if (!EDITABLE.includes(sheet.status)) return req.reject(409, 'Only Draft or Rejected timesheets can be submitted.');
    const employee = await loadEmployee(tx, sheet.employee_ID);
    if (employee && !employee.is_active) return req.reject(403, 'Inactive employees cannot log time.');

    const entries = await tx.run(SELECT.from(TimesheetEntries).where({ timesheet_ID: ID }));
    if (!entries.length) return req.reject(400, 'A timesheet must contain at least one entry.');
    await validateEntries(req, tx, sheet, entries);
    if (req.errors) return req.reject();

    // Daily cap of 24 hours across all of the employee's timesheets.
    const days = [...new Set(entries.map(e => e.work_date))];
    const sameDay = await tx.run(SELECT.from(TimesheetEntries).columns('work_date', 'hours')
      .where({ work_date: { in: days }, timesheet_ID: { in: SELECT.from(Timesheets).columns('ID').where({ employee_ID: sheet.employee_ID }) } }));
    const totals = new Map();
    for (const e of sameDay) totals.set(e.work_date, (totals.get(e.work_date) || 0) + Number(e.hours));
    for (const [day, hours] of totals) {
      if (hours > 24) return req.reject(400, `Daily total exceeds 24 hours on ${day} (${hours} h).`);
    }

    const billable = round2(entries.filter(e => e.is_billable).reduce((s, e) => s + Number(e.hours), 0));
    await tx.run(UPDATE(Timesheets).set({
      status: 'Submitted', submitted_date: today(), total_billable_hours: billable, rejection_reason: null
    }).where({ ID }));
    await audit(req, 'Timesheets', ID, 'SUBMIT', { status: sheet.status }, { status: 'Submitted', total_billable_hours: billable });
    const row = await tx.run(SELECT.one.from(MyTimesheets).where({ ID }));
    return { ...row, IsActiveEntity: true, HasActiveEntity: false, HasDraftEntity: false };
  });
};

/** ProjectService: approval / rejection of timesheets of the manager's projects. */
const registerApprovalHandlers = srv => {
  const { Timesheets } = srv.entities;

  const loadForDecision = async req => {
    const tx = cds.tx(req);
    const managerID = currentEmployeeID(req);
    const sheet = await tx.run(SELECT.one.from(cds.entities('psa').Timesheets).where({ ID: keyOf(req) }));
    if (!sheet) return req.reject(404, 'Timesheet not found.');
    if (sheet.employee_ID === managerID) return req.reject(403, 'You cannot approve or reject your own timesheet.');
    if (sheet.status !== 'Submitted') return req.reject(409, `Only Submitted timesheets can be decided (current status: ${sheet.status}).`);
    return { tx, sheet, managerID };
  };

  srv.on('approveTimesheet', Timesheets, async req => {
    const { tx, sheet, managerID } = await loadForDecision(req);
    await tx.run(UPDATE(cds.entities('psa').Timesheets).set({
      status: 'Approved', approved_date: today(), approvedBy_ID: managerID, rejection_reason: null
    }).where({ ID: sheet.ID }));
    await recalculateProject(tx, sheet.project_ID);
    await notify(tx, {
      recipientID: sheet.employee_ID, eventType: 'TimesheetApproved',
      subject: `Timesheet for week ${sheet.week_start_date} approved`,
      message: `Your timesheet for week ${sheet.week_start_date} was approved by ${req.user.attr.employeeName || req.user.id}.`,
      entity: 'Timesheets', recordID: sheet.ID
    });
    await audit(req, 'Timesheets', sheet.ID, 'APPROVE', { status: sheet.status }, { status: 'Approved', approvedBy_ID: managerID });
    return tx.run(SELECT.one.from(Timesheets).where({ ID: sheet.ID }));
  });

  srv.on('rejectTimesheet', Timesheets, async req => {
    const reason = String(req.data.reason || '').trim();
    if (!reason) return req.reject(400, 'A rejection reason is required.', 'reason');
    const { tx, sheet, managerID } = await loadForDecision(req);
    await tx.run(UPDATE(cds.entities('psa').Timesheets).set({
      status: 'Rejected', rejection_reason: reason, approvedBy_ID: managerID
    }).where({ ID: sheet.ID }));
    await notify(tx, {
      recipientID: sheet.employee_ID, eventType: 'TimesheetRejected',
      subject: `Timesheet for week ${sheet.week_start_date} rejected`,
      message: `Reason: ${reason}`,
      entity: 'Timesheets', recordID: sheet.ID
    });
    await audit(req, 'Timesheets', sheet.ID, 'REJECT', { status: sheet.status }, { status: 'Rejected', reason });
    return tx.run(SELECT.one.from(Timesheets).where({ ID: sheet.ID }));
  });
};

module.exports = { registerEmployeeHandlers, registerApprovalHandlers, validateEntries };
