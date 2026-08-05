// studyhelp — Razorpay payment Worker
// Bindings needed (set in wrangler.toml or dashboard):
//   DB                  -> D1 database binding
//   RAZORPAY_KEY_ID     -> secret (test: rzp_test_xxx)
//   RAZORPAY_KEY_SECRET -> secret
//   RAZORPAY_WEBHOOK_SECRET -> secret (set this string in Razorpay dashboard webhook config too)

// Used by endpoints that don't set/read cookies (create-order, webhook, check-access).
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// Used by auth endpoints (signup/login/logout/me) that set/read the session cookie.
// Wildcard origin ("*") does not work with credentialed requests — browsers
// reject it — so we must echo back the actual studyhelp origin instead.
// Includes localhost so `npm run dev` testing works before deploying to production.
const ALLOWED_ORIGINS = [
  "https://studyhelp.fdaytalk.com",
  "http://localhost:4321",
  "https://localhost:4321",
  "http://localhost:3000",
];

function corsHeadersWithCredentials(request) {
  const origin = request.headers.get("Origin");
  const matched = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": matched,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Credentials": "true",
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      const authRoutes = ["/signup", "/login", "/logout", "/me", "/forgot-passcode/send-otp", "/forgot-passcode/reset", "/content/chapter-answers", "/content/answer", "/verify-email/send-otp", "/verify-email/confirm", "/account/change-email/send-otp", "/account/change-email/confirm", "/master-access/login", "/master-access/logout", "/master-access/me", "/master-access/search", "/master-access/grant", "/master-access/revoke", "/master-access/users", "/master-access/manual-grants"];
      const headers = authRoutes.includes(url.pathname)
        ? corsHeadersWithCredentials(request)
        : CORS_HEADERS;
      return new Response(null, { status: 204, headers });
    }

    if (url.pathname === "/create-order" && request.method === "POST") {
      return createOrder(request, env);
    }
    if (url.pathname === "/webhook" && request.method === "POST") {
      return handleWebhook(request, env);
    }
    if (url.pathname === "/check-access" && request.method === "GET") {
      return checkAccess(request, env);
    }
    if (url.pathname === "/signup" && request.method === "POST") {
      return signup(request, env);
    }
    if (url.pathname === "/login" && request.method === "POST") {
      return login(request, env);
    }
    if (url.pathname === "/logout" && request.method === "POST") {
      return logout(request, env);
    }
    if (url.pathname === "/me" && request.method === "GET") {
      return me(request, env);
    }
    if (url.pathname === "/forgot-passcode/send-otp" && request.method === "POST") {
      return sendOtp(request, env);
    }
    if (url.pathname === "/forgot-passcode/reset" && request.method === "POST") {
      return resetPasscode(request, env);
    }
    if (url.pathname === "/support/submit" && request.method === "POST") {
      return submitSupportRequest(request, env);
    }
    if (url.pathname === "/verify-email/send-otp" && request.method === "POST") {
      return sendEmailVerifyOtp(request, env);
    }
    if (url.pathname === "/verify-email/confirm" && request.method === "POST") {
      return confirmEmailVerifyOtp(request, env);
    }
    if (url.pathname === "/account/change-email/send-otp" && request.method === "POST") {
      return sendChangeEmailOtp(request, env);
    }
    if (url.pathname === "/account/change-email/confirm" && request.method === "POST") {
      return confirmChangeEmailOtp(request, env);
    }
    if (url.pathname === "/content/chapter-answers" && request.method === "GET") {
      return getChapterAnswers(request, env);
    }
    if (url.pathname === "/content/answer" && request.method === "GET") {
      return getSingleAnswer(request, env);
    }
    if (url.pathname === "/master-access/login" && request.method === "POST") {
      return adminLogin(request, env);
    }
    if (url.pathname === "/master-access/logout" && request.method === "POST") {
      return adminLogout(request, env);
    }
    if (url.pathname === "/master-access/me" && request.method === "GET") {
      return adminMe(request, env);
    }
    if (url.pathname === "/master-access/search" && request.method === "GET") {
      return adminSearch(request, env);
    }
    if (url.pathname === "/master-access/users" && request.method === "GET") {
      return adminListUsers(request, env);
    }
    if (url.pathname === "/master-access/manual-grants" && request.method === "GET") {
      return adminManualGrants(request, env);
    }
    if (url.pathname === "/master-access/grant" && request.method === "POST") {
      return adminGrant(request, env);
    }
    if (url.pathname === "/master-access/revoke" && request.method === "POST") {
      return adminRevoke(request, env);
    }

    return new Response("Not found", { status: 404, headers: CORS_HEADERS });
  },
};

