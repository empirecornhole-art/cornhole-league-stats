import Link from "next/link";
import SpotlightCard from "../reactbits/SpotlightCard/SpotlightCard";
import { CalendarIcon, StandingsIcon, TrophyIcon, BadgeIcon } from "./Icons";
import type { HomeStandings } from "../../lib/homeStandings";
import { todayDateString } from "../../lib/format";

export type BentoEvent = {
  id: string;
  day: string;
  month: string;
  title: string;
  meta: string;
  tag: string;
  event_date: string;
  dateLabel: string;
  registerUrl: string;
};

const QUICK_LINKS = [
  { href: "/leagues?tab=weeks", label: "Weekly results", icon: <CalendarIcon /> },
  { href: "/leagues?tab=alltime", label: "All-time leaders", icon: <TrophyIcon /> },
  { href: "/leagues?tab=badges", label: "Badges", icon: <BadgeIcon /> },
  { href: "/leagues?tab=players", label: "Player profiles", icon: <StandingsIcon /> },
];

// Whole days from today to a YYYY-MM-DD date; both sides read as UTC midnight so the
// server's timezone can't shift the count.
function daysUntil(eventDate: string) {
  const to = Date.parse(`${eventDate}T00:00:00Z`);
  const from = Date.parse(`${todayDateString()}T00:00:00Z`);
  if (Number.isNaN(to) || Number.isNaN(from)) return null;
  return Math.round((to - from) / 86_400_000);
}

function countdownLabel(days: number | null) {
  if (days === null) return "";
  if (days <= 0) return "Tonight";
  if (days === 1) return "Tomorrow";
  return `In ${days} days`;
}

const TILE = "rounded-3xl bg-brand-panel";

/**
 * The homepage's "right now" block: who leads the season, what's next on the
 * calendar, and quick doors into the rest of the League app. Tiles of different
 * sizes, one idea each, instead of four identical feature cards.
 */
export default function HomeBento({
  standings,
  events,
  weekLine,
}: {
  standings: HomeStandings | null;
  events: BentoEvent[];
  weekLine: string;
}) {
  const next = events[0];
  const later = events.slice(1, 3);
  const days = next ? daysUntil(next.event_date) : null;
  const leader = standings?.rows[0]?.points || 1;

  return (
    <section className="bg-brand-bg">
      <div className="mx-auto max-w-7xl px-4 py-16 md:px-6 md:py-24">
        <div className="reveal max-w-2xl">
          <span className="eyebrow">{weekLine || "This season"}</span>
          <h2 className="heading-section mt-4">Right now in the league.</h2>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-4 md:mt-14 lg:grid-cols-12 lg:gap-5">
          {/* Standings */}
          {standings && (
            <div className={`reveal ${TILE} flex flex-col p-6 md:p-8 ${next ? "lg:col-span-5 lg:row-span-2" : "lg:col-span-12"}`}>
              <div className="flex items-baseline justify-between gap-4">
                <h3 className="heading-card">Season standings</h3>
                <span className="eyebrow">{standings.season}</span>
              </div>
              <ol className="mt-6 flex-1 space-y-1">
                {standings.rows.map((row, i) => (
                  <li key={row.name}>
                    <Link
                      href="/leagues"
                      className="group grid grid-cols-[1.75rem_minmax(0,1fr)_auto] items-center gap-3 rounded-xl px-2 py-3 transition-colors duration-150 hover:bg-white/[0.05]"
                    >
                      <span className={`font-display text-2xl leading-none ${i === 0 ? "text-brand-gold" : i === 1 ? "text-brand-silver" : i === 2 ? "text-brand-bronze" : "text-brand-textMuted"}`}>
                        {i + 1}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-brand-text">{row.name}</span>
                        <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-white/[0.07]">
                          <span
                            className={`block h-full rounded-full ${i === 0 ? "bg-brand-orange" : "bg-white/40"}`}
                            style={{ width: `${Math.max(4, Math.round((row.points / leader) * 100))}%` }}
                          />
                        </span>
                      </span>
                      <span className="text-lg font-bold tabular-nums text-brand-text">{Math.round(row.points)}</span>
                    </Link>
                  </li>
                ))}
              </ol>
              <Link href="/leagues" className="mt-5 inline-flex min-h-11 items-center self-start font-sans text-[0.9375rem] font-bold text-brand-orange underline-offset-4 hover:underline">
                See all {standings.playerCount} players &rarr;
              </Link>
            </div>
          )}

          {/* Next event */}
          {next && (
            <div
              className={`reveal ${TILE} relative overflow-hidden p-6 md:p-8 ${standings ? "lg:col-span-7" : "lg:col-span-12"}`}
              style={{ "--i": 1 } as React.CSSProperties}
            >
              <div
                className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand-orange/20 blur-[90px]"
                aria-hidden
              />
              <div className="relative">
                <div className="flex items-center justify-between gap-4">
                  <span className="eyebrow">Next up</span>
                  {days !== null && <span className="rounded-full bg-brand-orange px-3 py-1 font-sans text-xs font-bold text-brand-bg">{countdownLabel(days)}</span>}
                </div>
                <h3 className="mt-5 font-display text-4xl uppercase leading-none text-brand-text md:text-6xl">{next.title}</h3>
                <p className="mt-4 font-sans text-lg text-brand-textSecondary">
                  {[next.dateLabel, next.meta].filter(Boolean).join(" · ")}
                </p>
                <div className="mt-6 flex flex-wrap items-center gap-3">
                  {next.registerUrl && (
                    <a href={next.registerUrl} target="_blank" rel="noopener noreferrer" className="btn-primary">
                      Register
                      <span className="sr-only"> (opens the sign-up page in a new tab)</span>
                    </a>
                  )}
                  <Link href="/events" className="btn-secondary">
                    Full schedule
                  </Link>
                </div>

                {later.length > 0 && (
                  <ul className="mt-8 divide-y divide-white/[0.07] border-t border-white/[0.07]">
                    {later.map((event) => (
                      <li key={event.id} className="flex items-center justify-between gap-4 py-3">
                        <span className="min-w-0 truncate font-semibold text-brand-text">{event.title}</span>
                        <span className="flex-none font-sans text-sm text-brand-textMuted">{event.dateLabel}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {/* Quick links */}
          <div className={`grid grid-cols-2 gap-4 sm:grid-cols-4 lg:gap-5 ${standings && next ? "lg:col-span-7" : "lg:col-span-12"}`}>
            {QUICK_LINKS.map((link, i) => (
              <SpotlightCard
                key={link.href}
                style={{ "--i": i + 2, "--spotlight-card-surface": "#141210", "--spotlight-card-border": "rgba(255,255,255,0)" } as React.CSSProperties}
                spotlightColor="#f04a22"
                intensity={0.28}
                spotlightSize={200}
                className="reveal !rounded-3xl !p-0 transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] hover:-translate-y-1"
              >
                <Link href={link.href} className="group flex h-full min-h-32 flex-col justify-between gap-6 p-5 active:scale-[0.98] md:p-6">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-orange text-brand-bg">{link.icon}</span>
                  <span className="font-sans text-[0.9375rem] font-bold text-brand-text">
                    {link.label}
                    <span className="ml-1 inline-block text-brand-textMuted transition-transform duration-200 group-hover:translate-x-1">&rarr;</span>
                  </span>
                </Link>
              </SpotlightCard>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
