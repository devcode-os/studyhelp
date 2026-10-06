/*
 * StudyHelp \u2014 3-day free trial (UI)
 *
 * One shared script. Pages only add an empty marker element and load this file:
 *
 *   <div data-trial-slot="banner"></div>                    home, /subjects/, /plans/, /account/
 *   <div data-trial-slot="subject" data-subject="slug">     subject page hero
 *   <div data-trial-slot="auth-note" data-variant="login|signup">   login / signup
 *
 * Everything is driven by the Worker's GET /trial/status. While the Worker
 * secret TRIAL_ENABLED is not "true" that answers {enabled:false}, every slot
 * stays empty and the site looks exactly as it did before this script existed.
 * Fail-closed: any error = nothing is shown.
 *
 * The trial itself (3 days, one subject, one per Google account) is enforced by
 * the Worker. This file only shows state and calls /trial/start.
 *
 * LOCAL PREVIEW (localhost only, never honoured on the live site):
 *   ?trial_preview=off | out | needgmail | unverified | available | active | ended
 *   optional: &trial_subject=<subject-slug> for active / ended
 * Preview mocks the status only; nothing is started and nothing is written.
 */
(function () {
  'use strict';
  if (window.ShTrial) return;

  var WORKER_URL = 'https://api.studyhelp.fdaytalk.com';
  var FALLBACK_PRICE = '\u20b9199'; // shown only if /subjects/public can't be read

  var host = window.location.hostname;
  var isLocal = host === 'localhost' || host === '127.0.0.1';
  var qs = new URLSearchParams(window.location.search);
  var preview = isLocal ? qs.get('trial_preview') : null;

  // ---------- small helpers ----------
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function nowSec() { return Math.floor(Date.now() / 1000); }

  function leftText(expires) {
    var s = expires - nowSec();
    if (s <= 0) return 'ended';
    var d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
    if (d > 0) return d + ' day' + (d > 1 ? 's' : '') + ' ' + h + ' hr' + (h === 1 ? '' : 's') + ' left';
    if (h > 0) return h + ' hr' + (h === 1 ? '' : 's') + ' ' + m + ' min left';
    return Math.max(1, m) + ' min left';
  }
  function whenText(sec) {
    try {
      return new Date(sec * 1000).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
    } catch (e) { return ''; }
  }

  function api(method, path, body) {
    return fetch(WORKER_URL + path, {
      method: method,
      credentials: 'include',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        return { ok: res.ok, status: res.status, data: data };
      });
    });
  }

  // ---------- data ----------
  function mockStatus(kind) {
    var t = nowSec();
    var sub = qs.get('trial_subject') || 'indian-history-en';
    if (kind === 'off') return { enabled: false };
    if (kind === 'out') return { enabled: true, logged_in: false };
    var base = { enabled: true, logged_in: true, trial_seconds: 259200 };
    if (kind === 'nogoogle' || kind === 'needgmail') return Object.assign(base, { has_google: false, email_state: 'need_gmail', trial_used: false, trial: null });
    if (kind === 'unverified') return Object.assign(base, { has_google: false, email_state: 'unverified', trial_used: false, trial: null });
    if (kind === 'active') {
      return Object.assign(base, { has_google: true, email_state: 'ok', trial_used: true,
        trial: { subject_id: sub, started_at: t - 68 * 3600, expires_at: t + 2 * 86400 + 4 * 3600, active: true } });
    }
    if (kind === 'ended') {
      return Object.assign(base, { has_google: true, email_state: 'ok', trial_used: true,
        trial: { subject_id: sub, started_at: t - 3 * 86400 - 3600, expires_at: t - 3600, active: false } });
    }
    return Object.assign(base, { has_google: true, email_state: 'ok', trial_used: false, trial: null }); // 'available'
  }

  var statusPromise = null;
  function getStatus(force) {
    if (statusPromise && !force) return statusPromise;
    if (preview) {
      statusPromise = Promise.resolve(mockStatus(preview));
    } else {
      statusPromise = api('GET', '/trial/status').then(function (r) {
        return r.ok ? r.data : { enabled: false };
      }).catch(function () { return { enabled: false }; });
    }
    return statusPromise;
  }

  var subjectsPromise = null;
  function loadSubjects() {
    if (!subjectsPromise) {
      subjectsPromise = fetch(WORKER_URL + '/subjects/public')
        .then(function (r) { return r.json(); })
        .then(function (d) { return d.subjects || []; })
        .catch(function () { return []; });
    }
    return subjectsPromise;
  }
  function labelOf(s) {
    var n = s.title_native || s.name || s.id;
    return s.title_english ? n + ' (' + s.title_english + ')' : n;
  }
  function priceOf(s) {
    return s && s.price_paise ? '\u20b9' + Math.round(s.price_paise / 100) : FALLBACK_PRICE;
  }
  function findSubject(list, id) {
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  var userPromise = null;
  function getUserId() {
    if (!userPromise) {
      userPromise = fetch(WORKER_URL + '/me', { credentials: 'include' })
        .then(function (r) { return r.json(); })
        .then(function (d) { return d && d.logged_in ? d.user_id : null; })
        .catch(function () { return null; });
    }
    return userPromise;
  }
  // Access for one subject: {unlocked, is_trial, expires_at, ...}
  function accessFor(slug, st) {
    if (preview) {
      var tr = st.trial;
      if (st.logged_in && tr && tr.subject_id === slug && tr.active) {
        return Promise.resolve({ unlocked: true, is_trial: true, expires_at: tr.expires_at });
      }
      return Promise.resolve({ unlocked: false });
    }
    return getUserId().then(function (uid) {
      if (!uid) return { unlocked: false };
      return fetch(WORKER_URL + '/check-access?user_id=' + encodeURIComponent(uid) + '&subject_id=' + encodeURIComponent(slug))
        .then(function (r) { return r.json(); })
        .catch(function () { return { unlocked: false }; });
    });
  }

  // Drop subjects the user already has access to (bought or trial): a trial is only for new subjects.
  function withoutOwned(list) {
    return getUserId().then(function (uid) {
      if (!uid) return list;
      return Promise.all(list.map(function (s) {
        return fetch(WORKER_URL + '/check-access?user_id=' + encodeURIComponent(uid) + '&subject_id=' + encodeURIComponent(s.id))
          .then(function (r) { return r.json(); })
          .then(function (d) { return d && d.unlocked ? null : s; })
          .catch(function () { return s; });
      })).then(function (r) { return r.filter(Boolean); });
    });
  }

  // ---------- styles ----------
  var stylesDone = false;
  function injectStyles() {
    if (stylesDone) return;
    stylesDone = true;
    var G = 'var(--sh2-green,#26946A)', GS = 'var(--sh2-green-soft,#e1f5ee)';
    var INK = 'var(--sh2-ink,#1c1a3a)', SOFT = 'var(--sh2-text-soft,#6b6a8e)';
    var SURF = 'var(--sh2-surface,#fff)', LINE = 'var(--sh2-line,#e7e4f5)';
    var css =
      '.sht-card{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin:0 0 12px;padding:14px 16px;border-radius:16px;' +
      'background:' + GS + ';border:1px solid ' + G + ';color:' + INK + ';}' +
      '.sht-ico{flex:0 0 auto;width:42px;height:42px;border-radius:12px;display:flex;align-items:center;justify-content:center;' +
      'background:' + SURF + ';color:' + G + ';font-size:1.3rem;}' +
      '.sht-body{flex:1 1 180px;min-width:0;}' +
      '.sht-tag{font-size:.62rem;font-weight:800;letter-spacing:.06em;color:' + G + ';}' +
      '.sht-title{font-size:.98rem;font-weight:800;line-height:1.25;color:' + INK + ';}' +
      '.sht-sub{font-size:.78rem;line-height:1.4;color:' + SOFT + ';margin-top:2px;}' +
      '.sht-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center;justify-content:center;flex:1 1 100%;}' +
      /* white card, purple border, green pill: stands apart from the green Current Affairs card */
      '.sht-card:not(.sht-dark){background:#fff;border:1.5px solid #5a4bd0;}' +
      '.sht-card:not(.sht-dark) .sht-ico{background:#efecff;color:#5a4bd0;}' +
      '.sht-card:not(.sht-dark) .sht-tag{display:inline-block;background:' + G + ';color:#fff;padding:2px 8px;border-radius:999px;margin-bottom:3px;}' +
      '.sht-card:not(.sht-dark) .sht-btn:not(.sht-btn-ghost){background:#5a4bd0;}' +
      '.sht-card:not(.sht-dark) .sht-btn-ghost{color:#5a4bd0;border-color:#5a4bd0;}' +
      '.sht-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:10px 16px;border-radius:10px;border:none;' +
      'background:' + G + ';color:#fff;font-family:inherit;font-weight:800;font-size:.84rem;cursor:pointer;text-decoration:none;white-space:nowrap;}' +
      '.sht-btn:hover{filter:brightness(.95);}' +
      '.sht-btn:disabled{opacity:.55;cursor:not-allowed;}' +
      '.sht-btn-ghost{background:transparent;color:' + G + ';border:1.5px solid ' + G + ';}' +
      /* strip inside the purple subject hero */
      '.sht-dark{background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.35);margin:10px 0 8px;padding:11px 12px;}' +
      '.sht-dark .sht-ico{width:34px;height:34px;font-size:1.05rem;}' +
      '.sht-dark .sht-title{color:#fff;font-size:.9rem;}' +
      '.sht-dark .sht-sub{color:rgba(255,255,255,.85);}' +
      '.sht-dark .sht-tag{color:#bff0dc;}' +
      '.sht-dark .sht-btn{background:#fff;color:#1d6f50;}' +
      /* login / signup note */
      '.sht-note{margin:0 0 12px;padding:10px 12px;border-radius:12px;background:' + GS + ';border:1px solid ' + G + ';' +
      'font-size:.8rem;line-height:1.45;color:' + INK + ';}' +
      '.sht-note a{color:' + G + ';font-weight:700;}' +
      /* make the bundle quieter once the trial is promoted */
      /* trial not used yet: show only the trial card, no bundle anywhere */
      'body.trial-solo .bundle-card{display:none !important;}' +
      '.sht-quiet #hero-toggle,.sht-quiet .unlock-btn:not(.sht-btn),.sht-quiet .unlock-sub{display:none !important;}' +
      '.sht-dark .sht-actions{width:100%;display:flex;justify-content:center;}' +
      '.sht-dark .sht-btn{display:inline-flex;align-items:center;justify-content:center;}' +
      /* modal */
      '.sht-overlay{position:fixed;inset:0;z-index:9999;background:rgba(20,16,50,.55);display:flex;align-items:center;justify-content:center;padding:16px;}' +
      '.sht-modal{position:relative;width:100%;max-width:420px;max-height:90vh;overflow:auto;background:' + SURF + ';color:' + INK + ';' +
      'border-radius:20px;padding:22px 20px 20px;box-shadow:0 24px 60px -12px rgba(20,16,50,.5);}' +
      '.sht-x{position:absolute;top:10px;right:12px;border:none;background:transparent;font-size:1.5rem;line-height:1;color:' + SOFT + ';cursor:pointer;}' +
      '.sht-modal .sht-btn{box-sizing:border-box;width:100%;white-space:normal;text-align:center;}' +
      '.sht-modal h2{font-size:1.15rem;font-weight:800;margin:0 28px 6px 0;line-height:1.3;}' +
      '.sht-modal p{font-size:.86rem;line-height:1.5;color:' + SOFT + ';margin:0 0 12px;}' +
      '.sht-list{list-style:none;margin:0 0 14px;padding:0;font-size:.84rem;line-height:1.5;}' +
      '.sht-list li{display:flex;gap:8px;margin:4px 0;}' +
      '.sht-list li:before{content:"\\2713";color:' + G + ';font-weight:800;}' +
      '.sht-pick{display:flex;flex-direction:column;gap:6px;margin:0 0 14px;max-height:240px;overflow:auto;}' +
      '.sht-opt{display:flex;align-items:center;gap:10px;padding:10px 12px;border:1.5px solid ' + LINE + ';border-radius:12px;cursor:pointer;font-size:.88rem;font-weight:600;}' +
      '.sht-opt input{accent-color:' + G + ';}' +
      '.sht-opt.sht-sel{border-color:' + G + ';background:' + GS + ';}' +
      '.sht-err{display:none;margin:0 0 12px;padding:9px 11px;border-radius:10px;background:#fdecec;color:#a12626;font-size:.8rem;}' +
      '.sht-modal .sht-btn{width:100%;}' +
      '.sht-toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:10000;max-width:92vw;padding:11px 16px;' +
      'border-radius:12px;background:#1d6f50;color:#fff;font-size:.85rem;font-weight:700;box-shadow:0 10px 30px -8px rgba(0,0,0,.4);}';
    var el = document.createElement('style');
    el.setAttribute('data-sht', '1');
    el.textContent = css;
    document.head.appendChild(el);
  }

  function toast(msg) {
    injectStyles();
    var t = document.createElement('div');
    t.className = 'sht-toast';
    t.setAttribute('role', 'status');
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 6000);
  }

  // ---------- modal ----------
  var overlay = null;
  function closeModal() {
    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
    overlay = null;
    document.removeEventListener('keydown', onKey);
  }
  function onKey(e) { if (e.key === 'Escape') closeModal(); }
  function openModal(html) {
    injectStyles();
    closeModal();
    overlay = document.createElement('div');
    overlay.className = 'sht-overlay';
    overlay.innerHTML = '<div class="sht-modal" role="dialog" aria-modal="true">' +
      '<button type="button" class="sht-x" aria-label="Close">&times;</button>' + html + '</div>';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) closeModal(); });
    overlay.querySelector('.sht-x').addEventListener('click', closeModal);
    document.addEventListener('keydown', onKey);
    return overlay.querySelector('.sht-modal');
  }
  function showErr(box, msg) {
    var el = box.querySelector('.sht-err');
    if (!el) return;
    el.textContent = msg;
    el.style.display = 'block';
  }

  // ---------- flows ----------
  function goSignup(slug) {
    var next = window.location.pathname + '?trial_start=' + encodeURIComponent(slug || '1');
    window.location.href = '/signup/?next=' + encodeURIComponent(next);
  }

  // Facebook / Instagram in-app browsers have no saved Google account, so sign-in there
  // is a blank box. Offer a one-tap "Open in Chrome" (Android) before Google sign-in.
  var inAppSkipped = false;
  function isInApp() { return /FBAN|FBAV|FB_IAB|Instagram/i.test(navigator.userAgent || ''); }
  function chromeIntentUrl() {
    var u = window.location;
    return 'intent://' + u.host + u.pathname + u.search + '#Intent;scheme=https;package=com.android.chrome;end';
  }
  function openInAppModal(slug) {
    var box = openModal(
      '<h2>Open in Chrome to sign in faster</h2>' +
      '<p>In Chrome your Google account is one tap away.</p>' +
      '<button type="button" class="sht-btn" data-inapp="chrome">Open in Chrome</button>' +
      '<p style="font-size:.78rem;margin:10px 0 0;text-align:center;">If nothing happens, tap the \u22EE menu at the top right and choose Open in Chrome.</p>' +
      '<p style="text-align:center;margin:10px 0 0;"><a href="#" data-inapp="go" style="color:inherit;text-decoration:underline;">Continue here anyway</a></p>'
    );
    box.querySelector('[data-inapp="chrome"]').addEventListener('click', function () {
      window.location.href = chromeIntentUrl();
    });
    box.querySelector('[data-inapp="go"]').addEventListener('click', function (e) {
      e.preventDefault();
      inAppSkipped = true;
      closeModal();
      openConfirmModal(slug, true);
    });
  }

  function startFlow(slug) {
    return getStatus(true).then(function (st) {
      if (!st.enabled) return;
      if (!st.logged_in) { if (isInApp() && !inAppSkipped) { openInAppModal(slug); return; } openConfirmModal(slug, true); return; } // guest: pick the subject first, Google sign-in comes after
      if (st.trial_used) { toast('You have already used your free trial.'); return; }
      if (st.email_state === 'unverified' || st.email_state === 'need_gmail') { openEmailModal(st.email_state); return; }
      openConfirmModal(slug);
    });
  }

  // Logged in, but no Google account and no verified Gmail yet.
  // state: 'unverified' (Gmail waiting for its code) or 'need_gmail' (no email / not Gmail).
  function openEmailModal(state) {
    var unverified = state === 'unverified';
    var box = openModal(
      '<h2>' + (unverified ? 'Verify your email' : 'Add your Gmail') + '</h2>' +
      '<p>' + (unverified
        ? 'Verify your email to start your free trial.'
        : 'Add a Gmail address as your recovery email to start your free trial.') + '</p>' +
      '<a class="sht-btn" href="/account/" style="display:flex;">' + (unverified ? 'Verify email' : 'Update email') + '</a>'
    );
    return box;
  }

  // They came back from sign-in, but the free trial was already used on this account.
  function openUsedModal(chosenSlug, st) {
    var tr = st.trial || {};
    Promise.all([
      loadSubjects(),
      chosenSlug ? accessFor(chosenSlug, st) : Promise.resolve({ unlocked: false })
    ]).then(function (res) {
      var all = res[0], acc = res[1] || {};
      var used = tr.subject_id ? findSubject(all, tr.subject_id) : null;
      var usedName = used ? labelOf(used) : 'another subject';
      var chosen = chosenSlug ? findSubject(all, chosenSlug) : null;
      var active = !!tr.active;
      var html = '<h2>' + (active ? 'You already have a free trial' : 'Your free trial has been used') + '</h2>' +
        '<p>' + (active
          ? 'Your free trial is on <b>' + esc(usedName) + '</b>. A free trial can be used only once, so it can\u2019t be claimed for another subject.'
          : 'Your free trial on <b>' + esc(usedName) + '</b> has ended. A free trial can be used only once.') + '</p>';
      var buttons = '';
      if (active && tr.subject_id) buttons += '<a class="sht-btn" href="/' + esc(tr.subject_id) + '/" style="display:flex;margin-bottom:8px;">Open ' + esc(used ? (used.name || usedName) : 'subject') + '</a>';
      if (chosen && !(acc.unlocked && !acc.is_trial)) {
        buttons += '<a class="sht-btn' + (active ? ' sht-btn-ghost' : '') + '" href="' + esc(buyHref(chosenSlug)) + '" style="display:flex;">Buy ' + esc(chosen.name || labelOf(chosen)) + ' ' + esc(priceOf(chosen)) + '</a>';
      }
      openModal(html + buttons);
    });
  }

  function openConfirmModal(slug, guest) {
    loadSubjects().then(function (all) {
      return withoutOwned(all).then(function (free) { return free; });
    }).then(function (all) {
      var subjects = all.filter(function (s) {
        // No papers, and no internal test subjects (slug "ads-test\u2026" or priced under Rs 50).
        return s.category !== 'papers' && String(s.id || '').indexOf('ads-test') !== 0 && (s.price_paise || 0) >= 5000;
      });
      // General Science first, the rest keep their site order.
      subjects = subjects.filter(function (s) { return s.id === 'general-science-en'; })
        .concat(subjects.filter(function (s) { return s.id !== 'general-science-en'; }));
      if (!subjects.length) { toast('You already have access to every subject.'); return; }
      var fixed = slug ? findSubject(subjects, slug) : null;
      var endsAt = nowSec() + 3 * 86400;

      var chooser;
      if (fixed) {
        chooser = '<p style="color:inherit;font-weight:800;font-size:.95rem;margin:0 0 10px;">' + esc(labelOf(fixed)) + '</p>';
      } else {
        chooser = '<div class="sht-pick" role="radiogroup" aria-label="Choose your free subject">' +
          subjects.map(function (s) {
            return '<label class="sht-opt"><input type="radio" name="sht-subject" value="' + esc(s.id) + '"> <span>' + esc(labelOf(s)) + '</span></label>';
          }).join('') + '</div>';
      }
      var box = openModal(
        '<h2>' + (fixed ? 'Start your free trial' : 'Pick your free subject') + '</h2>' +
        chooser +
        '<ul class="sht-list">' +
        '<li>3 days of full access to this one subject</li>' +
        '<li>Starts now \u00b7 ends automatically on ' + esc(whenText(endsAt)) + '</li>' +
        '<li>No card needed. No auto-charge.</li>' +
        '<li>The subject can\u2019t be changed after you start</li>' +
        '</ul><div class="sht-err"></div>' +
        '<button type="button" class="sht-btn" id="sht-go"' + (fixed ? '' : ' disabled') + '>Start free trial</button>'
      );
      var go = box.querySelector('#sht-go');
      var chosen = fixed ? fixed.id : null;
      if (!fixed) {
        box.querySelectorAll('input[name="sht-subject"]').forEach(function (inp) {
          inp.addEventListener('change', function () {
            chosen = inp.value;
            box.querySelectorAll('.sht-opt').forEach(function (o) { o.classList.remove('sht-sel'); });
            inp.parentNode.classList.add('sht-sel');
            go.disabled = false;
          });
        });
        if (!subjects.length) showErr(box, 'Subjects could not be loaded. Please try again.');
      }
      go.addEventListener('click', function () {
        if (!chosen) return;
        if (guest) {
          if (preview) { closeModal(); toast('Preview: this would open Google sign-up, then start the trial.'); return; }
          goSignup(chosen);
          return;
        }
        if (preview) { closeModal(); toast('Preview only \u2014 no trial was started.'); return; }
        go.disabled = true;
        api('POST', '/trial/start', { subject_id: chosen }).then(function (r) {
          if (r.ok && r.data.ok) {
            window.location.href = '/' + chosen + '/?trial_started=1';
            return;
          }
          go.disabled = false;
          var code = r.data && r.data.code;
          if (code === 'email_not_verified') { openEmailModal('unverified'); return; }
          if (code === 'gmail_required') { openEmailModal('need_gmail'); return; }
          if (code === 'login_required') { goSignup(slug); return; }
          showErr(box, (r.data && r.data.error) || 'Could not start the trial. Please try again.');
        }).catch(function () {
          go.disabled = false;
          showErr(box, 'Network error. Please check your connection and try again.');
        });
      });
    });
  }

  // ---------- renderers ----------
  function startCard(opts) {
    return '<div class="sht-card' + (opts.dark ? ' sht-dark' : '') + '">' +
      '<div class="sht-ico"><i class="ti ti-gift" aria-hidden="true"></i></div>' +
      '<div class="sht-body"><div class="sht-tag">FREE TRIAL</div>' +
      '<div class="sht-title">' + opts.title + '</div>' +
      '<div class="sht-sub">' + opts.sub + '</div></div>' +
      '<div class="sht-actions"><button type="button" class="sht-btn" data-trial-start="' + esc(opts.slug || '') + '">Start free trial</button></div></div>';
  }
  function activeCard(opts) {
    return '<div class="sht-card' + (opts.dark ? ' sht-dark' : '') + '">' +
      '<div class="sht-ico"><i class="ti ti-clock-hour-4" aria-hidden="true"></i></div>' +
      '<div class="sht-body"><div class="sht-tag">FREE TRIAL ACTIVE</div>' +
      '<div class="sht-title">' + opts.title + '</div>' +
      '<div class="sht-sub"><b data-trial-left data-expires="' + opts.expires + '">' + esc(leftText(opts.expires)) + '</b> \u00b7 ends ' + esc(whenText(opts.expires)) + '</div></div>' +
      '<div class="sht-actions">' + opts.actions + '</div></div>';
  }
  function endedCard(opts) {
    return '<div class="sht-card' + (opts.dark ? ' sht-dark' : '') + '">' +
      '<div class="sht-ico"><i class="ti ti-lock" aria-hidden="true"></i></div>' +
      '<div class="sht-body"><div class="sht-tag">TRIAL ENDED</div>' +
      '<div class="sht-title">' + opts.title + '</div>' +
      '<div class="sht-sub">' + opts.sub + '</div></div>' +
      '<div class="sht-actions">' + opts.actions + '</div></div>';
  }
  function buyHref(slug) { return '/plans/?highlight=' + encodeURIComponent(slug); }

  function renderBanner(slot, st) {
    return loadSubjects().then(function (all) {
      var tr = st.trial;
      var sub = tr ? findSubject(all, tr.subject_id) : null;
      var name = sub ? labelOf(sub) : (tr ? tr.subject_id : '');
      var price = priceOf(sub);

      if (st.trial_used && tr && tr.active) {
        slot.innerHTML = activeCard({
          title: 'Your free trial: ' + esc(name),
          expires: tr.expires_at,
          actions: '<a class="sht-btn" href="/' + esc(tr.subject_id) + '/">Open</a>' +
            '<a class="sht-btn sht-btn-ghost" href="' + esc(buyHref(tr.subject_id)) + '">Buy ' + esc(price) + '</a>'
        });
        return true;
      }
      if (st.trial_used && tr) {
        // Ended. Push for 7 days on every page, then only on the account page.
        var onAccount = window.location.pathname.indexOf('/account') === 0;
        if (!onAccount && nowSec() > (tr.expires_at || 0) + 7 * 86400) { slot.innerHTML = ''; return Promise.resolve(false); }
        // If they bought the subject since, say nothing.
        return accessFor(tr.subject_id, st).then(function (acc) {
          if (acc && acc.unlocked && !acc.is_trial) { slot.innerHTML = ''; return false; }
          slot.innerHTML = endedCard({
            title: 'Your free trial has ended',
            sub: 'Continue ' + esc(name) + ' for ' + esc(price) + '. Pay once \u2014 no auto-renewal.',
            actions: '<a class="sht-btn" href="' + esc(buyHref(tr.subject_id)) + '">Buy now</a>'
          });
          return true;
        });
      }
      if (st.trial_used) { slot.innerHTML = ''; return false; }
      slot.innerHTML = startCard({
        title: 'Pick any subject free for 3 days',
        sub: 'Full access. No card. No auto-charge \u2014 access just ends.'
      });
      return true;
    });
  }

  function renderSubject(slot, st) {
    var slug = slot.getAttribute('data-subject');
    if (!slug) return Promise.resolve(false);
    var tr = st.trial;
    var needAccess = st.logged_in;
    return (needAccess ? accessFor(slug, st) : Promise.resolve({ unlocked: false })).then(function (acc) {
      if (acc.unlocked) { slot.innerHTML = ''; return false; } // paid, manual or trial access: the page's own status shows
      return loadSubjects().then(function (all) {
        var price = priceOf(findSubject(all, slug));
        if (acc.unlocked && acc.is_trial) { slot.innerHTML = ''; return false; } // page shows its normal "Access active" status
        if (st.trial_used) {
          if (tr && tr.subject_id === slug && !tr.active) {
            slot.innerHTML = endedCard({
              dark: true,
              title: 'Your free trial has ended',
              sub: 'Continue for ' + esc(price) + '. Pay once \u2014 no auto-renewal.',
              actions: '<a class="sht-btn" href="' + esc(buyHref(slug)) + '">Buy now</a>'
            });
            return true;
          }
          slot.innerHTML = '';
          return false;
        }
        slot.innerHTML = startCard({
          dark: true,
          slug: slug,
          title: 'Free for 3 days \u2014 full access',
          sub: 'Try this subject free. No card. No auto-charge \u2014 access just ends.'
        });
        return true;
      });
    });
  }

  function renderAuthNote(slot) {
    var v = slot.getAttribute('data-variant');
    slot.innerHTML = v === 'signup'
      ? '<div class="sht-note"><b>Free 3-day trial:</b> sign up with Google to try any 1 subject free. ' +
        'Already bought a subject? <a href="/login/">Log in with your phone number</a> first.</div>'
      : '<div class="sht-note"><b>New here?</b> Sign up with Google to get a free 3-day trial of any 1 subject.</div>';
    return Promise.resolve(true);
  }

  // ---------- boot ----------
  function tickCountdowns() {
    document.querySelectorAll('[data-trial-left]').forEach(function (el) {
      var exp = Number(el.getAttribute('data-expires'));
      var txt = leftText(exp);
      el.textContent = txt;
      if (txt === 'ended') window.location.reload();
    });
  }

  function init() {
    var slots = document.querySelectorAll('[data-trial-slot]');
    getStatus().then(function (st) {
      if (!st.enabled) return; // switch off: page stays exactly as before
      injectStyles();

      var jobs = [];
      slots.forEach(function (slot) {
        var kind = slot.getAttribute('data-trial-slot');
        var job = kind === 'subject' ? renderSubject(slot, st)
          : kind === 'auth-note' ? renderAuthNote(slot, st)
          : renderBanner(slot, st);
        jobs.push(job.then(function (shown) {
          // Only while the trial is still unused: the trial card stands alone (no bundle).
          // Active / ended: the normal bundle offer comes back for the other subjects.
          var solo = shown && !st.trial_used;
          if (solo) document.body.classList.add('has-trial', 'trial-solo');
          if (solo && kind === 'subject') {
            var grp = document.getElementById('unlock-btn-group');
            if (grp) grp.classList.add('sht-quiet');
          }
        }).catch(function () { slot.innerHTML = ''; }));
      });

      return Promise.all(jobs).then(function () {
        document.querySelectorAll('[data-trial-start]').forEach(function (btn) {
          btn.addEventListener('click', function () { startFlow(btn.getAttribute('data-trial-start') || null); });
        });
        setInterval(tickCountdowns, 60000);

        // /plans/: lead with Buy Single (no bundle pressure) unless the visitor asked for something specific.
        if (window.location.pathname.indexOf('/plans') === 0) {
          var asked = ['mode', 'highlight', 'buy', 'subjects'].some(function (k) { return qs.has(k); });
          var singleBtn = document.getElementById('mode-single-btn');
          if (!asked && singleBtn) {
            // The plans page wires its own click handlers; retry briefly until they exist.
            var tries = 0;
            (function lead() {
              if (singleBtn.classList.contains('mode-btn-active')) return;
              singleBtn.click();
              if (!singleBtn.classList.contains('mode-btn-active') && ++tries < 20) setTimeout(lead, 150);
            })();
          }
        }

        // Back from Google sign-up with ?trial_start=<slug|1>
        var ts = qs.get('trial_start');
        if (ts) {
          try {
            var u = new URL(window.location.href);
            u.searchParams.delete('trial_start');
            window.history.replaceState(null, '', u.pathname + (u.search || '') + u.hash);
          } catch (e) {}
          if (st.logged_in && st.trial_used) { openUsedModal(ts === '1' ? null : ts, st); }
          if (st.logged_in && !st.trial_used) {
            if (ts !== '1' && st.email_state === 'ok' && !preview) {
              // They already chose the subject and signed in with Google: start it now.
              api('POST', '/trial/start', { subject_id: ts }).then(function (r) {
                if (r.ok && r.data.ok) { window.location.href = '/' + ts + '/?trial_started=1'; return; }
                toast((r.data && r.data.error) || 'Could not start the trial. Please try again.');
              }).catch(function () { toast('Network error. Please try again.'); });
            } else {
              startFlow(ts === '1' ? null : ts);
            }
          }
        }
        if (qs.get('trial_started') === '1') {
          try { if (typeof fbq === 'function') fbq('track', 'StartTrial'); } catch (e) {}
          try {
            var u2 = new URL(window.location.href);
            u2.searchParams.delete('trial_started');
            window.history.replaceState(null, '', u2.pathname + (u2.search || '') + u2.hash);
          } catch (e) {}
          toast('Free trial started \u2014 enjoy full access for 3 days.');
        }
      });
    });
  }

  window.ShTrial = { startFlow: startFlow, getStatus: getStatus };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
