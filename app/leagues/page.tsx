import { Suspense } from "react";
import type { Metadata } from "next";
import LeagueClient, { LoadingSkeleton } from "../../components/LeagueClient";
import { getLatestImportedWeek } from "../../lib/dataStamp";
import { getHomeStandings, type HomeStandings } from "../../lib/homeStandings";

export const metadata: Metadata = {
  title: "League Standings & Results",
  description:
    "Season standings, weekly results, all-time leaders and player profiles for Empire Cornhole League's blind draw and switch nights in New Berlin, NY.",
  alternates: { canonical: "/leagues" },
};

// The interactive League view loads its data in the browser, so without this
// the server HTML would be an empty skeleton. This renders the current
// season's standings into that first paint (and what search engines read
// before running JavaScript); LeagueClient swaps in the full view once loaded.
export const revalidate = 300;

async function loadStandings(): Promise<HomeStandings | null> {
  try {
    const latest = await getLatestImportedWeek();
    // getHomeStandings returns null for an empty season (and serves mock data in local dev).
    return await getHomeStandings(latest?.season ?? "", 100);
  } catch {
    return null;
  }
}

function StandingsFirstPaint({ standings }: { standings: HomeStandings }) {
  return (
    <main className="min-h-screen bg-brand-bg text-brand-text">
      <header className="bg-brand-panel">
        <div className="mx-auto max-w-7xl px-4 pb-5 pt-8 md:px-6 md:pt-12">
          <span className="eyebrow">{standings.season}</span>
          <h1 className="mt-2 font-display text-5xl uppercase leading-none text-brand-text md:text-6xl">League</h1>
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-4 py-10 md:px-6 md:py-14">
        <h2 className="heading-section">{standings.season} standings</h2>
        <p className="mt-3 font-sans text-brand-textSecondary">
          Empire Cornhole League plays weekly blind draw and switch nights in New Berlin, NY. Here is where all{" "}
          {standings.playerCount} players stand in {standings.season}.
        </p>
        <ol className="mt-8 divide-y divide-white/10 rounded-2xl bg-brand-panel">
          {standings.rows.map((row, i) => (
            <li key={`${row.name}-${i}`} className="flex items-center gap-4 px-5 py-3 font-sans">
              <span className="w-8 font-display text-xl text-brand-textFaint">{i + 1}</span>
              <span className="flex-1 truncate font-bold text-brand-text">{row.name}</span>
              <span className="font-display text-xl text-brand-orange">{row.points}</span>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}

export default async function LeaguePage() {
  const standings = await loadStandings();
  const firstPaint = standings ? <StandingsFirstPaint standings={standings} /> : undefined;

  return (
    <Suspense fallback={firstPaint ?? <LoadingSkeleton />}>
      <LeagueClient initialView={firstPaint} />
    </Suspense>
  );
}
