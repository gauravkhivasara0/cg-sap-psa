const cds = require('@sap/cds');
const psaUserContext = require('./auth/user-context');

// Resolve the logged-in user's Employee record right after authentication.
cds.middlewares.add(psaUserContext, { after: 'auth' });

module.exports = cds.server;