// ---------- 1. Create Order ----------
async function createOrder(request, env) {
  try {
    const { user_id, subject_id } = await request.json();

    if (!user_id || !subject_id) {
      return json({ error: "user_id and subject_id required" }, 400);
    }

    // Look up subject price from D1 (never trust price from client)
    const subject = await env.DB.prepare(
      "SELECT id, price_paise FROM subjects WHERE id = ?"
    )
      .bind(subject_id)
      .first();

    if (!subject) {
      return json({ error: "Invalid subject" }, 400);
    }

    // Auto-create user if not exists (identity = email for now, pre-OTP-login)
    await env.DB.prepare(
      `INSERT INTO users (id, email) VALUES (?, ?) ON CONFLICT(id) DO NOTHING`
    )
      .bind(user_id, user_id)
      .run();

    // Already entitled AND still within the 45-day window? Don't let them pay twice.
    // Once expired, this correctly falls through and lets them buy again.
    const nowTs = Math.floor(Date.now() / 1000);
    const existing = await env.DB.prepare(
      "SELECT id FROM entitlements WHERE user_id = ? AND subject_id = ? AND expires_at > ?"
    )
      .bind(user_id, subject_id, nowTs)
      .first();

    if (existing) {
      return json({ error: "Already purchased" }, 409);
    }

    // Call Razorpay Orders API
    const auth = btoa(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`);
    const rpRes = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify({
        amount: subject.price_paise,
        currency: "INR",
        notes: { user_id, subject_id },
      }),
    });

    if (!rpRes.ok) {
      const errBody = await rpRes.text();
      return json({ error: "Razorpay order creation failed", detail: errBody }, 502);
    }

    const rpOrder = await rpRes.json();

    // Store order as 'created'
    await env.DB.prepare(
      `INSERT INTO orders (id, user_id, subject_id, amount_paise, status)
       VALUES (?, ?, ?, ?, 'created')`
    )
      .bind(rpOrder.id, user_id, subject_id, subject.price_paise)
      .run();

    return json({
      order_id: rpOrder.id,
      amount: rpOrder.amount,
      currency: rpOrder.currency,
      key_id: env.RAZORPAY_KEY_ID, // public key, safe to expose to client
    });
  } catch (err) {
    return json({ error: "Server error", detail: String(err) }, 500);
  }
}

// ---------- 2. Webhook (source of truth for unlock) ----------
async function handleWebhook(request, env) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature");

  const valid = await verifySignature(rawBody, signature, env.RAZORPAY_WEBHOOK_SECRET);
  if (!valid) {
    return new Response("Invalid signature", { status: 400 });
  }

  const payload = JSON.parse(rawBody);

  if (payload.event === "payment.captured") {
    const payment = payload.payload.payment.entity;
    const orderId = payment.order_id;
    const paymentId = payment.id;

    // Fetch the order we stored earlier
    const order = await env.DB.prepare(
      "SELECT * FROM orders WHERE id = ?"
    )
      .bind(orderId)
      .first();

    if (!order) {
      // Order not found — log and ignore, don't error (Razorpay retries on non-2xx)
      return new Response("ok", { status: 200 });
    }

    // Idempotent: if this exact order was already processed (webhook retry),
    // do nothing. If it's a genuine new/renewal purchase (different order_id
    // for this user+subject — e.g. buying again after the 45-day window
    // lapsed), extend access fresh from now. Always 45 days from time of
    // payment, no stacking on top of remaining time — matches the simple
    // "45 days unlimited access" pricing, not a top-up model.
    const ACCESS_DURATION_SECONDS = 45 * 24 * 60 * 60;
    const expiresAt = Math.floor(Date.now() / 1000) + ACCESS_DURATION_SECONDS;

    await env.DB.prepare(
      `INSERT INTO entitlements (id, user_id, subject_id, order_id, payment_id, expires_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, subject_id) DO UPDATE SET
         order_id = excluded.order_id,
         payment_id = excluded.payment_id,
         expires_at = excluded.expires_at
       WHERE entitlements.order_id != excluded.order_id`
    )
      .bind(crypto.randomUUID(), order.user_id, order.subject_id, orderId, paymentId, expiresAt)
      .run();

    await env.DB.prepare("UPDATE orders SET status = 'paid' WHERE id = ?")
      .bind(orderId)
      .run();
  }

  if (payload.event === "payment.failed") {
    const payment = payload.payload.payment.entity;
    await env.DB.prepare("UPDATE orders SET status = 'failed' WHERE id = ?")
      .bind(payment.order_id)
      .run();
  }

  return new Response("ok", { status: 200 });
}

// Verify Razorpay webhook signature (HMAC SHA256)
async function verifySignature(body, signature, secret) {
  if (!signature) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sigBuffer = await crypto.subtle.sign("HMAC", key, enc.encode(body));
  const expected = [...new Uint8Array(sigBuffer)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return expected === signature;
}

// ---------- 3. Check Access (used by success page / subject page) ----------
async function checkAccess(request, env) {
  const url = new URL(request.url);
  const user_id = url.searchParams.get("user_id");
  const subject_id = url.searchParams.get("subject_id");

  if (!user_id || !subject_id) {
    return json({ error: "user_id and subject_id required" }, 400);
  }

  const nowTs = Math.floor(Date.now() / 1000);
  const entitlement = await env.DB.prepare(
    "SELECT id, expires_at, granted_reason, granted_by, granted_at FROM entitlements WHERE user_id = ? AND subject_id = ? AND expires_at > ?"
  )
    .bind(user_id, subject_id, nowTs)
    .first();

  if (!entitlement) {
    return json({ unlocked: false, expires_at: null });
  }

  // A manual grant (granted_reason set) shorter than the standard 45-day
  // window is a "grace grant" — temporary access while a payment issue is
  // sorted out, not a real purchase. Frontend uses this to show a banner
  // instead of treating it like normal unlimited access.
  const FULL_ACCESS_SECONDS = 45 * 24 * 60 * 60;
  const grantedDurationSeconds = entitlement.granted_at
    ? entitlement.expires_at - entitlement.granted_at
    : null;
  const isGraceGrant =
    !!entitlement.granted_reason &&
    grantedDurationSeconds !== null &&
    grantedDurationSeconds < FULL_ACCESS_SECONDS;

  return json({
    unlocked: true,
    expires_at: entitlement.expires_at,
    is_grace_grant: isGraceGrant,
    grace_days_remaining: isGraceGrant
      ? Math.max(0, Math.ceil((entitlement.expires_at - nowTs) / (24 * 60 * 60)))
      : null,
  });
}

// ---------- 4. Signup ----------
// Fields required, in order per spec: name, phone, email (recovery), passcode, confirm passcode
async function signup(request, env) {
  // All responses on this route must carry credentialed CORS headers,
  // since the client calls fetch() with credentials: 'include'.
  const jsonAuth = (data, status = 200, extra = {}) =>
    json(data, status, { ...corsHeadersWithCredentials(request), ...extra });

  try {
    const { name, phone, recovery_email, passcode, confirm_passcode } =
      await request.json();

    if (!name || !phone || !recovery_email || !passcode || !confirm_passcode) {
      return jsonAuth({ error: "All fields are required" }, 400);
    }
    if (!/^\d{10}$/.test(phone.replace(/\D/g, "").slice(-10))) {
      return jsonAuth({ error: "Enter a valid phone number" }, 400);
    }
    if (!/^\d{6}$/.test(passcode)) {
      return jsonAuth({ error: "Passcode must be exactly 6 digits" }, 400);
    }
    if (passcode !== confirm_passcode) {
      return jsonAuth({ error: "Passcodes do not match" }, 400);
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recovery_email)) {
      return jsonAuth({ error: "Enter a valid recovery email" }, 400);
    }

    const normalizedPhone = phone.replace(/\D/g, "").slice(-10);

    const existing = await env.DB.prepare("SELECT id FROM users WHERE phone = ?")
      .bind(normalizedPhone)
      .first();
    if (existing) {
      return jsonAuth({ error: "An account already exists for this phone number. Please log in instead." }, 409);
    }

    const passcodeHash = await hashPasscode(passcode);
    const userId = crypto.randomUUID();

    await env.DB.prepare(
      `INSERT INTO users (id, name, phone, recovery_email, passcode_hash)
       VALUES (?, ?, ?, ?, ?)`
    )
      .bind(userId, name, normalizedPhone, recovery_email, passcodeHash)
      .run();

    const session = await createSession(env, userId);

    return jsonAuth(
      { user_id: userId, name },
      200,
      { "Set-Cookie": sessionCookie(session, request) }
    );
  } catch (err) {
    return jsonAuth({ error: "Server error", detail: String(err) }, 500);
  }
}

// ---------- 5. Login ----------
async function login(request, env) {
  const jsonAuth = (data, status = 200, extra = {}) =>
    json(data, status, { ...corsHeadersWithCredentials(request), ...extra });

  try {
    const { phone, passcode } = await request.json();
    if (!phone || !passcode) {
      return jsonAuth({ error: "Phone and passcode required" }, 400);
    }

    const normalizedPhone = phone.replace(/\D/g, "").slice(-10);

    const user = await env.DB.prepare(
      "SELECT id, name, passcode_hash FROM users WHERE phone = ?"
    )
      .bind(normalizedPhone)
      .first();

    if (!user || !user.passcode_hash) {
      return jsonAuth({ error: "Invalid phone number or passcode" }, 401);
    }

    const valid = await verifyPasscode(passcode, user.passcode_hash);
    if (!valid) {
      return jsonAuth({ error: "Invalid phone number or passcode" }, 401);
    }

    // Single active session policy (replaces the earlier 3-device cap,
    // Aug 3, 2026): logging in on a new device always logs out any
    // previous session for this account, everywhere. No device limit to
    // hit, no management UI needed — there is never more than one active
    // session to manage.
    await env.DB.prepare("DELETE FROM login_sessions WHERE user_id = ?")
      .bind(user.id)
      .run();

    const session = await createSession(env, user.id);

    return jsonAuth(
      { user_id: user.id, name: user.name },
      200,
      { "Set-Cookie": sessionCookie(session, request) }
    );
  } catch (err) {
    return jsonAuth({ error: "Server error", detail: String(err) }, 500);
  }
}

// ---------- 6. Logout ----------
async function logout(request, env) {
  const token = getSessionTokenFromRequest(request);
  if (token) {
    const tokenHash = await sha256Hex(token);
    await env.DB.prepare("DELETE FROM login_sessions WHERE session_token_hash = ?")
      .bind(tokenHash)
      .run();
  }
  return json(
    { ok: true },
    200,
    {
      "Set-Cookie": "sh_session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax",
      ...corsHeadersWithCredentials(request),
    }
  );
}

// ---------- 7. Me (check current session) ----------
async function me(request, env) {
  const user = await getUserFromSession(request, env);
  if (!user) {
    return json({ logged_in: false }, 200, corsHeadersWithCredentials(request));
  }
  const fullUser = await env.DB.prepare(
    "SELECT pending_recovery_email FROM users WHERE id = ?"
  )
    .bind(user.id)
    .first();
  return json(
    {
      logged_in: true,
      user_id: user.id,
      name: user.name,
      phone: user.phone,
      recovery_email: user.recovery_email,
      pending_recovery_email: fullUser ? fullUser.pending_recovery_email : null,
      email_verified: !!user.email_verified,
    },
    200,
    corsHeadersWithCredentials(request)
  );
}

// ---------- 8. Forgot Passcode: Send OTP ----------
// Sends a 6-digit OTP to the user's registered recovery email.
// Name+phone match alone is never sufficient — email OTP is the real gate (Section 4).
async function sendOtp(request, env) {
  const jsonAuth = (data, status = 200, extra = {}) =>
    json(data, status, { ...corsHeadersWithCredentials(request), ...extra });

  try {
    const { phone } = await request.json();
    if (!phone) {
      return jsonAuth({ error: "Phone number required" }, 400);
    }
    const normalizedPhone = phone.replace(/\D/g, "").slice(-10);

    const user = await env.DB.prepare(
      "SELECT id, recovery_email FROM users WHERE phone = ?"
    )
      .bind(normalizedPhone)
      .first();

    // Always return a generic success-shaped message even if phone isn't found,
    // so this endpoint can't be used to enumerate which phone numbers are registered.
    const genericResponse = {
      message: "If this phone number is registered, a reset code has been sent to the registered recovery email.",
    };

    if (!user || !user.recovery_email) {
      return jsonAuth(genericResponse);
    }

    // Per-phone rate limit: max 3 OTP sends per hour (Section 4 requirement)
    const oneHourAgo = Math.floor(Date.now() / 1000) - 3600;
    const recentSends = await env.DB.prepare(
      "SELECT COUNT(*) as c FROM otp_send_log WHERE phone = ? AND sent_at > ?"
    )
      .bind(normalizedPhone, oneHourAgo)
      .first();

    if (recentSends.c >= 3) {
      return jsonAuth(
        { error: "Too many reset attempts. Please try again later or contact support." },
        429
      );
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = await sha256Hex(otp);
    const expiresAt = Math.floor(Date.now() / 1000) + 10 * 60; // 10 min expiry

    // Invalidate any previous unused OTPs for this user before issuing a new one
    await env.DB.prepare(
      "DELETE FROM otp_codes WHERE user_id = ? AND purpose = 'passcode_reset' AND used = 0"
    )
      .bind(user.id)
      .run();

    await env.DB.prepare(
      `INSERT INTO otp_codes (id, user_id, otp_hash, purpose, expires_at)
       VALUES (?, ?, ?, 'passcode_reset', ?)`
    )
      .bind(crypto.randomUUID(), user.id, otpHash, expiresAt)
      .run();

    await env.DB.prepare("INSERT INTO otp_send_log (id, phone) VALUES (?, ?)")
      .bind(crypto.randomUUID(), normalizedPhone)
      .run();

    const emailResult = await sendOtpEmail(env, user.recovery_email, otp);
    if (!emailResult.ok) {
      // Don't leak delivery failure details to the client (avoid enumeration),
      // but surface it as a generic server error so it's not silently swallowed.
      return jsonAuth(
        { error: "Could not send reset code right now. Please try again shortly or contact support." },
        502
      );
    }

    return jsonAuth(genericResponse);
  } catch (err) {
    return jsonAuth({ error: "Server error", detail: String(err) }, 500);
  }
}

// ---------- 9. Forgot Passcode: Verify OTP + Set New Passcode ----------
async function resetPasscode(request, env) {
  const jsonAuth = (data, status = 200, extra = {}) =>
    json(data, status, { ...corsHeadersWithCredentials(request), ...extra });

  try {
    const { phone, otp, new_passcode, confirm_new_passcode } = await request.json();

    if (!phone || !otp || !new_passcode || !confirm_new_passcode) {
      return jsonAuth({ error: "All fields are required" }, 400);
    }
    if (!/^\d{6}$/.test(new_passcode)) {
      return jsonAuth({ error: "Passcode must be exactly 6 digits" }, 400);
    }
    if (new_passcode !== confirm_new_passcode) {
      return jsonAuth({ error: "Passcodes do not match" }, 400);
    }

    const normalizedPhone = phone.replace(/\D/g, "").slice(-10);

    const user = await env.DB.prepare("SELECT id FROM users WHERE phone = ?")
      .bind(normalizedPhone)
      .first();

    if (!user) {
      return jsonAuth({ error: "Invalid or expired code" }, 400);
    }

    const otpRow = await env.DB.prepare(
      `SELECT id, otp_hash, attempts, expires_at, used FROM otp_codes
       WHERE user_id = ? AND purpose = 'passcode_reset'
       ORDER BY created_at DESC LIMIT 1`
    )
      .bind(user.id)
      .first();

    if (!otpRow || otpRow.used || otpRow.expires_at < Math.floor(Date.now() / 1000)) {
      return jsonAuth({ error: "Invalid or expired code" }, 400);
    }

    if (otpRow.attempts >= 5) {
      return jsonAuth({ error: "Too many incorrect attempts. Please request a new code." }, 429);
    }

    const otpHash = await sha256Hex(otp);
    if (otpHash !== otpRow.otp_hash) {
      await env.DB.prepare("UPDATE otp_codes SET attempts = attempts + 1 WHERE id = ?")
        .bind(otpRow.id)
        .run();
      return jsonAuth({ error: "Incorrect code" }, 400);
    }

    // OTP correct — mark used (one-time use), update passcode
    await env.DB.prepare("UPDATE otp_codes SET used = 1 WHERE id = ?")
      .bind(otpRow.id)
      .run();

    const newHash = await hashPasscode(new_passcode);
    await env.DB.prepare("UPDATE users SET passcode_hash = ? WHERE id = ?")
      .bind(newHash, user.id)
      .run();

    // Invalidate all existing sessions on passcode reset (security best practice)
    await env.DB.prepare("DELETE FROM login_sessions WHERE user_id = ?")
      .bind(user.id)
      .run();

    return jsonAuth({ message: "Passcode reset successfully. Please log in with your new passcode." });
  } catch (err) {
    return jsonAuth({ error: "Server error", detail: String(err) }, 500);
  }
}

// ---------- 8a. Verify Email: Send OTP (on-demand, 60s rate limit) ----------
// Triggered only when the logged-in student clicks "Verify now" on the
// dashboard banner — never sent automatically at signup/payment, so it
// doesn't compete with forgot-passcode for Resend's free-tier daily quota.
async function sendEmailVerifyOtp(request, env) {
  const jsonAuth = (data, status = 200, extra = {}) =>
    json(data, status, { ...corsHeadersWithCredentials(request), ...extra });

  try {
    const user = await getUserFromSession(request, env);
    if (!user) {
      return jsonAuth({ error: "Login required" }, 401);
    }
    if (!user.recovery_email) {
      return jsonAuth({ error: "No recovery email on file. Add one from your account page first." }, 400);
    }

    const fullUser = await env.DB.prepare(
      "SELECT email_verified, last_verify_attempt FROM users WHERE id = ?"
    )
      .bind(user.id)
      .first();

    if (fullUser.email_verified) {
      return jsonAuth({ message: "Email already verified." });
    }

    const nowSec = Math.floor(Date.now() / 1000);
    if (fullUser.last_verify_attempt && nowSec - fullUser.last_verify_attempt < 60) {
      const waitSec = 60 - (nowSec - fullUser.last_verify_attempt);
      return jsonAuth({ error: `Please wait ${waitSec}s before retrying.` }, 429);
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = await sha256Hex(otp);
    const expiresAt = nowSec + 10 * 60; // 10 min expiry, same as passcode reset

    // Invalidate any previous unused email-verify OTPs before issuing a new one
    await env.DB.prepare(
      "DELETE FROM otp_codes WHERE user_id = ? AND purpose = 'email_verify' AND used = 0"
    )
      .bind(user.id)
      .run();

    await env.DB.prepare(
      `INSERT INTO otp_codes (id, user_id, otp_hash, purpose, expires_at)
       VALUES (?, ?, ?, 'email_verify', ?)`
    )
      .bind(crypto.randomUUID(), user.id, otpHash, expiresAt)
      .run();

    // Record the attempt timestamp before sending, so a slow/failed send
    // still counts against the 60s cooldown (prevents rapid retry spam).
    await env.DB.prepare("UPDATE users SET last_verify_attempt = ? WHERE id = ?")
      .bind(nowSec, user.id)
      .run();

    const emailResult = await sendEmailVerifyOtpEmail(env, user.recovery_email, otp);
    if (!emailResult.ok) {
      return jsonAuth(
        { error: "Could not send verification code right now. Please try again shortly." },
        502
      );
    }

    return jsonAuth({ message: "Verification code sent to your recovery email." });
  } catch (err) {
    return jsonAuth({ error: "Server error", detail: String(err) }, 500);
  }
}

// ---------- 8b. Verify Email: Confirm OTP ----------
async function confirmEmailVerifyOtp(request, env) {
  const jsonAuth = (data, status = 200, extra = {}) =>
    json(data, status, { ...corsHeadersWithCredentials(request), ...extra });

  try {
    const user = await getUserFromSession(request, env);
    if (!user) {
      return jsonAuth({ error: "Login required" }, 401);
    }

    const { otp } = await request.json();
    if (!otp) {
      return jsonAuth({ error: "Code required" }, 400);
    }

    const otpRow = await env.DB.prepare(
      `SELECT id, otp_hash, attempts, expires_at, used FROM otp_codes
       WHERE user_id = ? AND purpose = 'email_verify'
       ORDER BY created_at DESC LIMIT 1`
    )
      .bind(user.id)
      .first();

    if (!otpRow || otpRow.used || otpRow.expires_at < Math.floor(Date.now() / 1000)) {
      return jsonAuth({ error: "Invalid or expired code" }, 400);
    }

    if (otpRow.attempts >= 5) {
      return jsonAuth({ error: "Too many incorrect attempts. Please request a new code." }, 429);
    }

    const otpHash = await sha256Hex(otp);
    if (otpHash !== otpRow.otp_hash) {
      await env.DB.prepare("UPDATE otp_codes SET attempts = attempts + 1 WHERE id = ?")
        .bind(otpRow.id)
        .run();
      return jsonAuth({ error: "Incorrect code" }, 400);
    }

    await env.DB.prepare("UPDATE otp_codes SET used = 1 WHERE id = ?")
      .bind(otpRow.id)
      .run();

    await env.DB.prepare("UPDATE users SET email_verified = 1 WHERE id = ?")
      .bind(user.id)
      .run();

    return jsonAuth({ message: "Email verified." });
  } catch (err) {
    return jsonAuth({ error: "Server error", detail: String(err) }, 500);
  }
}

// ---------- 8c. Change Recovery Email: Send OTP to new address ----------
// Student-side self-service — see migration-recovery-email-change.sql notes.
// New email is staged in pending_recovery_email; recovery_email is untouched
// until the OTP sent to the NEW address is confirmed.
async function sendChangeEmailOtp(request, env) {
  const jsonAuth = (data, status = 200, extra = {}) =>
    json(data, status, { ...corsHeadersWithCredentials(request), ...extra });

  try {
    const user = await getUserFromSession(request, env);
    if (!user) {
      return jsonAuth({ error: "Login required" }, 401);
    }

    const { new_email } = await request.json();
    const fullUserPre = await env.DB.prepare(
      "SELECT pending_recovery_email, last_email_change_attempt FROM users WHERE id = ?"
    )
      .bind(user.id)
      .first();

    let newEmail;
    if (new_email && new_email.trim()) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(new_email.trim())) {
        return jsonAuth({ error: "Enter a valid email address" }, 400);
      }
      newEmail = new_email.trim().toLowerCase();
    } else if (fullUserPre.pending_recovery_email) {
      // No new_email supplied — this is a resend for an already-staged change.
      newEmail = fullUserPre.pending_recovery_email;
    } else {
      return jsonAuth({ error: "Enter a valid email address" }, 400);
    }

    if (newEmail === (user.recovery_email || "").toLowerCase()) {
      return jsonAuth({ error: "That's already your current recovery email" }, 400);
    }

    const nowSec = Math.floor(Date.now() / 1000);
    if (fullUserPre.last_email_change_attempt && nowSec - fullUserPre.last_email_change_attempt < 60) {
      const waitSec = 60 - (nowSec - fullUserPre.last_email_change_attempt);
      return jsonAuth({ error: `Please wait ${waitSec}s before retrying.` }, 429);
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = await sha256Hex(otp);
    const expiresAt = nowSec + 10 * 60;

    await env.DB.prepare(
      "DELETE FROM otp_codes WHERE user_id = ? AND purpose = 'email_change' AND used = 0"
    )
      .bind(user.id)
      .run();

    await env.DB.prepare(
      `INSERT INTO otp_codes (id, user_id, otp_hash, purpose, expires_at)
       VALUES (?, ?, ?, 'email_change', ?)`
    )
      .bind(crypto.randomUUID(), user.id, otpHash, expiresAt)
      .run();

    // Stage the new email now so confirm can promote it — recovery_email
    // itself is untouched until the OTP is actually verified.
    await env.DB.prepare(
      "UPDATE users SET pending_recovery_email = ?, last_email_change_attempt = ? WHERE id = ?"
    )
      .bind(newEmail, nowSec, user.id)
      .run();

    const emailResult = await sendChangeEmailOtpEmail(env, newEmail, otp);
    if (!emailResult.ok) {
      return jsonAuth(
        { error: "Could not send verification code right now. Please try again shortly." },
        502
      );
    }

    return jsonAuth({ message: "Verification code sent to your new email address." });
  } catch (err) {
    return jsonAuth({ error: "Server error", detail: String(err) }, 500);
  }
}

// ---------- 8d. Change Recovery Email: Confirm OTP ----------
async function confirmChangeEmailOtp(request, env) {
  const jsonAuth = (data, status = 200, extra = {}) =>
    json(data, status, { ...corsHeadersWithCredentials(request), ...extra });

  try {
    const user = await getUserFromSession(request, env);
    if (!user) {
      return jsonAuth({ error: "Login required" }, 401);
    }

    const { otp } = await request.json();
    if (!otp) {
      return jsonAuth({ error: "Code required" }, 400);
    }

    const otpRow = await env.DB.prepare(
      `SELECT id, otp_hash, attempts, expires_at, used FROM otp_codes
       WHERE user_id = ? AND purpose = 'email_change'
       ORDER BY created_at DESC LIMIT 1`
    )
      .bind(user.id)
      .first();

    if (!otpRow || otpRow.used || otpRow.expires_at < Math.floor(Date.now() / 1000)) {
      return jsonAuth({ error: "Invalid or expired code" }, 400);
    }

    if (otpRow.attempts >= 5) {
      return jsonAuth({ error: "Too many incorrect attempts. Please request a new code." }, 429);
    }

    const otpHash = await sha256Hex(otp);
    if (otpHash !== otpRow.otp_hash) {
      await env.DB.prepare("UPDATE otp_codes SET attempts = attempts + 1 WHERE id = ?")
        .bind(otpRow.id)
        .run();
      return jsonAuth({ error: "Incorrect code" }, 400);
    }

    const fullUser = await env.DB.prepare(
      "SELECT pending_recovery_email FROM users WHERE id = ?"
    )
      .bind(user.id)
      .first();

    if (!fullUser.pending_recovery_email) {
      return jsonAuth({ error: "No pending email change found. Please start again." }, 400);
    }

    await env.DB.prepare("UPDATE otp_codes SET used = 1 WHERE id = ?")
      .bind(otpRow.id)
      .run();

    // Promote pending -> real recovery_email. New address was just proven
    // reachable by this OTP, so email_verified is set true in the same step.
    await env.DB.prepare(
      "UPDATE users SET recovery_email = ?, pending_recovery_email = NULL, email_verified = 1 WHERE id = ?"
    )
      .bind(fullUser.pending_recovery_email, user.id)
      .run();

    return jsonAuth({ message: "Recovery email updated.", recovery_email: fullUser.pending_recovery_email });
  } catch (err) {
    return jsonAuth({ error: "Server error", detail: String(err) }, 500);
  }
}

// Send change-email OTP via Resend (separate template — this goes to the
// NEW address, which has never seen a StudyHelp email before)
async function sendChangeEmailOtpEmail(env, toEmail, otp) {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "StudyHelp <studyhelp@fdaytalk.com>",
        to: [toEmail],
        subject: "Confirm your new StudyHelp recovery email",
        html: `<p>You requested to change your StudyHelp recovery email to this address. Your confirmation code is:</p>
               <p style="font-size:24px;font-weight:bold;letter-spacing:4px;">${otp}</p>
               <p>This code expires in 10 minutes. If you did not request this, you can ignore this email — your account is unaffected.</p>`,
      }),
    });
    return { ok: res.ok };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

// Send OTP email via Resend
async function sendOtpEmail(env, toEmail, otp) {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "StudyHelp <studyhelp@fdaytalk.com>",
        to: [toEmail],
        subject: "Your StudyHelp passcode reset code",
        html: `<p>Your StudyHelp passcode reset code is:</p>
               <p style="font-size:24px;font-weight:bold;letter-spacing:4px;">${otp}</p>
               <p>This code expires in 10 minutes. If you did not request this, you can ignore this email.</p>`,
      }),
    });
    return { ok: res.ok };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

// Send email-verification OTP via Resend (separate template from passcode reset,
// so the wording matches what the user is actually doing)
async function sendEmailVerifyOtpEmail(env, toEmail, otp) {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "StudyHelp <studyhelp@fdaytalk.com>",
        to: [toEmail],
        subject: "Verify your StudyHelp email",
        html: `<p>Your StudyHelp email verification code is:</p>
               <p style="font-size:24px;font-weight:bold;letter-spacing:4px;">${otp}</p>
               <p>This code expires in 10 minutes. If you did not request this, you can ignore this email.</p>`,
      }),
    });
    return { ok: res.ok };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

// ---------- 10. Support request submission (public /support/ form) ----------
// Public form per spec Section 5 — no login required. Uses plain (non-credentialed)
// CORS since this doesn't touch the session cookie at all.
async function submitSupportRequest(request, env) {
  try {
    const { phone, recovery_email, contact_email, payment_or_order_id, description } = await request.json();

    if (!description || !description.trim()) {
      return json({ error: "Please describe the problem." }, 400);
    }
    if (!phone && !recovery_email && !payment_or_order_id) {
      return json({ error: "Please provide at least a phone number, email, or payment/order ID so we can find your account." }, 400);
    }
    if (!contact_email || !contact_email.trim()) {
      return json({ error: "Please provide an email we can reply to." }, 400);
    }

    const id = crypto.randomUUID();

    await env.DB.prepare(
      `INSERT INTO support_requests (id, phone, recovery_email, contact_email, payment_or_order_id, description)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
      .bind(
        id,
        phone ? phone.replace(/\D/g, "").slice(-10) : null,
        recovery_email || null,
        contact_email.trim(),
        payment_or_order_id || null,
        description.trim()
      )
      .run();

    // Best-effort notification email to the owner — request still succeeds
    // even if this fails, since the request is already safely stored in D1.
    try {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "StudyHelp Support <studyhelp@fdaytalk.com>",
          to: ["studyhelp@fdaytalk.com"],
          reply_to: contact_email.trim(),
          subject: "New StudyHelp support request",
          html: `<p>A new support request was submitted.</p>
                 <p><strong>Phone:</strong> ${phone || "-"}<br/>
                 <strong>Reply to:</strong> ${contact_email.trim()}<br/>
                 <strong>Recovery email on file (per student):</strong> ${recovery_email || "-"}<br/>
                 <strong>Payment/Order ID:</strong> ${payment_or_order_id || "-"}</p>
                 <p><strong>Description:</strong><br/>${description.trim().replace(/\n/g, "<br/>")}</p>
                 <p style="color:#888;font-size:12px;">Request ID: ${id}</p>`,
        }),
      });
    } catch (err) {
      // ignore — request is already saved in D1 regardless
    }

    return json({ message: "Your request has been submitted. We'll get back to you soon." }, 200);
  } catch (err) {
    return json({ error: "Server error", detail: String(err) }, 500);
  }
}



