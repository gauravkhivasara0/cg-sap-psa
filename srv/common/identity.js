/**
 * Returns the Employee ID of the logged-in user, or rejects the request when
 * the user has no Employee record (their BTP e-mail is not maintained in PSA).
 */
const currentEmployeeID = req => {
  const id = req.user?.attr?.employeeId;
  if (!id) {
    return req.reject(403, `User '${req.user?.id}' is not registered as a PSA employee. ` +
      'An administrator must create an Employee whose e-mail equals your login e-mail.');
  }
  return id;
};

module.exports = { currentEmployeeID };
