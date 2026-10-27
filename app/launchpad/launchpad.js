// PSA launchpad: shows one tile group per role the user holds (role collections
// PSA_Employee, PSA_Manager, PSA_Finance, PSA_DeptHead, PSA_Admin).
(function () {
  var GROUPS = [
    { role: 'EmployeeRole', title: 'Employee', needsEmployee: true, tiles: [
      { href: '/timesheets/webapp/index.html', title: 'My Timesheets', sub: 'Log time and submit weekly',
        kpi: "/odata/v4/employee/MyTimesheets/$count?$filter=status eq 'Rejected'", kpiLabel: 'rejected' }
    ] },
    { role: 'ManagerRole', title: 'Project Manager', needsEmployee: true, tiles: [
      { href: '/approvals/webapp/index.html', title: 'Approve Timesheets', sub: 'Approve or reject submitted time',
        kpi: "/odata/v4/project/Timesheets/$count?$filter=status eq 'Submitted'", kpiLabel: 'pending' },
      { href: '/projects/webapp/index.html', title: 'Manage Projects', sub: 'Projects, budgets, milestones, tasks',
        kpi: "/odata/v4/project/Projects/$count?$filter=status eq 'Active'", kpiLabel: 'active' },
      { href: '/projects/webapp/index.html', title: 'At-Risk Budgets', sub: 'Budgets at 75 % or more',
        kpi: '/odata/v4/project/BudgetAlerts/$count', kpiLabel: 'budgets' }
    ] },
    { role: 'FinanceRole', title: 'Finance', tiles: [
      { href: '/invoices/webapp/index.html', title: 'Billing Workbench', sub: 'Generate, issue and track invoices',
        kpi: "/odata/v4/billing/Invoices/$count?$filter=payment_status eq 'Draft'", kpiLabel: 'drafts' }
    ] },
    { role: 'DeptHeadRole', title: 'Department Head', needsEmployee: true, tiles: [
      { href: '/portfolio/webapp/index.html', title: 'Department Portfolio', sub: 'Projects and budget health',
        kpi: '/odata/v4/portfolio/Projects/$count', kpiLabel: 'projects' }
    ] },
    { role: 'AdminRole', title: 'Administration', tiles: [
      { href: '/employees/webapp/index.html', title: 'Employees', sub: 'Map BTP users to employees', kpi: '/odata/v4/admin/Employees/$count?$filter=IsActiveEntity eq true', kpiLabel: 'employees' },
      { href: '/clients/webapp/index.html', title: 'Clients', sub: 'Customer master data', kpi: '/odata/v4/admin/Clients/$count?$filter=IsActiveEntity eq true', kpiLabel: 'clients' },
      { href: '/departments/webapp/index.html', title: 'Departments', sub: 'Organisational units', kpi: '/odata/v4/admin/Departments/$count?$filter=IsActiveEntity eq true', kpiLabel: 'departments' }
    ] }
  ];

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function message(kind, text) {
    document.getElementById('lp-messages').appendChild(el('div', 'lp-msg ' + kind, text));
  }

  function tile(t) {
    var a = el('a', 'lp-tile');
    a.href = t.href;
    var head = el('div');
    head.appendChild(el('div', 'lp-tile-title', t.title));
    head.appendChild(el('div', 'lp-tile-sub', t.sub));
    a.appendChild(head);
    if (t.kpi) {
      var kpi = el('div', 'lp-tile-kpi', ' ');
      a.appendChild(kpi);
      fetch(encodeURI(t.kpi), { credentials: 'same-origin' })
        .then(function (r) { return r.ok ? r.text() : null; })
        .then(function (n) {
          if (n == null) return;
          kpi.textContent = n;
          kpi.appendChild(el('small', null, t.kpiLabel));
        }).catch(function () {});
    }
    return a;
  }

  fetch('/odata/v4/user/me()', { credentials: 'same-origin', headers: { Accept: 'application/json' } })
    .then(function (r) {
      if (!r.ok) throw new Error('Could not read your user (' + r.status + ').');
      return r.json();
    })
    .then(function (me) {
      document.getElementById('lp-user').textContent = me.email || me.id;
      document.getElementById('lp-greeting').textContent = 'Welcome, ' + me.name;
      var roles = me.roles || [];
      document.getElementById('lp-roles').textContent = roles.length
        ? 'Your PSA roles: ' + roles.map(function (r) { return r.replace('Role', ''); }).join(', ')
        : '';
      if (!roles.length) {
        message('err', 'You are logged in as ' + (me.email || me.id) + ' but have no PSA role. ' +
          'Ask your BTP administrator to assign one of the role collections PSA_Employee, PSA_Manager, ' +
          'PSA_Finance, PSA_DeptHead or PSA_Admin to your user (BTP Cockpit > Security > Users), then log out and in again.');
        return;
      }
      var needsEmployee = GROUPS.some(function (g) { return g.needsEmployee && roles.indexOf(g.role) >= 0; });
      if (needsEmployee && !me.employeeId) {
        message('warn', 'Your user ' + (me.email || me.id) + ' is not registered as a PSA employee, so timesheets and projects stay empty. ' +
          'A PSA administrator must create an Employee with exactly this e-mail address.');
      }
      var groups = document.getElementById('lp-groups');
      GROUPS.filter(function (g) { return roles.indexOf(g.role) >= 0; }).forEach(function (g) {
        groups.appendChild(el('h2', null, g.title));
        var grid = el('div', 'lp-tiles');
        g.tiles.forEach(function (t) { grid.appendChild(tile(t)); });
        groups.appendChild(grid);
      });
    })
    .catch(function (e) {
      document.getElementById('lp-greeting').textContent = 'PSA';
      message('err', e.message);
    });
})();
