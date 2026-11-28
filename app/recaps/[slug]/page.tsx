import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import RecapBody from "../../../components/site/RecapBody";
import PhotoThumb from "../../../components/site/PhotoThumb";
import JsonLd from "../../../components/site/JsonLd";
import ShareButton from "../../../components/site/ShareButton";
import { getRecapPage, listRecapPages, type RecapPage } from "../../../lib/recapPages";
import { SITE_NAME, SITE_URL } from "../../../lib/site";

// Rebuilt at most every 5 minutes; new recaps are picked up on first visit.
export const revalidate = 300;

type Params = { slug: string };

// Existing recaps are prebuilt; a recap published later is built on its first visit, then cached.
export async function generateStaticParams(): Promise<Params[]> {
  try {
    return (await listRecapPages()).map((r) => ({ slug: r.slug }));
  } catch {
    return [];
  }
}

async function load(slug: string) {
  try {
    return await getRecapPage(slug);
  } catch {
    return null;
  }
}

const ogPhoto = (recap: RecapPage) => recap.photos.find((p) => /^https?:\/\//.test(p.url))?.url;

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const page = await load(slug);
  if (!page) return { title: "Recap not found", robots: { index: false } };

  const { recap } = page;
  const title = recap.formats ? `${recap.title}: ${recap.formats} Results` : recap.title;
  const description =
    recap.excerpt ||
    `${recap.season} Week ${recap.week} results and recap from Empire Cornhole League in New Berlin, NY.`;
  // A designed card for this week (week + winners). The version in the URL changes when the recap is
  // republished, so Facebook and others fetch a fresh card instead of a cached one.
  const image = `/og/recap/${recap.slug}${recap.updated ? `?v=${new Date(recap.updated).getTime()}` : ""}`;

  return {
    title,
    description,
    alternates: { canonical: `/recaps/${recap.slug}` },
    openGraph: {
      type: "article",
      siteName: SITE_NAME,
      title: `${title} | ${SITE_NAME}`,
      description,
      images: [{ url: image }],
    },
    twitter: { card: "summary_large_image", title: `${title} | ${SITE_NAME}`, description, images: [image] },
  };
}

function PagerLink({ recap, label }: { recap: RecapPage; label: string }) {
  return (
    <Link
      href={`/recaps/${recap.slug}`}
      className="block rounded-2xl border border-white/10 bg-brand-panel p-5 transition-colors duration-200 hover:bg-brand-raised"
    >
      <span className="eyebrow">{label}</span>
      <span className="mt-2 block font-display text-2xl uppercase leading-tight text-brand-text">
        {recap.season} Week {recap.week}
      </span>
    </Link>
  );
}

export default async function RecapPageRoute({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const page = await load(slug);
  if (!page) notFound();

  const { recap, newer, older } = page;
  const resultsHref = `/leagues?tab=weeks&season=${encodeURIComponent(recap.season)}&week=${encodeURIComponent(`Week ${recap.week}`)}`;
  const photosHref = `/leagues?tab=photos&season=${encodeURIComponent(recap.season)}&week=${encodeURIComponent(`Week ${recap.week}`)}`;
  const image = ogPhoto(recap);

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: recap.formats ? `${recap.title}: ${recap.formats} Results` : recap.title,
    description: recap.excerpt || undefined,
    dateModified: recap.updated || undefined,
    mainEntityOfPage: `${SITE_URL}/recaps/${recap.slug}`,
    image: image || `${SITE_URL}/og`,
    author: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
    publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL, logo: { "@type": "ImageObject", url: `${SITE_URL}/ec-logo.png` } },
  };
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
      { "@type": "ListItem", position: 2, name: "Recaps", item: `${SITE_URL}/recaps` },
      { "@type": "ListItem", position: 3, name: recap.title, item: `${SITE_URL}/recaps/${recap.slug}` },
    ],
  };

  return (
    <main className="bg-brand-bg">
      <JsonLd data={[articleJsonLd, breadcrumbJsonLd]} />

      <section className="mx-auto max-w-4xl px-4 pb-6 pt-12 md:px-6 md:pt-20">
        <Link href="/recaps" className="font-sans text-sm font-bold text-brand-orange underline-offset-4 hover:underline">
          &larr; All recaps
        </Link>
        <span className="eyebrow mt-6 block">{recap.season} &middot; Week {recap.week}</span>
        <h1 className="heading-page mt-3">{recap.title}</h1>
        {recap.formats && (
          <p className="mt-4 font-sans text-lg text-brand-textSecondary">
            {recap.formats} results from game night at Empire Cornhole League in New Berlin, NY.
          </p>
        )}
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href={resultsHref} className="btn-primary">
            Full results &amp; standings
          </Link>
          {recap.photos.length > 0 && (
            <Link href={photosHref} className="btn-secondary">
              All photos
            </Link>
          )}
          <ShareButton
            path={`/recaps/${recap.slug}`}
            title={`${recap.title} | ${SITE_NAME}`}
            text={recap.excerpt || `${recap.season} Week ${recap.week} results from ${SITE_NAME}.`}
          />
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 pb-10 md:px-6">
        <div className="rounded-3xl bg-brand-panel p-6 md:p-10">
          <RecapBody text={recap.body} headingLevel={2} />
        </div>
      </section>

      {recap.photos.length > 0 && (
        <section className="mx-auto max-w-4xl px-4 pb-10 md:px-6">
          <h2 className="heading-section">Photos</h2>
          <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
            {recap.photos.map((photo, i) => (
              <Link
                key={photo.id}
                href={photosHref}
                aria-label={`View ${recap.season} Week ${recap.week} photo ${i + 1}`}
                className="relative block aspect-square overflow-hidden rounded-2xl bg-brand-panel"
              >
                <PhotoThumb
                  src={photo.url}
                  alt={photo.caption || `Empire Cornhole League ${recap.season} Week ${recap.week} game night in New Berlin, NY, photo ${i + 1}`}
                  width={640}
                  className="object-[50%_25%]"
                />
              </Link>
            ))}
          </div>
        </section>
      )}

      {(newer || older) && (
        <nav aria-label="More recaps" className="mx-auto grid max-w-4xl gap-4 px-4 pb-20 sm:grid-cols-2 md:px-6">
          {older ? <PagerLink recap={older} label="Previous week" /> : <span />}
          {newer ? <PagerLink recap={newer} label="Next week" /> : <span />}
        </nav>
      )}
    </main>
  );
}
