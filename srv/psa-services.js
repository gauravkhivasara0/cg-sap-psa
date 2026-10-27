const cds = require('@sap/cds');
const audit = require('./audit');
const registerProjectHandlers = require('./projects/handlers');
const registerTimesheetHandlers = require('./timesheets/handlers');
const registerBillingHandlers = require('./billing/handlers');

// This CDS file defines multiple services. Export one implementation per
// service so each domain's handlers are attached only to the owning service.
exports.ProjectService = cds.service.impl(function () {
  const {
    Projects, Budgets, Milestones, Tasks, Timesheets, TimesheetEntries
  } = cds.entities('psa');

  registerProjectHandlers({
    service: this, Projects, Budgets, Milestones, Tasks, Timesheets, TimesheetEntries, audit
  });
  registerTimesheetHandlers({
    service: this,
    serviceName: 'ProjectService',
    Timesheets,
    TimesheetEntries,
    Tasks,
    audit
  });
});

exports.EmployeeService = cds.service.impl(function () {
  const { Timesheets, TimesheetEntries, Tasks } = cds.entities('psa');

  registerTimesheetHandlers({
    service: this,
    serviceName: 'EmployeeService',
    Timesheets,
    TimesheetEntries,
    Tasks,
    audit
  });
});

exports.BillingService = cds.service.impl(function () {
  const {
    Projects, Budgets, Clients, Milestones, Timesheets, TimesheetEntries,
    Invoices, InvoiceLines, InvoiceSourceLinks
  } = cds.entities('psa');

  registerBillingHandlers({
    service: this,
    Projects,
    Budgets,
    Clients,
    Milestones,
    Timesheets,
    TimesheetEntries,
    Invoices,
    InvoiceLines,
    InvoiceSourceLinks,
    audit
  });
});
