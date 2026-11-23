import type { Metadata } from "next";
import Link from "next/link";
import { listRecapPages, type RecapPage } from "../../lib/recapPages";

export const metadata: Metadata = {
  title: "Weekly Cornhole Recaps & Results",
  description:
    "Week-by-week recaps from Empire Cornhole League in New Berlin, NY: Switch and Blind Draw results, games of the night and photos.",
  alternates: { canonical: "/recaps" },
};

// Rebuilt at most every 5 minutes.
export const revalidate = 300;

async function load(): Promise<RecapPage[]> {
  try {
    return await listRecapPages();
  } catch {
    return [];
  }
}

export default async function RecapsIndex() {
  const recaps = await load();

  return (
    <main className="bg-brand-bg">
      <section className="mx-auto max-w-4xl px-4 py-14 text-center md:px-6 md:py-24">
        <span className="eyebrow">Weekly</span>
        <h1 className="heading-page mt-4">Recaps</h1>
        <p className="mx-auto mt-5 max-w-xl font-sans text-lg text-brand-textSecondary">
          Every game night written up: who won, the games of the night, and the photos.
        </p>
      </section>

      <section className="mx-auto max-w-4xl px-4 pb-20 md:px-6 md:pb-28">
        {recaps.length === 0 ? (
          <p className="rounded-2xl bg-brand-panel p-8 text-center font-sans text-brand-textSecondary">
            No recaps are published yet. Check back after the next game night, or see the{" "}
            <Link href="/leagues" className="font-bold text-brand-orange underline-offset-4 hover:underline">
              league standings
            </Link>
            .
          </p>
        ) : (
          <ul className="space-y-4">
            {recaps.map((recap) => (
              <li key={recap.slug}>
                <Link
                  href={`/recaps/${recap.slug}`}
                  className="block rounded-2xl border border-white/10 bg-brand-panel p-6 transition-colors duration-200 hover:bg-brand-raised md:p-8"
                >
                  <span className="eyebrow">{recap.season}</span>
                  <h2 className="mt-2 font-display text-3xl uppercase leading-none text-brand-text md:text-4xl">
                    Week {recap.week} recap
                  </h2>
                  {recap.excerpt && <p className="mt-3 font-sans text-brand-textSecondary">{recap.excerpt}</p>}
                  <span className="mt-4 inline-block font-sans text-sm font-bold text-brand-orange">
                    Read the recap{recap.photos.length > 0 ? ` and ${recap.photos.length} photos` : ""} &rarr;
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
