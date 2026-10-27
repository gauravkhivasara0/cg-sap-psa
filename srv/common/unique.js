const cds = require('@sap/cds');
const { SELECT } = cds.ql;

/**
 * Case-insensitive uniqueness check (DEC-020) with a readable 409 error.
 * The database unique constraints (@assert.unique) remain the final safety net.
 */
const assertUnique = async (req, entity, field, label) => {
  const value = req.data[field];
  if (value === undefined || value === null || value === '') return;
  const ID = req.data.ID || req.params?.[0]?.ID || req.params?.[0];
  const clash = await cds.tx(req).run(SELECT.one.from(entity).columns('ID')
    .where`lower(${{ ref: [field] }}) = ${String(value).trim().toLowerCase()} and ID != ${ID || ''}`);
  if (clash) req.error(409, `${label} "${value}" already exists.`, field);
};

module.exports = { assertUnique };
