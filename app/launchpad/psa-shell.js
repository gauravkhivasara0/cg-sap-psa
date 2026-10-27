// Renders the small PSA header (home link, current user, logout) into #psa-shell.
(function () {
  var LOGOUT = '/do/logout'; // approuter logout endpoint (see app/xs-app.json)
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }
  function render() {
    var el = document.getElementById('psa-shell');
    if (!el) return;
    el.innerHTML = '<a class="psa-brand" href="/launchpad/index.html">&#8592; PSA Home</a>' +
      '<span class="psa-title">' + esc(el.getAttribute('data-title')) + '</span>' +
      '<span class="psa-user" id="psa-user"></span>' +
      '<a href="' + LOGOUT + '">Log out</a>';
    fetch('/odata/v4/user/me()', { credentials: 'same-origin', headers: { Accept: 'application/json' } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (me) { if (me) document.getElementById('psa-user').textContent = me.name; })
      .catch(function () {});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render); else render();
})();
