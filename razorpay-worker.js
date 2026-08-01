// studyhelp — Razorpay payment Worker
// Bindings needed (set in wrangler.toml or dashboard):
//   DB                  -> D1 database binding
//   RAZORPAY_KEY_ID     -> secret (test: rzp_test_xxx)
//   RAZORPAY_KEY_SECRET -> secret
//   RAZORPAY_WEBHOOK_SECRET -> secret (set this string in Razorpay dashboard webhook config too)

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
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

    // Already entitled? Don't let them pay twice.
    const existing = await env.DB.prepare(
      "SELECT id FROM entitlements WHERE user_id = ? AND subject_id = ?"
    )
      .bind(user_id, subject_id)
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

    // Idempotent: only insert if not already entitled (handles Razorpay webhook retries)
    await env.DB.prepare(
      `INSERT INTO entitlements (id, user_id, subject_id, order_id, payment_id)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(user_id, subject_id) DO NOTHING`
    )
      .bind(crypto.randomUUID(), order.user_id, order.subject_id, orderId, paymentId)
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

  const entitlement = await env.DB.prepare(
    "SELECT id FROM entitlements WHERE user_id = ? AND subject_id = ?"
  )
    .bind(user_id, subject_id)
    .first();

  return json({ unlocked: !!entitlement });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}