// PBKDF2 passcode hashing (Web Crypto — no bcrypt available in Workers runtime)
async function hashPasscode(passcode) {
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(passcode),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const derivedBits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    256
  );
  const hashHex = [...new Uint8Array(derivedBits)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const saltHex = [...salt].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${saltHex}:${hashHex}`;
}

async function verifyPasscode(passcode, storedHash) {
  const [saltHex, hashHex] = storedHash.split(":");
  if (!saltHex || !hashHex) return false;
  const salt = new Uint8Array(saltHex.match(/.{2}/g).map((b) => parseInt(b, 16)));
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(passcode),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const derivedBits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    256
  );
  const computedHex = [...new Uint8Array(derivedBits)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return computedHex === hashHex;
}

async function sha256Hex(text) {
  const enc = new TextEncoder();
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Session lifetime: 30 days
const SESSION_LIFETIME_SECONDS = 30 * 24 * 60 * 60;

async function createSession(env, userId) {
  const token = crypto.randomUUID() + crypto.randomUUID();
  const tokenHash = await sha256Hex(token);
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_LIFETIME_SECONDS;

  await env.DB.prepare(
    `INSERT INTO login_sessions (id, user_id, session_token_hash, expires_at)
     VALUES (?, ?, ?, ?)`
  )
    .bind(crypto.randomUUID(), userId, tokenHash, expiresAt)
    .run();

  return { token, expiresAt };
}

function sessionCookie({ token, expiresAt }, request) {
  const maxAge = expiresAt - Math.floor(Date.now() / 1000);
  // SameSite=Lax now works correctly because this Worker runs on
  // api.studyhelp.fdaytalk.com — the same root domain (fdaytalk.com) as the
  // frontend (studyhelp.fdaytalk.com), making this a same-site cookie.
  // (Previously this ran on *.workers.dev, a different site entirely, which
  // forced SameSite=None — that broke in private/incognito mode and any
  // browser blocking third-party cookies, and widened CSRF exposure.)
  //
  // Local dev exception: localhost:4321 and api.studyhelp.fdaytalk.com are
  // different sites (different root domains), so this is a CROSS-site
  // request from the browser's point of view. Cross-site cookies are only
  // ever sent by the browser when SameSite=None — and SameSite=None is only
  // valid paired with Secure, which requires the local dev server itself to
  // run over https (see mkcert setup). Without this, the cookie gets stored
  // but never actually sent back on API calls, so login silently fails to
  // "stick" and every request looks anonymous (hits the 15/day free-click
  // limit). Production (studyhelp.fdaytalk.com <-> api.studyhelp.fdaytalk.com)
  // shares the root domain fdaytalk.com, so it stays same-site and keeps
  // using the tighter Secure; SameSite=Lax — unaffected by this branch.
  const origin = request?.headers.get("Origin") || "";
  const isLocalDev = origin.includes("localhost") || origin.includes("127.0.0.1");

  return isLocalDev
    ? `sh_session=${token}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=None`
    : `sh_session=${token}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}

