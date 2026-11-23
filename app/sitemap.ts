import type { MetadataRoute } from "next";
import { SITE_URL } from "../lib/site";
import { listRecapPages } from "../lib/recapPages";

// Recap pages are added as they're published; refreshed hourly.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let recaps: Awaited<ReturnType<typeof listRecapPages>> = [];
  try {
    recaps = await listRecapPages();
  } catch {
    // Data source unavailable: still serve the static pages.
  }

  return [
    { url: `${SITE_URL}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/leagues`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE_URL}/recaps`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE_URL}/events`, changeFrequency: "weekly", priority: 0.8 },
    ...recaps.map((recap) => ({
      url: `${SITE_URL}/recaps/${recap.slug}`,
      lastModified: recap.updated ? new Date(recap.updated) : undefined,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    { url: `${SITE_URL}/contact`, changeFrequency: "monthly", priority: 0.5 },
  ];
}
