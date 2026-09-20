import { NextResponse } from "next/server";
import crypto from "crypto";

export const runtime = "nodejs";

// Verifies the request actually came from Shopify by recomputing the HMAC
// over the raw request body with the webhook signing secret (from Shopify's
// webhook setup screen) and comparing it, in constant time, to the
// X-Shopify-Hmac-Sha256 header Shopify sends.
function verifyShopifyWebhook(rawBody: string, hmacHeader: string | null, secret: string) {
  if (!hmacHeader) return false;
  const digest = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("base64");
  const expected = Buffer.from(digest);
  const received = Buffer.from(hmacHeader);
  if (expected.length !== received.length) return false;
  return crypto.timingSafeEqual(expected, received);
}

function formatAddress(addr: any) {
  if (!addr) return "";
  return [addr.address1, addr.address2, addr.city, addr.province, addr.zip, addr.country].filter(Boolean).join(", ");
}

function formatItems(lineItems: any[]) {
  if (!Array.isArray(lineItems)) return "";
  return lineItems.map((li) => `${li.quantity}x ${li.title}${li.variant_title ? ` (${li.variant_title})` : ""}`).join(", ");
}

// Shopify's order-topic webhooks (orders/create, orders/paid, orders/updated,
// orders/fulfilled) all deliver the same full Order object, tracking info
// included once it exists -- so subscribing to those four topics and
// normalizing this one shape covers a new order AND a later shipping update
// without needing to handle the narrower fulfillments/* payload shape too.
function normalizeOrder(order: any) {
  const fulfillment =
    Array.isArray(order.fulfillments) && order.fulfillments.length ? order.fulfillments[order.fulfillments.length - 1] : null;

  const customerName =
    [order.customer?.first_name, order.customer?.last_name].filter(Boolean).join(" ") ||
    [order.shipping_address?.first_name, order.shipping_address?.last_name].filter(Boolean).join(" ");

  return {
    shopifyOrderId: order.id,
    orderNumber: order.name || (order.order_number ? `#${order.order_number}` : ""),
    orderDate: order.created_at || "",
    customerName,
    email: order.email || order.customer?.email || "",
    shippingAddress: formatAddress(order.shipping_address),
    items: formatItems(order.line_items),
    total: order.total_price != null ? Number(order.total_price) : null,
    currency: order.currency || "",
    financialStatus: order.financial_status || "",
    fulfillmentStatus: order.fulfillment_status || "",
    trackingNumber: fulfillment?.tracking_number || "",
    trackingCarrier: fulfillment?.tracking_company || "",
    trackingUrl: (fulfillment?.tracking_urls && fulfillment.tracking_urls[0]) || fulfillment?.tracking_url || "",
  };
}

export async function POST(request: Request) {
  // Read the body as raw text FIRST -- HMAC verification has to run against
  // the exact bytes Shopify sent, before any JSON parsing.
  const rawBody = await request.text();
  const hmacHeader = request.headers.get("x-shopify-hmac-sha256");
  const webhookSecret = process.env.SHOPIFY_WEBHOOK_SECRET;

  if (!webhookSecret) {
    return NextResponse.json({ error: "Missing SHOPIFY_WEBHOOK_SECRET" }, { status: 500 });
  }

  if (!verifyShopifyWebhook(rawBody, hmacHeader, webhookSecret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let order: any;
  try {
    order = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const appsScriptUrl = process.env.APPS_SCRIPT_ORDERS_URL;
  const ordersSecret = process.env.SHOPIFY_ORDERS_WEBHOOK_SECRET;

  if (!appsScriptUrl || !ordersSecret) {
    return NextResponse.json({ error: "Server not configured for order sync" }, { status: 500 });
  }

  try {
    await fetch(appsScriptUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret: ordersSecret, order: normalizeOrder(order) }),
    });
  } catch (err: any) {
    // Don't fail the response to Shopify over a sheet-sync hiccup -- Shopify
    // retries failed webhook deliveries, which risks duplicate/out-of-order
    // processing. Logging is enough here; worst case a row needs a manual
    // once-over later.
    console.error("Failed to relay order to Apps Script:", err?.message || err);
  }

  return NextResponse.json({ ok: true });
}

// Lets you sanity-check the URL is live by opening it in a browser (Shopify
// itself only ever sends POST requests here).
export async function GET() {
  return NextResponse.json({ ok: true, message: "Shopify order webhook endpoint is live." });
}