function getSessionTokenFromRequest(request) {
  const cookieHeader = request.headers.get("Cookie") || "";
  const match = cookieHeader.match(/sh_session=([^;]+)/);
  return match ? match[1] : null;
}

async function getUserFromSession(request, env) {
  const token = getSessionTokenFromRequest(request);
  if (!token) return null;

  const tokenHash = await sha256Hex(token);
  const session = await env.DB.prepare(
    "SELECT user_id, expires_at FROM login_sessions WHERE session_token_hash = ?"
  )
    .bind(tokenHash)
    .first();

  if (!session || session.expires_at < Math.floor(Date.now() / 1000)) {
    return null;
  }

  const user = await env.DB.prepare("SELECT id, name, phone, recovery_email, email_verified FROM users WHERE id = ?")
    .bind(session.user_id)
    .first();

  return user || null;
}

// ---------- Admin console (Stage 6, core: login, search, grant, revoke) ----------
// Route: /master-access/  (not linked in public nav, gated by ADMIN_SECRET)
// Separate cookie/session system from student login — shorter lifetime,
// never shares sh_session, never touches passcode hashes.

const ADMIN_SESSION_LIFETIME_SECONDS = 4 * 60 * 60; // 4 hours — shorter than student 30-day sessions, per spec
const ADMIN_COOKIE_NAME = "sh_admin_session";

