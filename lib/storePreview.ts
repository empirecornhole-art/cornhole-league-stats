import { shopifyFetch } from "./shopify";

export type StorePreviewItem = {
  id: string;
  title: string;
  price: string;
  imageUrl: string;
  imageAlt: string;
};

const STORE_PREVIEW_QUERY = `
  query StorePreview($first: Int!) {
    products(first: $first, sortKey: BEST_SELLING) {
      edges {
        node {
          id
          title
          availableForSale
          featuredImage { url(transform: { maxWidth: 600, maxHeight: 600 }) altText }
          priceRange { minVariantPrice { amount currencyCode } }
        }
      }
    }
  }
`;

function formatPrice(amount: string, currencyCode: string) {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: currencyCode || "USD" }).format(Number(amount));
  } catch {
    return `$${Number(amount).toFixed(2)}`;
  }
}

/**
 * A few in-stock products with photos for the homepage store teaser.
 * Never throws: if Shopify isn't configured or is down, the teaser falls
 * back to its logo panel instead of breaking the homepage.
 */
export async function getStorePreview(count: number): Promise<StorePreviewItem[]> {
  try {
    const data = await shopifyFetch<any>(STORE_PREVIEW_QUERY, { first: count * 3 });
    const nodes: any[] = data?.products?.edges?.map((e: any) => e.node) ?? [];

    return nodes
      .filter((p) => p.availableForSale && p.featuredImage?.url)
      .slice(0, count)
      .map((p) => ({
        id: p.id,
        title: p.title,
        price: formatPrice(p.priceRange.minVariantPrice.amount, p.priceRange.minVariantPrice.currencyCode),
        imageUrl: p.featuredImage.url,
        imageAlt: p.featuredImage.altText || p.title,
      }));
  } catch (error: any) {
    console.error("getStorePreview failed:", error?.message || error);
    return [];
  }
}
