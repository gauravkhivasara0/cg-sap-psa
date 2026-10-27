const cds = require('@sap/cds');
const { clearCache } = require('../auth/user-context');
const { assertUnique } = require('../common/unique');

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

module.exports = function registerAdminHandlers(srv) {
  const { Employees, Clients, Departments } = srv.entities;
  const db = cds.entities('psa');

  srv.before(['CREATE', 'UPDATE'], Employees, async req => {
    const d = req.data;
    if (d.email !== undefined) {
      d.email = String(d.email || '').trim().toLowerCase();
      if (!EMAIL.test(d.email)) req.error(400, 'Enter a valid e-mail address (it must match the BTP login e-mail).', 'email');
    }
    if (d.employee_code !== undefined && !String(d.employee_code || '').trim()) req.error(400, 'Employee code is required.', 'employee_code');
    await assertUnique(req, db.Employees, 'email', 'An employee with e-mail');
    await assertUnique(req, db.Employees, 'employee_code', 'Employee code');
  });
  // Role/identity mapping is cached briefly; refresh it after employee changes.
  srv.after(['CREATE', 'UPDATE', 'DELETE'], Employees, () => clearCache());

  srv.before(['CREATE', 'UPDATE'], Clients, async req => {
    const d = req.data;
    if (d.email && !EMAIL.test(String(d.email).trim())) req.error(400, 'Enter a valid client e-mail address.', 'email');
    await assertUnique(req, db.Clients, 'client_code', 'Client code');
  });

  srv.before(['CREATE', 'UPDATE'], Departments, req => assertUnique(req, db.Departments, 'department_name', 'Department'));
};