async function adminLogin(request, env) {
  const jsonAuth = (data, status = 200) => json(data, status, corsHeadersWithCredentials(request));
  try {
    const { secret, admin_name } = await request.json();

    if (!env.ADMIN_SECRET) {
      return jsonAuth({ error: "Admin console not configured" }, 500);
    }
    if (!secret || secret !== env.ADMIN_SECRET) {
      // Same generic message regardless of failure reason — don't help an attacker
      // distinguish "wrong secret" from "no secret sent".
      return jsonAuth({ error: "Invalid credentials" }, 401);
    }
    if (!admin_name || !admin_name.trim()) {
      return jsonAuth({ error: "admin_name required — used to label audit log entries" }, 400);
    }

    const token = crypto.randomUUID() + crypto.randomUUID();
    const tokenHash = await sha256Hex(token);
    const expiresAt = Math.floor(Date.now() / 1000) + ADMIN_SESSION_LIFETIME_SECONDS;

    await env.DB.prepare(
      `INSERT INTO admin_sessions (id, session_token_hash, admin_identifier, expires_at)
       VALUES (?, ?, ?, ?)`
    )
      .bind(crypto.randomUUID(), tokenHash, admin_name.trim(), expiresAt)
      .run();

    const origin = request.headers.get("Origin") || "";
    const isLocalDev = origin.includes("localhost") || origin.includes("127.0.0.1");
    const cookie = isLocalDev
      ? `${ADMIN_COOKIE_NAME}=${token}; Path=/; Max-Age=${ADMIN_SESSION_LIFETIME_SECONDS}; HttpOnly; Secure; SameSite=None`
      : `${ADMIN_COOKIE_NAME}=${token}; Path=/; Max-Age=${ADMIN_SESSION_LIFETIME_SECONDS}; HttpOnly; Secure; SameSite=Lax`;

    return json({ ok: true, admin_name: admin_name.trim() }, 200, {
      ...corsHeadersWithCredentials(request),
      "Set-Cookie": cookie,
    });
  } catch (err) {
    return jsonAuth({ error: "Server error", detail: String(err) }, 500);
  }
}

