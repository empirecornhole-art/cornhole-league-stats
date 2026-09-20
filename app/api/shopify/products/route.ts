import { NextResponse } from "next/server";
import { shopifyFetch } from "../../../../lib/shopify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PRODUCTS_QUERY = `
  query StoreProducts($first: Int!, $after: String) {
    products(first: $first, after: $after, sortKey: TITLE) {
      edges {
        cursor
        node {
          id
          title
          handle
          description
          availableForSale
          featuredImage {
            url
            altText
          }
          priceRange {
            minVariantPrice { amount currencyCode }
            maxVariantPrice { amount currencyCode }
          }
          options {
            name
            values
          }
          variants(first: 50) {
            edges {
              node {
                id
                title
                availableForSale
                price { amount currencyCode }
                selectedOptions { name value }
                image {
                  url
                  altText
                }
              }
            }
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

// A page size of 50 with a hard cap keeps this to a handful of requests even
// for a large catalog, without risking an unbounded loop against the API.
const PAGE_SIZE = 50;
const MAX_PRODUCTS = 500;

export async function GET() {
  try {
    const products: any[] = [];
    let after: string | null = null;
    let hasNextPage = true;

    while (hasNextPage && products.length < MAX_PRODUCTS) {
      const data: any = await shopifyFetch(PRODUCTS_QUERY, { first: PAGE_SIZE, after });
      const edges = data?.products?.edges || [];

      for (const edge of edges) {
        const node = edge.node;
        products.push({
          id: node.id,
          title: node.title,
          handle: node.handle,
          description: node.description,
          availableForSale: node.availableForSale,
          image: node.featuredImage ? { url: node.featuredImage.url, alt: node.featuredImage.altText } : null,
          priceRange: {
            min: node.priceRange.minVariantPrice,
            max: node.priceRange.maxVariantPrice,
          },
          // e.g. [{ name: "Color", values: ["Black", "Red"] }, { name: "Size", values: ["S", "M", "L"] }]
          options: (node.options || []).filter((o: any) => !(o.name === "Title" && o.values?.length === 1 && o.values[0] === "Default Title")),
          variants: (node.variants?.edges || []).map((v: any) => ({
            id: v.node.id,
            title: v.node.title,
            availableForSale: v.node.availableForSale,
            price: v.node.price,
            options: v.node.selectedOptions,
            image: v.node.image ? { url: v.node.image.url, alt: v.node.image.altText } : null,
          })),
        });
      }

      hasNextPage = Boolean(data?.products?.pageInfo?.hasNextPage);
      after = data?.products?.pageInfo?.endCursor || null;
    }

    return NextResponse.json({ products });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to load products from Shopify", products: [] },
      { status: 500 }
    );
  }
}
