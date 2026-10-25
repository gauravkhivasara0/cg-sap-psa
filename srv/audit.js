const cds = require('@sap/cds');

module.exports = async function audit(req, entityName, recordID, action, oldValues, newValues) {
  const { AuditLog } = cds.entities('psa');
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