async function adminLogout(request, env) {
  const token = getAdminTokenFromRequest(request);
  if (token) {
    const tokenHash = await sha256Hex(token);
    await env.DB.prepare("DELETE FROM admin_sessions WHERE session_token_hash = ?").bind(tokenHash).run();
  }
  return json({ ok: true }, 200, {
    ...corsHeadersWithCredentials(request),
    "Set-Cookie": `${ADMIN_COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`,
  });
}

async function adminMe(request, env) {
  const jsonAuth = (data, status = 200) => json(data, status, corsHeadersWithCredentials(request));
  const admin = await getAdminFromSession(request, env);
  if (!admin) return jsonAuth({ admin: null }, 401);
  return jsonAuth({ admin_name: admin.admin_identifier });
}

function getAdminTokenFromRequest(request) {
  const cookieHeader = request.headers.get("Cookie") || "";
  const match = cookieHeader.match(new RegExp(`${ADMIN_COOKIE_NAME}=([^;]+)`));
  return match ? match[1] : null;
}

async function getAdminFromSession(request, env) {
  const token = getAdminTokenFromRequest(request);
  if (!token) return null;
  const tokenHash = await sha256Hex(token);
  const session = await env.DB.prepare(
    "SELECT admin_identifier, expires_at FROM admin_sessions WHERE session_token_hash = ?"
  )
    .bind(tokenHash)
    .first();
  if (!session || session.expires_at < Math.floor(Date.now() / 1000)) return null;
  return session;
}

// ---------- Admin: paginated all-users list ----------
async function adminListUsers(request, env) {
  const jsonAuth = (data, status = 200) => json(data, status, corsHeadersWithCredentials(request));
  const admin = await getAdminFromSession(request, env);
  if (!admin) return jsonAuth({ error: "Not authorized" }, 401);

  const url = new URL(request.url);
  const before = url.searchParams.get("before"); // created_at cursor for "Load more"
  const limit = 20;
  const nowTs = Math.floor(Date.now() / 1000);

  const users = before
    ? await env.DB.prepare(
        "SELECT id, name, phone, recovery_email, created_at FROM users WHERE created_at < ? ORDER BY created_at DESC LIMIT ?"
      )
        .bind(Number(before), limit)
        .all()
    : await env.DB.prepare(
        "SELECT id, name, phone, recovery_email, created_at FROM users ORDER BY created_at DESC LIMIT ?"
      )
        .bind(limit)
        .all();

  const rows = users.results || [];
  if (rows.length === 0) return jsonAuth({ users: [], next_cursor: null });

  // One query for entitlement counts across this page of users, rather than N+1 queries.
  const ids = rows.map((u) => u.id);
  const placeholders = ids.map(() => "?").join(",");
  const entitlementCounts = await env.DB.prepare(
    `SELECT user_id,
            SUM(CASE WHEN expires_at > ? AND revoked_at IS NULL AND (order_id != '' OR payment_id != '') THEN 1 ELSE 0 END) AS active_purchased,
            SUM(CASE WHEN expires_at > ? AND revoked_at IS NULL AND order_id = '' AND payment_id = '' THEN 1 ELSE 0 END) AS active_manual
     FROM entitlements
     WHERE user_id IN (${placeholders})
     GROUP BY user_id`
  )
    .bind(nowTs, nowTs, ...ids)
    .all();

  const countsByUser = {};
  for (const row of entitlementCounts.results || []) {
    countsByUser[row.user_id] = { activePurchased: row.active_purchased, activeManual: row.active_manual };
  }

  const usersWithCounts = rows.map((u) => ({
    ...u,
    subjects_active_purchased: countsByUser[u.id]?.activePurchased || 0,
    subjects_active_manual: countsByUser[u.id]?.activeManual || 0,
  }));

  const nextCursor = rows.length === limit ? rows[rows.length - 1].created_at : null;

  return jsonAuth({ users: usersWithCounts, next_cursor: nextCursor });
}

// ---------- Admin: manual grants tracker (grace grants + full manual grants) ----------
async function adminManualGrants(request, env) {
  const jsonAuth = (data, status = 200) => json(data, status, corsHeadersWithCredentials(request));
  const admin = await getAdminFromSession(request, env);
  if (!admin) return jsonAuth({ error: "Not authorized" }, 401);

  const nowTs = Math.floor(Date.now() / 1000);
  const grants = await env.DB.prepare(
    `SELECT e.id, e.user_id, u.name AS user_name, u.phone,
            e.subject_id, s.name AS subject_name,
            e.expires_at, e.granted_reason, e.granted_by, e.granted_at,
            e.revoked_at, e.revoked_reason, e.revoked_by
     FROM entitlements e
     JOIN users u ON u.id = e.user_id
     LEFT JOIN subjects s ON s.id = e.subject_id
     WHERE e.granted_by IS NOT NULL
     ORDER BY
       CASE WHEN e.revoked_at IS NULL AND e.expires_at > ? THEN 0 ELSE 1 END ASC,
       e.expires_at ASC`
  )
    .bind(nowTs)
    .all();

  const results = (grants.results || []).map((g) => ({
    ...g,
    active: !g.revoked_at && g.expires_at > nowTs,
    duration_days: g.granted_at ? Math.round((g.expires_at - g.granted_at) / (24 * 60 * 60)) : null,
  }));

  return jsonAuth({ grants: results });
}

