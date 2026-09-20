// Thin helper around Shopify's Storefront GraphQL API. Used by the /api/shopify/*
// routes so the private Storefront access token stays server-side and never
// reaches the browser.

const SHOPIFY_API_VERSION = "2026-07";

function shopifyEndpoint() {
  const domain = process.env.SHOPIFY_STORE_DOMAIN;
  if (!domain) {
    throw new Error("Missing SHOPIFY_STORE_DOMAIN environment variable");
  }
  return `https://${domain}/api/${SHOPIFY_API_VERSION}/graphql.json`;
}

export async function shopifyFetch<T = any>(query: string, variables?: Record<string, any>): Promise<T> {
  const token = process.env.SHOPIFY_STOREFRONT_TOKEN;
  if (!token) {
    throw new Error("Missing SHOPIFY_STOREFRONT_TOKEN environment variable");
  }

  const response = await fetch(shopifyEndpoint(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // The Headless channel's *private* Storefront token (the one meant for
      // server-side use, which is what this route is) authenticates via this
      // header rather than X-Shopify-Storefront-Access-Token, which is for
      // the public/client-side token instead. Confirmed against the live
      // store -- the public header 401'd, this one returned real shop data.
      "Shopify-Storefront-Private-Token": token,
    },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Shopify Storefront API request failed (${response.status}): ${text.slice(0, 500)}`);
  }

  const json = await response.json();
  if (json.errors && json.errors.length) {
    throw new Error(json.errors.map((e: any) => e.message).join("; "));
  }

  return json.data as T;
}
