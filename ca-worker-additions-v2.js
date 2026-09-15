// ============================================================
// ADDITIONS TO razorpay-worker.js -- REVISED to match your real
// architecture: create-order -> Razorpay checkout -> webhook is the
// SOURCE OF TRUTH that writes the actual unlock (not payment-callback,
// which only verifies signature + redirects). Matches createOrder() /
// handleWebhook() exactly.
// ============================================================
//
// Paste-in guide:
// 1. Route wiring (3 routes)     -> inside fetch(), alongside other routes
// 2. authRoutes array            -> add "/ca/create-order", "/ca/purchases"
//    (NOT /ca/payment-callback -- that's a plain form POST redirect, same
//    as /payment-callback, doesn't need credentialed CORS; NOT
//    /ca/download either, same reasoning as before)
// 3. The 4 functions below       -> paste alongside your other handlers
// 4. handleWebhook() EDIT        -> add the CA branch shown at the bottom
//    of this file into your EXISTING handleWebhook() function

// ---------- 1. Route wiring ----------
// if (url.pathname === "/ca/create-order" && request.method === "POST") {
//   return createCaOrder(request, env);
// }
// if (url.pathname === "/ca/payment-callback" && request.method === "POST") {
//   return handleCaPaymentCallback(request, env);
// }
// if (url.pathname === "/ca/purchases" && request.method === "GET") {
//   return getCaPurchases(request, env);
// }
// if (url.pathname === "/ca/download" && request.method === "GET") {
//   return downloadCaPdf(request, env);
// }

// ---------- 2. Handler functions ----------

// POST /ca/create-order  { item_id }
// Deliberately session-gated (unlike your existing createOrder(), which
// trusts a client-supplied user_id) -- this is the one intentional
// deviation from the Subjects pattern, per your "logged-in only, no
// guest downloads" requirement for CA.
async function createCaOrder(request, env) {
  const jsonAuth = (data, status = 200) =>
    json(data, status, corsHeadersWithCredentials(request));

  const user = await getUserFromSession(request, env);
  if (!user) {
    return jsonAuth({ error: "Please log in to purchase." }, 401);
  }

  let body;
  try {
    body = await request.json();
  } catch (_err) {
    return jsonAuth({ error: "Invalid request body" }, 400);
  }

  const { item_id } = body || {};
  const item = item_id ? CA_CATALOG[item_id] : null;
  if (!item) {
    return jsonAuth({ error: "Unknown item_id" }, 400);
  }

  // Already owns it -- don't let them pay twice.
  const existing = await env.DB.prepare(
    "SELECT id FROM ca_purchases WHERE user_id = ? AND item_id = ?"
  )
    .bind(user.id, item_id)
    .first();
  if (existing) {
    return jsonAuth({ error: "Already purchased" }, 409);
  }

  // Same Razorpay Orders API call as createOrder() -- amount always from
  // CA_CATALOG server-side, never from the client.
  const auth = btoa(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`);
  const rpRes = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${auth}`,
    },
    body: JSON.stringify({
      amount: item.amountPaise,
      currency: "INR",
      notes: { user_id: user.id, item_id },
    }),
  });

  if (!rpRes.ok) {
    const errBody = await rpRes.text();
    return jsonAuth({ error: "Razorpay order creation failed", detail: errBody }, 502);
  }

  const rpOrder = await rpRes.json();

  await env.DB.prepare(
    `INSERT INTO ca_orders (id, user_id, item_id, amount_paise, status)
     VALUES (?, ?, ?, ?, 'created')`
  )
    .bind(rpOrder.id, user.id, item_id, item.amountPaise)
    .run();

  return jsonAuth({
    order_id: rpOrder.id,
    amount: rpOrder.amount,
    currency: rpOrder.currency,
    key_id: env.RAZORPAY_KEY_ID,
  });
}