async function adminSearch(request, env) {
  const jsonAuth = (data, status = 200) => json(data, status, corsHeadersWithCredentials(request));
  const admin = await getAdminFromSession(request, env);
  if (!admin) return jsonAuth({ error: "Not authorized" }, 401);

  const url = new URL(request.url);

  const q = (url.searchParams.get("q") || "").trim();
  if (!q) return jsonAuth({ error: "q required (phone, recovery email, payment_id, or order_id)" }, 400);

  const normalizedPhone = q.replace(/\D/g, "").slice(-10);

  // Try to resolve a user_id via phone, recovery_email, or a payment/order id on their orders.
  let user = await env.DB.prepare(
    "SELECT id, name, phone, recovery_email, created_at FROM users WHERE phone = ? OR recovery_email = ?"
  )
    .bind(normalizedPhone, q)
    .first();

  if (!user) {
    const orderMatch = await env.DB.prepare(
      "SELECT user_id FROM orders WHERE id = ? OR id IN (SELECT order_id FROM entitlements WHERE payment_id = ?)"
    )
      .bind(q, q)
      .first();
    if (orderMatch) {
      user = await env.DB.prepare(
        "SELECT id, name, phone, recovery_email, created_at FROM users WHERE id = ?"
      )
        .bind(orderMatch.user_id)
        .first();
    }
  }

  if (!user) return jsonAuth({ found: false });

  const nowTs = Math.floor(Date.now() / 1000);

  const entitlements = await env.DB.prepare(
    `SELECT e.id, e.subject_id, s.name AS subject_name, e.order_id, e.payment_id,
            e.expires_at, e.granted_reason, e.granted_by, e.granted_at,
            e.revoked_at, e.revoked_reason, e.revoked_by
     FROM entitlements e
     LEFT JOIN subjects s ON s.id = e.subject_id
     WHERE e.user_id = ?
     ORDER BY e.expires_at DESC`
  )
    .bind(user.id)
    .all();

  const orders = await env.DB.prepare(
    `SELECT id, subject_id, amount_paise, status, created_at
     FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 20`
  )
    .bind(user.id)
    .all();

  const subjects = await env.DB.prepare("SELECT id, name FROM subjects").all();

  return jsonAuth({
    found: true,
    user,
    entitlements: (entitlements.results || []).map((e) => ({
      ...e,
      active: !e.revoked_at && e.expires_at > nowTs,
      manual: !e.order_id && !e.payment_id,
    })),
    orders: orders.results || [],
    subjects: subjects.results || [],
  });
}

async function adminGrant(request, env) {
  const jsonAuth = (data, status = 200) => json(data, status, corsHeadersWithCredentials(request));
  const admin = await getAdminFromSession(request, env);
  if (!admin) return jsonAuth({ error: "Not authorized" }, 401);

  try {
    const { user_id, subject_id, reason, duration_days } = await request.json();
    if (!user_id || !subject_id || !reason || !reason.trim()) {
      return jsonAuth({ error: "user_id, subject_id, and reason are all required" }, 400);
    }

    const days = Number(duration_days) || 45;
    if (days < 1 || days > 365) {
      return jsonAuth({ error: "duration_days must be between 1 and 365" }, 400);
    }

    const nowTs = Math.floor(Date.now() / 1000);
    const ACCESS_DURATION_SECONDS = days * 24 * 60 * 60;
    const expiresAt = nowTs + ACCESS_DURATION_SECONDS;
    const entitlementId = crypto.randomUUID();

    // order_id/payment_id are NOT NULL on the real table, so '' is used as the
    // "no real payment" sentinel instead of NULL — never fake a Razorpay record
    // for manual access, per the locked spec, just represented as empty string
    // rather than NULL to satisfy the column constraint. granted_at already
    // exists on this table with its own unixepoch() default — left alone here.
    await env.DB.prepare(
      `INSERT INTO entitlements (id, user_id, subject_id, order_id, payment_id, expires_at, granted_reason, granted_by)
       VALUES (?, ?, ?, '', '', ?, ?, ?)
       ON CONFLICT(user_id, subject_id) DO UPDATE SET
         expires_at = excluded.expires_at,
         order_id = '',
         payment_id = '',
         granted_reason = excluded.granted_reason,
         granted_by = excluded.granted_by,
         granted_at = unixepoch(),
         revoked_at = NULL,
         revoked_reason = NULL,
         revoked_by = NULL`
    )
      .bind(entitlementId, user_id, subject_id, expiresAt, reason.trim(), admin.admin_identifier)
      .run();

    await env.DB.prepare(
      `INSERT INTO admin_audit_log (id, action, admin_identifier, user_id, subject_id, entitlement_id, reason, created_at)
       VALUES (?, 'grant', ?, ?, ?, ?, ?, ?)`
    )
      .bind(crypto.randomUUID(), admin.admin_identifier, user_id, subject_id, entitlementId, reason.trim(), nowTs)
      .run();

    return jsonAuth({ ok: true, expires_at: expiresAt, days_granted: days });
  } catch (err) {
    return jsonAuth({ error: "Server error", detail: String(err) }, 500);
  }
}

async function adminRevoke(request, env) {
  const jsonAuth = (data, status = 200) => json(data, status, corsHeadersWithCredentials(request));
  const admin = await getAdminFromSession(request, env);
  if (!admin) return jsonAuth({ error: "Not authorized" }, 401);

  try {
    const { entitlement_id, reason } = await request.json();
    if (!entitlement_id || !reason || !reason.trim()) {
      return jsonAuth({ error: "entitlement_id and reason are required" }, 400);
    }

    const entitlement = await env.DB.prepare(
      "SELECT id, user_id, subject_id, order_id, payment_id FROM entitlements WHERE id = ?"
    )
      .bind(entitlement_id)
      .first();

    if (!entitlement) return jsonAuth({ error: "Entitlement not found" }, 404);

    // Per spec: the console only revokes MANUAL entitlements — protects against
    // accidentally revoking a real paid subscription. Paid entitlements have
    // order_id/payment_id set and simply are not revocable from here.
    if (entitlement.order_id || entitlement.payment_id) {
      return jsonAuth({ error: "This is a paid entitlement, not a manual grant — cannot revoke from here" }, 400);
    }

    const nowTs = Math.floor(Date.now() / 1000);
    await env.DB.prepare(
      `UPDATE entitlements SET expires_at = ?, revoked_at = ?, revoked_reason = ?, revoked_by = ? WHERE id = ?`
    )
      .bind(nowTs, nowTs, reason.trim(), admin.admin_identifier, entitlement_id)
      .run();

    await env.DB.prepare(
      `INSERT INTO admin_audit_log (id, action, admin_identifier, user_id, subject_id, entitlement_id, reason, created_at)
       VALUES (?, 'revoke', ?, ?, ?, ?, ?, ?)`
    )
      .bind(crypto.randomUUID(), admin.admin_identifier, entitlement.user_id, entitlement.subject_id, entitlement_id, reason.trim(), nowTs)
      .run();

    return jsonAuth({ ok: true });
  } catch (err) {
    return jsonAuth({ error: "Server error", detail: String(err) }, 500);
  }
}

