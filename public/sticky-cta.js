/* Sticky bottom bar: Try for free | Buy PDF. Every page except login / sign-up. Never in the Android app. */
(function () {
  if (window.Capacitor || document.getElementById('sh-sticky')) return;
  var p = location.pathname.replace(/\/+$/, '');
  if (p === '/signup' || p === '/login' || p === '/forgot-passcode') return;
  var WORKER = 'https://api.studyhelp.fdaytalk.com';
  var css = '[data-trial-slot="banner"]{display:none!important}' +
    'body.sh-sticky-on{padding-bottom:60px}' +
    '#sh-sticky{position:fixed;left:0;right:0;bottom:0;z-index:900;display:flex;gap:10px;padding:8px 14px calc(8px + env(safe-area-inset-bottom));background:#fff;border-top:1px solid #e5e7eb;box-shadow:0 -4px 16px rgba(0,0,0,.08)}' +
    '#sh-sticky a,#sh-sticky button{flex:1;text-align:center;font:600 14px/1 system-ui,sans-serif;padding:11px 8px;border-radius:9px;text-decoration:none;cursor:pointer;border:2px solid #4F46E5}' +
    '#sh-sticky button{background:#4F46E5;color:#fff}' +
    '#sh-sticky a{background:#fff;color:#4F46E5}' +
    '@media (min-width:820px){#sh-sticky{display:none!important}body.sh-sticky-on{padding-bottom:0}}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  function startTrial() {
    try { if (typeof fbq === 'function') fbq('trackCustom', 'TrialButtonClick', { page: 'sticky' }); } catch (e) {}
    if (window.ShTrial) { window.ShTrial.startFlow(null); return; }
    var s = document.createElement('script'); s.src = '/trial.js';
    s.onload = function () { if (window.ShTrial) window.ShTrial.startFlow(null); };
    document.head.appendChild(s);
  }
  function show() {
    if (document.getElementById('sh-sticky')) return;
    var bar = document.createElement('div'); bar.id = 'sh-sticky';
    bar.innerHTML = '<button type="button">Try for free</button><a href="/downloads/">Buy PDF</a>';
    bar.querySelector('button').addEventListener('click', startTrial);
    document.body.appendChild(bar);
    document.body.classList.add('sh-sticky-on');
  }
  fetch(WORKER + '/trial/status', { credentials: 'include' })
    .then(function (r) { return r.json(); })
    .then(function (s) {
      if (!s || !s.enabled) return;
      if (s.logged_in && s.trial_used) return;
      show();
    }).catch(function () {});
})();
