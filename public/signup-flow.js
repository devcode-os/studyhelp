/* Trial sign-up: Google + ONE box (email or phone), then one field at a time. Trial mode only. */
(function () {
  var root = document.documentElement;
  var params = new URLSearchParams(location.search);
  var nextUrl = params.get('next') || '/';
  var trialMode = root.classList.contains('sh-trial-signup');
  var buyMode = !trialMode && /[?&](ca_)?buy=/.test(nextUrl);
  if (!trialMode && !buyMode) return;
  root.classList.add('sh-flow');
  var WORKER = 'https://api.studyhelp.fdaytalk.com';
  var anchor = document.getElementById('google-auth') || document.getElementById('signup-heading');
  if (!anchor) return;
  var inApp = !!window.Capacitor;

  var st = document.createElement('style');
  st.textContent =
    'html.sh-flow #signup-form,html.sh-flow .alt-action,html.sh-flow .shg-or,html.sh-flow #phone-signup-toggle{display:none!important}' +
    '#sh-ef{margin-top:20px}#sh-ef .ef-or{text-align:center;color:#8a8aa0;font-size:12px;margin:4px 0 18px}' +
    '#sh-ef .ef-stage{overflow:hidden}' +
    '#sh-ef .ef-step{animation:efIn .25s ease}#sh-ef .ef-step.back{animation:efBack .25s ease}' +
    '@keyframes efIn{from{opacity:0;transform:translateX(36px)}to{opacity:1;transform:none}}' +
    '@keyframes efBack{from{opacity:0;transform:translateX(-36px)}to{opacity:1;transform:none}}' +
    '#sh-ef .ef-label{font-size:14px;font-weight:600;margin:0 0 8px;color:#1c1a38}' +
    '#sh-ef .ef-dots{display:flex;gap:5px;margin:0 0 12px}#sh-ef .ef-dots i{flex:1;height:4px;border-radius:2px;background:#dcdcec}#sh-ef .ef-dots i.on{background:#4F46E5}' +
    '#sh-ef input{width:100%;box-sizing:border-box;border:1px solid #cfcfe0;border-radius:10px;padding:12px;font-size:15px;margin:0 0 16px;background:#fff;color:#1c1a38}' +
    '#sh-ef input.ef-code{letter-spacing:6px;text-align:center;font-size:18px}' +
    '#sh-ef .ef-btn{width:100%;border:0;border-radius:10px;padding:13px;font-size:15px;font-weight:600;background:#4F46E5;color:#fff;cursor:pointer}' +
    '#sh-ef .ef-btn[disabled]{opacity:.6}' +
    '#sh-ef .ef-msg{font-size:13px;color:#b42318;margin:0 0 14px;display:none}#sh-ef .ef-msg.info{color:#3b3a6e}' +
    '#sh-ef .ef-link{background:none;border:0;color:#4F46E5;font-size:12.5px;text-decoration:underline;cursor:pointer;padding:0;margin-top:14px;display:inline-block}' +
    '#sh-ef .ef-trust{font-size:12px;color:#27500a;background:#eaf3de;border-radius:8px;padding:7px;text-align:center;font-weight:600;margin-top:22px}' +
    '#sh-ef .ef-play{display:flex;align-items:center;gap:12px;margin-top:16px;background:#111;color:#fff;border-radius:12px;padding:12px 14px;text-decoration:none}' +
    '#sh-ef .ef-play b{display:block;font-size:13px;line-height:1.3;color:#fff}#sh-ef .ef-play span{font-size:11px;color:#ccc}' +
    '#sh-ef .ef-playcap{font-size:12.5px;color:#55557a;text-align:center;margin-top:16px}#sh-ef .ef-badge{background:none;padding:0;margin-top:6px;height:58px;overflow:hidden;justify-content:center;align-items:center}#sh-ef .ef-badge img{height:128px;width:auto;max-width:none;flex:none;display:block}' +
    '#sh-ef .ef-tri{width:0;height:0;border-left:17px solid #34a853;border-top:10px solid transparent;border-bottom:10px solid transparent;flex:none}';
  document.head.appendChild(st);

  var box = document.createElement('div');
  box.id = 'sh-ef';
  box.innerHTML =
    '<div class="ef-or" id="ef-or">or</div>' +
    '<div class="ef-stage" id="ef-stage"></div>' +
    '<div class="ef-trust">\u2713 100% ad-free \u00b7 Website + Android app</div>' +
    (inApp ? '' : '<div class="ef-playcap">Install the StudyHelp app for quick, fast access</div><a class="ef-play ef-badge" href="https://play.google.com/store/apps/details?id=com.fdaytalk.studyhelp"><img src="/google-play-badge.png" alt="Get it on Google Play" onerror="var a=this.parentNode;a.classList.remove(\'ef-badge\');a.innerHTML=\'<i class=&quot;ef-tri&quot;></i><div><span>Also on Google Play</span><b>Install the StudyHelp app</b></div>\';"></a>');
  anchor.parentNode.insertBefore(box, anchor.nextSibling);

  function syncOr() {
    var g = document.getElementById('google-auth');
    var vis = g && getComputedStyle(g).display !== 'none' && getComputedStyle(g).visibility !== 'hidden';
    document.getElementById('ef-or').style.display = vis ? '' : 'none';
  }
  [300, 1200, 4300].forEach(function (t) { setTimeout(syncOr, t); }); syncOr();

  var stage = document.getElementById('ef-stage');
  var vals = {}, seq = null, idx = 0, mode = 'start'; // mode: start | login | register

  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function post(path, data) {
    return fetch(WORKER + path, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, status: r.status, d: j }; }); });
  }
  function isGmail(v) { return /^[^\s@]+@(gmail|googlemail)\.com$/i.test(v); }
  function emailOk(v) { return trialMode ? isGmail(v) : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }
  var EMAIL_ERR = trialMode ? 'Please enter a Gmail address (name@gmail.com), or tap Continue with Google.' : 'Please enter a valid email address';
  var DOTS = '\u2022\u2022\u2022\u2022\u2022\u2022';

  var S = {
    email: { k: 'email', label: trialMode ? 'Your Gmail address' : 'Your email address', type: 'email', ph: trialMode ? 'you@gmail.com' : 'you@example.com', ac: 'email',
      check: function (v) { return emailOk(v) ? '' : EMAIL_ERR; } },
    phone: { k: 'phone', label: 'Your phone number', type: 'tel', ph: '10-digit mobile number', ac: 'tel', digits: 10,
      check: function (v) { return v.length === 10 ? '' : 'Enter a 10-digit phone number'; } },
    newpass: { k: 'passcode', label: 'Create a 6-digit passcode', type: 'password', ph: DOTS, ac: 'new-password', digits: 6, code: true,
      check: function (v) { return v.length === 6 ? '' : 'Passcode must be 6 digits'; } },
    confirm: { k: 'confirm', label: 'Confirm your passcode', type: 'password', ph: DOTS, ac: 'new-password', digits: 6, code: true,
      check: function (v) { return v === vals.passcode ? '' : 'Passcodes do not match'; } },
    pass: { k: 'passcode', label: 'Enter your 6-digit passcode', type: 'password', ph: DOTS, ac: 'current-password', digits: 6, code: true,
      check: function (v) { return v.length === 6 ? '' : 'Enter your 6-digit passcode'; } }
  };
  var START = { k: 'id', label: 'Email or phone number', type: 'text', ph: 'Email or phone number', ac: 'username', start: true };

  function render(back) {
    var s = mode === 'start' ? START : seq[idx];
    var last = mode !== 'start' && idx === seq.length - 1;
    stage.innerHTML = '';
    var w = el('div', 'ef-step' + (back ? ' back' : ''));
    if (mode === 'register') { var dots = el('div', 'ef-dots'); seq.forEach(function (_, i) { dots.appendChild(el('i', i <= idx ? 'on' : '')); }); w.appendChild(dots); }
    w.appendChild(el('p', 'ef-label', s.label));
    var inp = el('input', s.code ? 'ef-code' : ''); inp.type = s.type; inp.placeholder = s.ph; inp.setAttribute('autocomplete', s.ac);
    if (s.digits) { inp.inputMode = 'numeric'; inp.maxLength = s.digits; }
    if (s.k === 'email') inp.inputMode = 'email';
    inp.value = vals[s.k] || '';
    inp.addEventListener('input', function () {
      var v = inp.value;
      if (s.start) { if (/[a-z@]/i.test(v)) return; }
      if (s.start || s.k === 'phone') { var d = v.replace(/\D/g, ''); if (/^\+?91/.test(v.trim()) && d.length > 10) d = d.slice(2); v = d.slice(0, 10); }
      else if (s.digits) v = v.replace(/\D/g, '').slice(0, s.digits);
      if (v !== inp.value) inp.value = v;
    });
    var m = el('div', 'ef-msg');
    var b = el('button', 'ef-btn', mode === 'start' ? 'Continue' : last ? (mode === 'register' ? (trialMode ? 'Start free trial' : 'Create account & continue') : (trialMode ? 'Log in & start trial' : 'Log in & continue')) : 'Next'); b.type = 'button';
    w.appendChild(inp); w.appendChild(m); w.appendChild(b);
    if (mode !== 'start') {
      var bk = el('button', 'ef-link', '\u2190 Back');
      bk.type = 'button';
      bk.addEventListener('click', function () { vals[s.k] = inp.value.trim(); if (idx > 0) { idx--; render(true); } else { mode = 'start'; render(true); } });
      w.appendChild(bk);
    }
    if (mode === 'login' && s.k === 'passcode') { var fg = el('a', 'ef-link', 'Forgot passcode?'); fg.href = '/forgot-passcode/'; fg.style.marginLeft = '16px'; w.appendChild(fg); }
    stage.appendChild(w);
    function showMsg(t, info) { m.textContent = t || ''; m.className = 'ef-msg' + (info ? ' info' : ''); m.style.display = t ? 'block' : 'none'; }
    function go() {
      var v = inp.value.trim();
      if (s.start) return lookup(v, b, showMsg);
      vals[s.k] = v;
      var err = s.check(v);
      if (err) { showMsg(err); return; }
      showMsg('');
      if (!last) { idx++; render(false); return; }
      submit(b, showMsg);
    }
    b.addEventListener('click', go);
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); go(); } });
    setTimeout(function () { try { inp.focus(); } catch (e) {} }, 60);
  }

  function lookup(v, b, showMsg) {
    if (!v) { showMsg('Enter your email or phone number'); return; }
    var isEmail = /[a-z@]/i.test(v);
    if (isEmail && !emailOk(v)) { showMsg(EMAIL_ERR); return; }
    if (!isEmail && v.replace(/\D/g, '').length !== 10) { showMsg('Enter a 10-digit phone number'); return; }
    var label = b.textContent; b.disabled = true; b.textContent = 'Please wait...'; showMsg('');
    post('/auth/lookup', { identifier: v }).then(function (r) {
      b.disabled = false; b.textContent = label;
      var d = r.d || {};
      if (!r.ok) { showMsg(d.error || 'Something went wrong. Please try again.'); return; }
      if (d.google) { showMsg('This email is registered with Google. Tap Continue with Google above.', true); return; }
      vals = isEmail ? { email: v.toLowerCase() } : { phone: v.replace(/\D/g, '') };
      idx = 0;
      if (d.exists) { mode = 'login'; seq = isEmail ? [S.phone, S.pass] : [S.pass]; }
      else { mode = 'register'; seq = isEmail ? [S.phone, S.newpass, S.confirm] : [S.email, S.newpass, S.confirm]; }
      render(false);
    }).catch(function () { b.disabled = false; b.textContent = label; showMsg('Network error. Please check your connection.'); });
  }

  function submit(b, showMsg) {
    var label = b.textContent; b.disabled = true; b.textContent = 'Please wait...';
    var req = mode === 'register'
      ? post('/signup', { name: vals.email.split('@')[0].slice(0, 40), phone: vals.phone, recovery_email: vals.email.toLowerCase(), passcode: vals.passcode, confirm_passcode: vals.confirm })
      : post('/login', { phone: vals.phone, passcode: vals.passcode });
    req.then(function (r) {
      if (!r.ok) {
        b.disabled = false; b.textContent = label;
        var msg = (r.d && r.d.error) || 'Something went wrong. Please try again.';
        if (mode === 'register' && r.status === 409) msg = 'This phone number already has an account. Go back and enter it in the first box to log in.';
        showMsg(msg); return;
      }
      b.textContent = 'Starting your trial...';
      try { sessionStorage.removeItem('sh_session_cache'); } catch (e) {}
      setTimeout(function () { location.href = nextUrl; }, 400);
    }).catch(function () { b.disabled = false; b.textContent = label; showMsg('Network error. Please check your connection.'); });
  }

  render(false);
})();