// POST /ca/payment-callback (form POST from Razorpay checkout redirect)
// Mirrors handlePaymentCallback() exactly: verify signature, redirect.
// Does NOT write the purchase -- the webhook does that (source of truth).
async function handleCaPaymentCallback(request, env) {
  const formData = await request.formData();
  const razorpay_payment_id = formData.get("razorpay_payment_id");
  const razorpay_order_id = formData.get("razorpay_order_id");
  const razorpay_signature = formData.get("razorpay_signature");

  const APP_URL = "https://studyhelp.fdaytalk.com";

  if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
    return Response.redirect(`${APP_URL}/current-affairs/`, 302);
  }

  const expectedBody = `${razorpay_order_id}|${razorpay_payment_id}`;
  const validSignature = await verifySignature(expectedBody, razorpay_signature, env.RAZORPAY_KEY_SECRET);

  if (!validSignature) {
    return Response.redirect(`${APP_URL}/current-affairs/?payment_error=1`, 302);
  }

  return Response.redirect(`${APP_URL}/current-affairs/?ca_success=1`, 302);
}

// GET /ca/purchases -- one call returns every item_id this user owns.
async function getCaPurchases(request, env) {
  const jsonAuth = (data, status = 200) =>
    json(data, status, corsHeadersWithCredentials(request));

  const user = await getUserFromSession(request, env);
  if (!user) {
    return jsonAuth({ purchases: [] }, 401);
  }

  const { results } = await env.DB.prepare(
    "SELECT item_id, item_type, month_range, purchase_date FROM ca_purchases WHERE user_id = ?"
  )
    .bind(user.id)
    .all();

  return jsonAuth({ purchases: results || [] });
}

// GET /ca/download?item_id=... -- re-checks ownership on every call, then
// streams the PDF directly (the Worker IS the gate -- no separate signed
// URL to leak or share).
async function downloadCaPdf(request, env) {
  const url = new URL(request.url);
  const item_id = url.searchParams.get("item_id");

  const user = await getUserFromSession(request, env);
  if (!user) {
    return new Response("Please log in to download this file.", { status: 401 });
  }

  if (!item_id || !CA_CATALOG[item_id]) {
    return new Response("Unknown item.", { status: 400 });
  }

  const owns = await env.DB.prepare(
    "SELECT id FROM ca_purchases WHERE user_id = ? AND item_id = ?"
  )
    .bind(user.id, item_id)
    .first();

  if (!owns) {
    return new Response("You have not purchased this item.", { status: 403 });
  }

  const r2ObjectKey = getCaR2Key(item_id);
  const object = await env.CA_PDFS.get(r2ObjectKey);
  if (!object) {
    return new Response("File not found.", { status: 404 });
  }

  return new Response(object.body, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${r2ObjectKey}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

// ---------- 3. EDIT to your EXISTING handleWebhook() ----------
// Inside the `if (payload.event === "payment.captured")` block, your
// existing code does:
//
//   const order = await env.DB.prepare("SELECT * FROM orders WHERE id = ?")
//     .bind(orderId).first();
//   if (!order) {
//     return new Response("ok", { status: 200 });
//   }
//
// Change that "if (!order)" block to check ca_orders before giving up,
// so a CA payment's webhook doesn't get silently ignored:
//
//   if (!order) {
//     const caOrder = await env.DB.prepare("SELECT * FROM ca_orders WHERE id = ?")
//       .bind(orderId).first();
//     if (!caOrder) {
//       return new Response("ok", { status: 200 });
//     }
//
//     const item = CA_CATALOG[caOrder.item_id];
//     if (item) {
//       try {
//         await env.DB.prepare(
//           `INSERT INTO ca_purchases (user_id, item_id, item_type, month_range, amount_paise, r2_object_key)
//            VALUES (?, ?, ?, ?, ?, ?)`
//         )
//           .bind(
//             caOrder.user_id,
//             caOrder.item_id,
//             item.itemType,
//             item.monthRange,
//             caOrder.amount_paise,
//             getCaR2Key(caOrder.item_id)
//           )
//           .run();
//       } catch (err) {
//         // UNIQUE(user_id, item_id) hit = webhook retry, already recorded.
//         // Not an error -- fall through to marking the order paid either way.
//       }
//       await env.DB.prepare("UPDATE ca_orders SET status = 'paid' WHERE id = ?")
//         .bind(orderId)
//         .run();
//     }
//     return new Response("ok", { status: 200 });
//   }
//
// (everything below that stays exactly as it already is, for Subjects orders)
