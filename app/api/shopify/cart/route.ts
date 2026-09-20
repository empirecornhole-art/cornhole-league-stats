import { NextResponse } from "next/server";
import { shopifyFetch } from "../../../../lib/shopify";

export const runtime = "nodejs";

const CART_CREATE = `
  mutation CreateCart($lines: [CartLineInput!]!) {
    cartCreate(input: { lines: $lines }) {
      cart {
        id
        checkoutUrl
      }
      userErrors {
        field
        message
      }
    }
  }
`;

// Takes the shopper's local cart (built up client-side while browsing the
// Store tab) and turns it into a real Shopify cart in one call, handing back
// the hosted checkout URL to redirect to. Nothing about payment happens here
// or anywhere else in this app -- that's Shopify's own secure checkout.
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const rawLines = Array.isArray(body?.lines) ? body.lines : [];

    const lines = rawLines
      .filter((line: any) => typeof line?.variantId === "string" && line.variantId)
      .map((line: any) => ({
        merchandiseId: line.variantId,
        quantity: Math.max(1, Math.min(99, Number(line.quantity) || 1)),
      }));

    if (!lines.length) {
      return NextResponse.json({ error: "Your cart is empty." }, { status: 400 });
    }

    const data: any = await shopifyFetch(CART_CREATE, { lines });
    const userErrors = data?.cartCreate?.userErrors || [];
    if (userErrors.length) {
      return NextResponse.json({ error: userErrors.map((e: any) => e.message).join("; ") }, { status: 400 });
    }

    const checkoutUrl = data?.cartCreate?.cart?.checkoutUrl;
    if (!checkoutUrl) {
      return NextResponse.json({ error: "Shopify did not return a checkout URL." }, { status: 500 });
    }

    return NextResponse.json({ checkoutUrl });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to start checkout" }, { status: 500 });
  }
}
