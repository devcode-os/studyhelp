/*
 * StudyHelp — "Continue with Google"
 *
 * Loaded on /login/, /signup/ and /account/. Self-contained and fail-closed:
 * if anything is missing, blocked or misconfigured, the Google button simply
 * stays hidden and the existing phone + passcode flow is untouched.
 *
 *   Web browser : Google Identity Services button (accounts.google.com/gsi/client)
 *   Android app : native sign-in through the Capacitor plugin
 *                 @capgo/capacitor-social-login. App versions built BEFORE that
 *                 plugin was added don't contain it, so the button stays hidden
 *                 for every user of those versions (new and existing alike).
 *
 * Both paths end the same way: a Google ID token is POSTed to the Worker's
 * /auth/google (or /account/delete for re-confirmation).
 */
(function () {
  'use strict';

  // Web application OAuth client ID (Google Cloud project studyhelp-510307).
  // A client ID is public by design (it is visible in any page that uses Google
  // sign-in); the secret is not used and is not in this repo.
  var GOOGLE_WEB_CLIENT_ID = '939652415017-m6iorineoscivrl5o0o5fqj1c6sekvud.apps.googleusercontent.com';

  // >>>>>>>>>> LAUNCH SWITCH <<<<<<<<<<
  // false = Google button is hidden for everyone EXCEPT a device that opened
  //         /login/?google_preview=1 once (remembered in that browser/app only;
  //         /login/?google_preview=0 turns it off again).
  // true  = Google button is visible to all users (go-live).
  var LIVE = true;
  // >>>>>>>>>> END LAUNCH SWITCH <<<<<<<<<<

  var WORKER_URL = 'https://api.studyhelp.fdaytalk.com';

  // ---------- environment checks ----------
  function isConfigured() {
    return GOOGLE_WEB_CLIENT_ID.indexOf('REPLACE_') === -1;
  }
  // Per-device preview flag (only matters while LIVE is false).
  function previewOn() {
    var param = null;
    try { param = new URLSearchParams(window.location.search).get('google_preview'); } catch (e) {}
    try {
      if (param === '1') window.localStorage.setItem('sh_google_preview', '1');
      else if (param === '0') window.localStorage.removeItem('sh_google_preview');
      return window.localStorage.getItem('sh_google_preview') === '1';
    } catch (e) {
      return param === '1'; // storage blocked: still works for this page view
    }
  }
  function isNativeApp() {
    try {
      var c = window.Capacitor;
      return !!(c && typeof c.isNativePlatform === 'function' && c.isNativePlatform());
    } catch (e) { return false; }
  }
  function nativePluginAvailable() {
    try {
      var c = window.Capacitor;
      return !!(c && typeof c.isPluginAvailable === 'function' && c.isPluginAvailable('SocialLogin'));
    } catch (e) { return false; }
  }
  // Old app builds (Capacitor, but no SocialLogin plugin) cannot sign in with Google.
  // They still show the button; tapping it sends the user to the Play Store to update.
  function isOldApp() {
    return isNativeApp() && !nativePluginAvailable();
  }
  // Usable = configured AND the launch switch / preview flag is on. (Normal browser:
  // web button. App with the plugin: native button. Old app: "update the app" button.)
  function isUsable() {
    if (!isConfigured()) return false;
    if (!LIVE && !previewOn()) return false;
    return true;
  }

  // ---------- old app: send the user to the Play Store ----------
  var PLAY_PACKAGE = 'com.fdaytalk.studyhelp';
  function openPlayStore() {
    try { window.location.href = 'market://details?id=' + PLAY_PACKAGE; } catch (e) {}
    // If the Play Store app didn't take over (page still visible), fall back to the web URL.
    setTimeout(function () {
      try {
        if (!document.hidden) window.open('https://play.google.com/store/apps/details?id=' + PLAY_PACKAGE, '_system');
      } catch (e) {}
    }, 1500);
  }

  // ---------- native (Android app) ----------
  var nativePlugin = null;
  var nativeReady = false;
  function getNativePlugin() {
    if (!nativePlugin) nativePlugin = window.Capacitor.registerPlugin('SocialLogin');
    return nativePlugin;
  }
  async function nativeGetIdToken() {
    var plugin = getNativePlugin();
    if (!nativeReady) {
      await plugin.initialize({ google: { webClientId: GOOGLE_WEB_CLIENT_ID } });
      nativeReady = true;
    }
    // No `scopes`: passing scopes makes the plugin demand a modified MainActivity
    // ("You CANNOT use scopes without modifying the main activity"). The default
    // Credential Manager flow already returns an ID token with email + name.
    var res = await plugin.login({ provider: 'google', options: {} });
    var token = res && res.result && res.result.idToken;
    if (!token) throw new Error('no_id_token');
    return token;
  }

  // ---------- web (Google Identity Services) ----------
  var gisPromise = null;
  var gisInitDone = false;
  var activeCredentialHandler = null;

  function loadGis() {
    if (gisPromise) return gisPromise;
    gisPromise = new Promise(function (resolve, reject) {
      if (window.google && window.google.accounts && window.google.accounts.id) { resolve(); return; }
      var s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true;
      s.defer = true;
      s.onload = function () { resolve(); };
      s.onerror = function () { gisPromise = null; reject(new Error('gis_load_failed')); };
      document.head.appendChild(s);
    });
    return gisPromise;
  }
  function gisInit() {
    if (gisInitDone) return;
    window.google.accounts.id.initialize({
      client_id: GOOGLE_WEB_CLIENT_ID,
      callback: function (resp) {
        if (activeCredentialHandler && resp && resp.credential) activeCredentialHandler(resp.credential);
      },
      ux_mode: 'popup',
      auto_select: false,
      cancel_on_tap_outside: true
    });
    gisInitDone = true;
  }

  // ---------- styles (injected so no page CSS has to change) ----------
  var G_LOGO = '<svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">' +
    '<path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>' +
    '<path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>' +
    '<path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>' +
    '<path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>' +
    '</svg>';

  var stylesInjected = false;
  function injectStyles() {
    if (stylesInjected) return;
    stylesInjected = true;
    var css =
      '.shg-wrap{margin:0 0 4px;}' +
      '.shg-slot{display:flex;justify-content:center;min-height:44px;}' +
      '.shg-slot.shg-busy{opacity:.55;pointer-events:none;}' +
      '.shg-btn{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;padding:11px 14px;' +
      'border-radius:12px;border:1px solid var(--sh2-line,var(--line,#e7e4f5));' +
      'background:var(--sh2-surface,var(--surface,#fff));color:var(--sh2-text,var(--text,#211f38));' +
      'font-family:inherit;font-weight:600;font-size:.92rem;cursor:pointer;}' +
      '.shg-btn:hover:not(:disabled){filter:brightness(.97);}' +
      '.shg-btn:disabled{opacity:.6;cursor:not-allowed;}' +
      '.shg-btn-alt{margin-top:14px;color:var(--sh2-indigo,#4B3FA0);}' +
      '.shg-btn-alt i{font-size:1.05rem;}' +
      '.shg-or{display:flex;align-items:center;gap:12px;margin:16px 0 2px;' +
      'color:var(--sh2-text-soft,var(--muted,#726f92));font-size:.76rem;}' +
      '.shg-or:before,.shg-or:after{content:"";flex:1;height:1px;background:var(--sh2-line,var(--line,#e7e4f5));}' +
      '.shg-note{font-size:.78rem;line-height:1.4;color:var(--sh2-text-soft,var(--muted,#726f92));margin-top:12px;}';
    var el = document.createElement('style');
    el.setAttribute('data-shg', '1');
    el.textContent = css;
    document.head.appendChild(el);
  }

  // ---------- public: render the right Google button into `slot` ----------
  // onIdToken(idToken) is called with a fresh Google ID token once the user
  // finishes. opts.label is used for the native-app button; opts.onError(msg)
  // is called if the native sign-in fails for a reason other than the user
  // cancelling. Returns a promise that rejects if the button can't be shown
  // (e.g. Google script blocked) so the caller can hide its block.
  function mount(slot, onIdToken, opts) {
    opts = opts || {};
    injectStyles();
    slot.innerHTML = '';
    slot.classList.add('shg-slot');

    if (isOldApp()) {
      var ob = document.createElement('button');
      ob.type = 'button';
      ob.className = 'shg-btn';
      ob.innerHTML = G_LOGO + '<span></span>';
      ob.lastChild.textContent = opts.label || 'Continue with Google';
      var note = document.createElement('div');
      note.className = 'shg-note';
      note.style.display = 'none';
      note.textContent = 'Google sign-in needs the latest StudyHelp app. Opening the Play Store - please update the app, then sign in with Google. You can still use your phone number and passcode.';
      ob.addEventListener('click', function () {
        note.style.display = 'block';
        window.ShGoogle.openPlayStore();
      });
      slot.appendChild(ob);
      slot.parentNode.insertBefore(note, slot.nextSibling);
      return Promise.resolve(true);
    }

    if (isNativeApp()) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'shg-btn';
      btn.innerHTML = G_LOGO + '<span></span>';
      btn.lastChild.textContent = opts.label || 'Continue with Google';
      btn.addEventListener('click', async function () {
        if (btn.disabled) return;
        btn.disabled = true;
        try {
          var token = await nativeGetIdToken();
          await onIdToken(token);
        } catch (e) {
          var msg = String((e && (e.message || e.errorMessage)) || e || '');
          if (!/cancel|dismiss|closed|aborted/i.test(msg) && opts.onError) {
            opts.onError('Google sign-in could not start. Please use your phone number and passcode instead.');
          }
        } finally {
          btn.disabled = false;
        }
      });
      slot.appendChild(btn);
      return Promise.resolve(true);
    }

    return loadGis().then(function () {
      gisInit();
      activeCredentialHandler = onIdToken;
      var width = Math.min(400, Math.max(200, slot.clientWidth || 320));
      var dark = document.documentElement.getAttribute('data-theme') === 'dark';
      window.google.accounts.id.renderButton(slot, {
        type: 'standard',
        theme: dark ? 'filled_black' : 'outline',
        size: 'large',
        text: 'continue_with',
        shape: 'rectangular',
        logo_alignment: 'left',
        width: width
      });
      return true;
    });
  }

  // ---------- helpers ----------
  function postJson(path, body) {
    return fetch(WORKER_URL + path, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        return { ok: res.ok, status: res.status, data: data };
      });
    });
  }

  // Only same-site relative paths — never bounce to another origin.
  function safeNext() {
    var n = new URLSearchParams(window.location.search).get('next') || '/';
    if (n.charAt(0) !== '/' || n.charAt(1) === '/' || n.indexOf('\\') !== -1) n = '/';
    return n;
  }

  // Signup page only: with the Google button showing, collapse the phone form
  // behind a "Sign up with phone number" button. Without Google (or if Google
  // fails to load) the full form stays visible, exactly as before.
  function setPhoneFormCollapsed(collapsed) {
    var form = document.getElementById('signup-form');
    var toggle = document.getElementById('phone-signup-toggle');
    if (!form || !toggle) return;
    if (collapsed) {
      form.style.display = 'none';
      toggle.style.display = 'flex';
      if (!toggle.getAttribute('data-bound')) {
        toggle.setAttribute('data-bound', '1');
        toggle.addEventListener('click', function () {
          form.style.display = '';
          toggle.style.display = 'none';
        });
      }
    } else {
      form.style.display = '';
      toggle.style.display = 'none';
    }
  }

  // ---------- login + signup pages ----------
  // Signup page holds the phone form hidden from first paint (class set inline in
  // the page); every path below must release it.
  function releaseHold() {
    document.documentElement.classList.remove('shg-hold');
  }

  function initSignInBlock() {
    var wrap = document.getElementById('google-auth');
    var slot = document.getElementById('google-auth-slot');
    if (!wrap || !slot || !isUsable()) { releaseHold(); return; } // stays hidden

    var errBox = document.getElementById('google-auth-error');
    var errText = document.getElementById('google-auth-error-text');
    function showError(msg) {
      if (errBox && errText) { errText.textContent = msg; errBox.style.display = 'flex'; }
    }
    function setBusy(b) { slot.classList.toggle('shg-busy', !!b); }

    function handleIdToken(idToken) {
      if (errBox) errBox.style.display = 'none';
      setBusy(true);
      return postJson('/auth/google', { id_token: idToken }).then(function (r) {
        if (!r.ok) {
          showError(r.data.error || 'Google sign-in failed. Please try again.');
          setBusy(false);
          return;
        }
        // Clear any stale cached session so the destination page re-checks fresh
        try { sessionStorage.removeItem('sh_session_cache'); } catch (e) {}
        window.location.href = safeNext();
      }).catch(function () {
        showError('Network error. Please check your connection and try again.');
        setBusy(false);
      });
    }

    wrap.style.display = 'block'; // show first so the web button can measure its width
    injectStyles(); // so the toggle button is styled the moment it appears
    setPhoneFormCollapsed(true);
    releaseHold(); // inline styles now keep the form collapsed
    mount(slot, handleIdToken, { label: 'Continue with Google', onError: showError })
      .catch(function () { // Google blocked/offline -> fall back to the full phone form
        wrap.style.display = 'none';
        setPhoneFormCollapsed(false);
        releaseHold();
      });
  }

  window.ShGoogle = { isUsable: isUsable, mount: mount, postJson: postJson, safeNext: safeNext, openPlayStore: openPlayStore };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSignInBlock);
  } else {
    initSignInBlock();
  }
})();
