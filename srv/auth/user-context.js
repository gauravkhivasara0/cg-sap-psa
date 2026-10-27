const cds = require('@sap/cds');
const LOG = cds.log('psa-auth');
const { SELECT } = cds.ql;

// Maps the authenticated user (XSUAA e-mail / user name, or a mocked user id
// locally) to a PSA Employee and exposes the result as user attributes that
// the @restrict where-clauses in srv/psa-services.cds rely on:
//   $user.employeeId, $user.departmentId, $user.isManager
// The lookup is done on the server; nothing is taken from the client request.

const CACHE_TTL_MS = 30 * 1000;
const cache = new Map();

const lookupEmployee = async (keys) => {
  const { Employees } = cds.entities('psa');
  // Use a separate, privileged root transaction so this lookup never interferes
  // with the request's own transaction.
  return cds.tx({ user: new cds.User.Privileged() }, tx => tx.run(
    SELECT.one.from(Employees)
      .columns('ID', 'full_name', 'email', 'department_ID', 'is_manager', 'is_active')
      .where`lower(email) in ${keys}`
  ));
};

const identityKeys = user => [user.attr?.email, user.id]
  .filter(v => typeof v === 'string' && v.includes('@'))
  .map(v => v.trim().toLowerCase());

module.exports = async function psaUserContext(req, res, next) {
  const user = cds.context?.user;
  if (!user || user._is_anonymous || user._is_privileged) return next();
  const keys = [...new Set(identityKeys(user))];
  if (!keys.length) return next();

  try {
    const cacheKey = keys.join('|');
    let hit = cache.get(cacheKey);
    if (!hit || hit.expires < Date.now()) {
      hit = { employee: await lookupEmployee(keys), expires: Date.now() + CACHE_TTL_MS };
      cache.set(cacheKey, hit);
    }
    const emp = hit.employee;
    if (emp) {
      user.attr.employeeId = emp.ID;
      user.attr.departmentId = emp.department_ID;
      user.attr.isManager = !!emp.is_manager;
      user.attr.employeeActive = emp.is_active !== false;
      user.attr.employeeName = emp.full_name;
    } else {
      LOG.debug('No employee record for', keys);
    }
    next();
  } catch (e) {
    LOG.error('Failed to resolve PSA employee for user', user.id, e);
    next(e);
  }
};

module.exports.clearCache = () => cache.clear();