// ---------- 11. Chapter answers (entitlement-gated content delivery) ----------
// This is the ONLY place full answer text/tables ever leave the server.
// Nothing here is ever baked into the Astro static build.
async function getChapterAnswers(request, env) {
  const jsonAuth = (data, status = 200) =>
    json(data, status, corsHeadersWithCredentials(request));

  const url = new URL(request.url);
  const chapterSlug = url.searchParams.get("chapter_slug");

  if (!chapterSlug) {
    return jsonAuth({ error: "chapter_slug required" }, 400);
  }

  const chapter = await env.DB.prepare(
    "SELECT subject_id, answers_json FROM chapter_content WHERE chapter_slug = ?"
  )
    .bind(chapterSlug)
    .first();

  if (!chapter) {
    return jsonAuth({ error: "Chapter not found" }, 404);
  }

  const user = await getUserFromSession(request, env);
  if (!user) {
    return jsonAuth({ error: "Login required", locked: true }, 401);
  }

  // Admin bypass: same ADMIN_PHONES check as the single-answer endpoint,
  // so the background bulk-fetch (used to speed up repeat clicks) also
  // works for admin accounts on subjects they haven't "purchased".
  if (env.ADMIN_PHONES) {
    const adminPhones = env.ADMIN_PHONES.split(",").map((p) => p.trim());
    if (adminPhones.includes(user.phone)) {
      let answers;
      try {
        answers = JSON.parse(chapter.answers_json);
      } catch (err) {
        return jsonAuth({ error: "Content error" }, 500);
      }
      return jsonAuth({ answers, admin: true });
    }
  }

  const nowTs = Math.floor(Date.now() / 1000);
  const entitlement = await env.DB.prepare(
    "SELECT id FROM entitlements WHERE user_id = ? AND subject_id = ? AND expires_at > ?"
  )
    .bind(user.id, chapter.subject_id, nowTs)
    .first();

  if (!entitlement) {
    return jsonAuth({ error: "This subject is not currently unlocked on your account. Purchase for 45 days of unlimited access.", locked: true }, 403);
  }

  // answers_json is already a JSON string in D1 — parse then re-send as real JSON
  let answers;
  try {
    answers = JSON.parse(chapter.answers_json);
  } catch (err) {
    return jsonAuth({ error: "Content error" }, 500);
  }

  return jsonAuth({ answers });
}

// Daily free-click limit for subjects NOT purchased — flat, same for everyone,
// login status makes no difference (per the locked no-login-for-free-tier design).
const FREE_CLICKS_LIMIT = 15;
const ANON_COOKIE_NAME = "sh_anon_id";
const ANON_COOKIE_LIFETIME_SECONDS = 400 * 24 * 60 * 60; // ~13 months, so returning visitors keep a stable anon id

function todayUtc() {
  return new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
}

function getAnonIdFromRequest(request) {
  const cookieHeader = request.headers.get("Cookie") || "";
  const match = cookieHeader.match(/sh_anon_id=([^;]+)/);
  return match ? match[1] : null;
}

// ---------- 12. Single-answer delivery with free-click limiting ----------
// Used for subjects the visitor has NOT purchased. Purchased subjects always
// go through the full-chapter endpoint above (no limit). This endpoint hands
// out exactly one answer per call, so the daily free-click count is a real
// boundary — not something already sitting in the browser's memory.
async function getSingleAnswer(request, env) {
  const jsonAuth = (data, status = 200, extraHeaders = {}) =>
    json(data, status, { ...corsHeadersWithCredentials(request), ...extraHeaders });

  const url = new URL(request.url);
  const chapterSlug = url.searchParams.get("chapter_slug");
  const index = parseInt(url.searchParams.get("index"), 10);

  if (!chapterSlug || Number.isNaN(index)) {
    return jsonAuth({ error: "chapter_slug and index required" }, 400);
  }

  const chapter = await env.DB.prepare(
    "SELECT subject_id, answers_json FROM chapter_content WHERE chapter_slug = ?"
  )
    .bind(chapterSlug)
    .first();

  if (!chapter) {
    return jsonAuth({ error: "Chapter not found" }, 404);
  }

  let answersArr;
  try {
    answersArr = JSON.parse(chapter.answers_json);
  } catch (err) {
    return jsonAuth({ error: "Content error" }, 500);
  }

  if (index < 0 || index >= answersArr.length) {
    return jsonAuth({ error: "Invalid question index" }, 400);
  }

  const answer = answersArr[index];

  // Admin bypass: your own phone number(s), set via the ADMIN_PHONES secret
  // (comma-separated, e.g. "9876543210,9123456789"), get unlimited access
  // everywhere with no free-click counting — for content review/testing.
  const user = await getUserFromSession(request, env);
  if (user && env.ADMIN_PHONES) {
    const adminPhones = env.ADMIN_PHONES.split(",").map((p) => p.trim());
    if (adminPhones.includes(user.phone)) {
      return jsonAuth({ answer, unlimited: true, admin: true });
    }
  }

  // 1. Logged in AND purchased this subject (within the 45-day window) ->
  // always unlimited, no counting at all. Once expired, this correctly
  // falls through to the free-click budget below like any unpurchased user.
  if (user) {
    const nowTs = Math.floor(Date.now() / 1000);
    const entitlement = await env.DB.prepare(
      "SELECT id FROM entitlements WHERE user_id = ? AND subject_id = ? AND expires_at > ?"
    )
      .bind(user.id, chapter.subject_id, nowTs)
      .first();

    if (entitlement) {
      return jsonAuth({ answer, unlimited: true });
    }
  }

  // 2. Not entitled (logged in but unpurchased, or fully anonymous) -> free-click
  // budget applies. Login status is irrelevant here by design — the free tier
  // needs no account at all.
  //
  // Primary tracking key is a client-computed device fingerprint (hash of
  // userAgent + screen size + timezone + hardwareConcurrency), passed as
  // ?fp=. Unlike the sh_anon_id cookie, this survives private/incognito
  // browsing since it's derived from stable device/browser properties
  // rather than stored state — closing the incognito reset loophole the
  // cookie-only approach had.
  //
  // Falls back to the cookie if no fingerprint was sent (e.g. an old cached
  // page still loaded, or JS fingerprinting failed for some reason) so
  // nothing breaks — just loses incognito-resistance for that request.
  const dailyLimit = FREE_CLICKS_LIMIT;
  const today = todayUtc();

  const fingerprint = url.searchParams.get("fp");
  let extraCookieHeader = {};
  let actorId;
  let actorType;

  if (fingerprint && /^[a-f0-9]{16,64}$/i.test(fingerprint)) {
    actorId = fingerprint;
    actorType = "fp";
  } else {
    actorId = getAnonIdFromRequest(request);
    if (!actorId) {
      actorId = crypto.randomUUID();
      extraCookieHeader["Set-Cookie"] =
        `${ANON_COOKIE_NAME}=${actorId}; Path=/; Max-Age=${ANON_COOKIE_LIFETIME_SECONDS}; Secure; SameSite=Lax`;
      // Not HttpOnly: this is a soft, best-effort free-trial counter (not a
      // security boundary), matching the accepted design in the workflow doc.
    }
    actorType = "anon";
  }

  // Single atomic upsert: increment (or create) today's count for this
  // actor+subject in ONE database round-trip instead of a separate
  // SELECT-then-INSERT/UPDATE (which was 2 round-trips). If this pushes
  // the count past the daily limit, we simply don't return the answer for
  // that call — the log ends up counting the blocked attempt too, which
  // doesn't affect correctness (the person is still correctly blocked the
  // moment their real usage exceeds the limit).
  const newCountRow = await env.DB.prepare(
    `INSERT INTO free_click_log (id, actor_type, actor_id, subject_id, click_date, count)
     VALUES (?, ?, ?, ?, ?, 1)
     ON CONFLICT(actor_type, actor_id, subject_id, click_date)
     DO UPDATE SET count = count + 1
     RETURNING count`
  )
    .bind(crypto.randomUUID(), actorType, actorId, chapter.subject_id, today)
    .first();

  const newCount = newCountRow.count;

  if (newCount > dailyLimit) {
    return jsonAuth(
      {
        error: `You've reached today's ${dailyLimit} free answers for this subject. Purchase for 45 days of unlimited access, or come back tomorrow.`,
        locked: true,
        limitReached: true,
        remaining: 0,
        dailyLimit,
      },
      403,
      extraCookieHeader
    );
  }

  return jsonAuth(
    { answer, remaining: dailyLimit - newCount, dailyLimit },
    200,
    extraCookieHeader
  );
}

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS, ...extraHeaders },
  });
}
