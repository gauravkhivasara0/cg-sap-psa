const cds = require('@sap/cds');
const registerProjectHandlers = require('./projects/handlers');
const registerTimesheetHandlers = require('./timesheets/handlers');
const registerBillingHandlers = require('./billing/handlers');

module.exports = cds.service.impl(async function () {
  const {
    Projects,
    Budgets,
    Clients,
    Milestones,
    Tasks,
    Timesheets,
    TimesheetEntries,
    Invoices,
    InvoiceLines,
    InvoiceSourceLinks,
    AuditLog
  } = cds.entities('psa');

  // Shared audit helper. Domain handlers receive it as a dependency so audit
  // persistence stays consistent while business rules live in domain modules.
  const audit = async (req, entityName, recordID, action, oldValues, newValues) => {
    const tx = cds.tx(req);
    await tx.run(cds.ql.INSERT.into(AuditLog).entries({
      entity_name: entityName,
      record_id: String(recordID || ''),
      action,
      actor: req.user?.id || 'unknown',
      changed_at: new Date().toISOString(),
      old_values: oldValues ? JSON.stringify(oldValues) : null,
      new_values: newValues ? JSON.stringify(newValues) : null
    }));
  };

  registerProjectHandlers({
    service: this, Projects, Budgets, Milestones, Tasks, Timesheets, TimesheetEntries, audit
  });
  registerTimesheetHandlers({
    service: this, Timesheets, TimesheetEntries, Tasks, audit
  });
  registerBillingHandlers({
    service: this, Projects, Budgets, Clients, Timesheets, TimesheetEntries,
    Invoices, InvoiceLines, InvoiceSourceLinks, audit
  });
});
