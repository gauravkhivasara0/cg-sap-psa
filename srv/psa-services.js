const cds = require('@sap/cds');
const { registerAuditTrail } = require('./common/audit');
const registerProjectHandlers = require('./projects/handlers');
const { registerEmployeeHandlers, registerApprovalHandlers } = require('./timesheets/handlers');
const registerBillingHandlers = require('./billing/handlers');
const registerAdminHandlers = require('./admin/handlers');

// Thin registrar: every service in psa-services.cds uses this impl, and the
// domain modules under srv/<domain>/ register the handlers for their service.
const registrars = {
  UserService: srv => srv.on('me', req => {
    const { user } = req;
    return {
      id: user.id,
      email: user.attr.email || (user.id.includes('@') ? user.id : null),
      name: user.attr.employeeName || [user.attr.givenName, user.attr.familyName].filter(Boolean).join(' ') || user.id,
      employeeId: user.attr.employeeId || null,
      departmentId: user.attr.departmentId || null,
      isManager: !!user.attr.isManager,
      roles: ['EmployeeRole', 'ManagerRole', 'FinanceRole', 'DeptHeadRole', 'AdminRole'].filter(r => user.is(r))
    };
  }),
  EmployeeService: registerEmployeeHandlers,
  ProjectService: srv => { registerProjectHandlers(srv); registerApprovalHandlers(srv); },
  BillingService: registerBillingHandlers,
  PortfolioService: () => {},
  AdminService: registerAdminHandlers
};

module.exports = cds.service.impl(function () {
  if (this.name !== 'UserService') registerAuditTrail(this);
  registrars[this.name]?.(this);
});
