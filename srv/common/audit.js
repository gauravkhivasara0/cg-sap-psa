const cds = require('@sap/cds');
const { SELECT, INSERT } = cds.ql;

/** Append one row to the audit log within the request's transaction. */
const audit = async (req, entityName, recordID, action, oldValues, newValues) => {
  const { AuditLog } = cds.entities('psa');
  await cds.tx(req).run(INSERT.into(AuditLog).entries({
    entity_name: entityName,
    record_id: String(recordID || ''),
    action,
    actor: req.user?.id || 'unknown',
    changed_at: new Date().toISOString(),
    old_values: oldValues ? JSON.stringify(oldValues) : null,
    new_values: newValues ? JSON.stringify(newValues) : null
  }));
};

/**
 * Log every CREATE / UPDATE / DELETE on the active entities of a service
 * (FR-012). Draft edits are not logged; their activation is (as CREATE/UPDATE).
 */
const registerAuditTrail = srv => {
  const keyOf = (req, result) => req.data?.ID || req.params?.[req.params.length - 1]?.ID
    || req.params?.[req.params.length - 1] || result?.ID;

  srv.before(['UPDATE', 'DELETE'], '*', async req => {
    if (!req.target || req.target.name.endsWith('.drafts') || !req.subject) return;
    req._auditOld = await cds.tx(req).run(SELECT.one.from(req.subject));
  });
  srv.after(['CREATE', 'UPDATE', 'DELETE'], '*', async (result, req) => {
    if (!req.target || req.target.name.endsWith('.drafts')) return;
    const entity = req.target.name.split('.').pop();
    const newValues = req.event === 'DELETE' ? null : req.data;
    await audit(req, entity, keyOf(req, result), req.event, req._auditOld || null, newValues);
  });
};

module.exports = { audit, registerAuditTrail };
