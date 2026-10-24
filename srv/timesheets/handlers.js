const cds = require('@sap/cds');
const { SELECT, UPDATE } = cds.ql;

module.exports = function registerTimesheetHandlers({ service, Timesheets, TimesheetEntries, Tasks, audit }) {
  service.before(['CREATE', 'UPDATE'], 'TimesheetEntries', async req => {
    const tx = cds.tx(req);
    const d = req.data;
    const entryID = d.ID || req.params?.[0]?.ID;
    const existing = entryID
      ? await tx.run(SELECT.one.from(TimesheetEntries).where({ ID: entryID }))
      : null;
    const values = { ...(existing || {}), ...d };
    const timesheetID = values.timesheet_ID;
    const taskID = values.task_ID;

    if (values.hours !== undefined &&
        (Number(values.hours) < 0.25 || Number(values.hours) > 24)) {
      req.error(400, 'Entry hours must be between 0.25 and 24.');
    }
    if (values.hours !== undefined &&
        Math.round(Number(values.hours) * 4) !== Number(values.hours) * 4) {
      req.error(400, 'Entry hours must use 0.25-hour increments.');
    }

    const sheet = timesheetID
      ? await tx.run(SELECT.one.from(Timesheets).where({ ID: timesheetID }))
      : null;
    if (!sheet && timesheetID) req.error(400, 'The selected timesheet does not exist.');
    if (sheet) {
      if (!['Draft', 'Rejected'].includes(sheet.status)) {
        req.error(409, 'Only Draft or Rejected timesheets can be edited.');
      }
      if (values.work_date &&
          (values.work_date < sheet.week_start_date || values.work_date > sheet.week_end_date)) {
        req.error(400, 'Work date must fall within the timesheet week.');
      }

      const employee = await tx.run(SELECT.one.from(cds.entities('psa').Employees)
        .where({ ID: sheet.employee_ID }));
      if (employee && !employee.is_active) {
        req.error(409, 'Inactive employees cannot record or edit time.');
      }
    }

    const task = taskID
      ? await tx.run(SELECT.one.from(Tasks).where({ ID: taskID }))
      : null;
    if (!task && taskID) req.error(400, 'The selected task does not exist.');
    if (task?.status === 'Done') {
      req.error(400, 'Time cannot be recorded against a completed task.');
    }
    if (sheet && task && sheet.project_ID !== task.project_ID) {
      req.error(400, 'The task must belong to the same project as the timesheet.');
    }

    // Prevent duplicate entries for the same task and work date. Exclude the
    // current row during updates; rejected timesheets remain editable for correction.
    if (taskID && values.work_date) {
      const sameDayEntries = await tx.run(SELECT.from(TimesheetEntries).where({
        task_ID: taskID,
        work_date: values.work_date
      }));
      const duplicate = sameDayEntries.some(entry => entry.ID !== entryID);
      if (duplicate) {
        req.error(409, 'A time entry already exists for this task and work date.');
      }
    }
  });

  service.on('submitTimesheet', 'EmployeeService', async req => {
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

  service.on('approveTimesheet', 'ProjectService', async req => {
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

  service.on('rejectTimesheet', 'ProjectService', async req => {
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
};
