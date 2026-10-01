import Link from "next/link";
import Image from "next/image";
import FadeIn from "../components/site/FadeIn";
import { getUpcomingEvents } from "../lib/events";
import { getSiteSettings } from "../lib/settings";
import { formatEventDateParts, formatEventDateShort } from "../lib/format";

export const dynamic = "force-dynamic";

const FEATURES = [
  {
    href: "/leagues?tab=standings",
    title: "Standings",
    desc: "See where every team sits in the current season, updated after every week of play.",
    icon: <StandingsIcon />,
  },
  {
    href: "/leagues?tab=weeks",
    title: "Weekly Results",
    desc: "Dig into scores, matchups, and results from any week of the season.",
    icon: <WeeklyIcon />,
  },
  {
    href: "/leagues?tab=alltime",
    title: "All-Time Leaders",
    desc: "Career stats and records for every player who's ever picked up a bag.",
    icon: <AllTimeIcon />,
  },
  {
    href: "/leagues?tab=badges",
    title: "Badges",
    desc: "Track the achievements and milestones players earn week to week.",
    icon: <BadgesIcon />,
  },
];

export default async function Home() {
  let upcomingEvents: {
    id: string;
    day: string;
    month: string;
    title: string;
    meta: string;
    event_date: string;
    registerUrl: string;
  }[] = [];
  let seasonLabel = "";
  let currentWeek = "";

  try {
    const [events, settings] = await Promise.all([getUpcomingEvents(3), getSiteSettings()]);
    upcomingEvents = events.map((event) => {
      const { day, month } = formatEventDateParts(event.event_date);
      return {
        id: event.id,
        day,
        month,
        title: event.title,
        meta: [event.time, event.location].filter(Boolean).join(" · "),
        event_date: event.event_date,
        registerUrl: event.register_url || "",
      };
    });
    seasonLabel = settings.season_label;
    currentWeek = settings.current_week;
  } catch (error) {
    console.error("Failed to load homepage data:", error);
  }

  const nextEvent = upcomingEvents[0];
  const weekLine = currentWeek && seasonLabel ? `Week ${currentWeek} of ${seasonLabel}` : "";
  const nextEventLine = nextEvent
    ? `Next Event: ${nextEvent.title} — ${formatEventDateShort(nextEvent.event_date)}`
    : "";

  return (
    <main className="bg-brand-bg">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="hairline-bg absolute inset-0" />
        <div
          className="absolute -top-40 right-[-10%] h-[640px] w-[640px] rounded-full bg-brand-orange/25 blur-[140px]"
          aria-hidden
        />

        {/* Watermark layer 1: ambient far layer */}
        <div
          className="pointer-events-none absolute -right-40 -top-24 h-[520px] w-[900px] opacity-5 blur-sm"
          style={{ transform: "rotate(16deg)" }}
          aria-hidden
        >
          <Image src="/ec-logo-full.png" alt="" fill className="object-contain" />
        </div>

        {/* Watermark layer 3: primary mark, edge-masked */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 mx-auto h-[520px] w-full max-w-4xl opacity-[0.12]"
          style={{
            transform: "rotate(-9deg)",
            maskImage: "radial-gradient(ellipse at center, black 40%, transparent 75%)",
            WebkitMaskImage: "radial-gradient(ellipse at center, black 40%, transparent 75%)",
          }}
          aria-hidden
        >
          <Image src="/ec-logo-full.png" alt="" fill className="object-contain" />
        </div>

        <FadeIn className="relative mx-auto flex max-w-5xl flex-col items-center px-4 py-28 text-center md:py-36">
          <span className="font-sans text-xs font-bold uppercase tracking-widest text-brand-textMuted">
            Empire Cornhole League
          </span>
          <h1 className="mt-5 font-display text-6xl uppercase leading-[0.95] text-brand-text md:text-8xl">
            Where every <span className="text-brand-orange">bag</span> counts.
          </h1>
          <p className="mt-6 max-w-2xl font-sans text-lg text-brand-textSecondary">
            Weekly blind draws, swap nights, and the standings that decide who&apos;s really got game. This is home.
          </p>
          <div className="mt-10 flex flex-col gap-4 sm:flex-row">
            <Link href="/leagues" className="btn-primary">
              View Live Standings
            </Link>
            <Link href="/events" className="btn-secondary">
              See Upcoming Events
            </Link>
          </div>

          {(weekLine || nextEventLine) && (
            <div className="mt-16 rounded-full border border-white/10 bg-brand-panel/60 px-6 py-3 font-sans text-xs font-bold uppercase tracking-widest text-brand-textMuted">
              {[weekLine, nextEventLine].filter(Boolean).join(" · ")}
            </div>
          )}
        </FadeIn>
      </section>

      {/* Feature grid */}
      <section className="bg-brand-panel">
        <FadeIn className="mx-auto max-w-7xl px-4 py-24 md:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <span className="font-sans text-xs font-bold uppercase tracking-widest text-brand-textMuted">
              What&apos;s Inside
            </span>
            <h2 className="mt-4 font-display text-4xl uppercase text-brand-text md:text-5xl">
              Everything you need to compete.
            </h2>
            <p className="mt-4 font-sans text-brand-textSecondary">
              One live app for standings, results, records, and bragging rights.
            </p>
          </div>

          <div className="mt-14 grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
            {FEATURES.map((feature) => (
              <Link
                key={feature.title}
                href={feature.href}
                className="group flex flex-col rounded-2xl border border-white/10 bg-brand-bg p-6 transition duration-200 hover:-translate-y-1 hover:border-white/20"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-brand-orange to-brand-orangeHover">
                  {feature.icon}
                </div>
                <h3 className="mt-5 font-display text-xl uppercase text-brand-text">{feature.title}</h3>
                <p className="mt-2 font-sans text-sm text-brand-textSecondary">{feature.desc}</p>
                <span className="mt-4 font-sans text-xs font-bold uppercase tracking-wide text-brand-orange transition duration-200 group-hover:translate-x-1">
                  View &rarr;
                </span>
              </Link>
            ))}
          </div>
        </FadeIn>
      </section>

      {/* Upcoming events preview */}
      <section className="bg-brand-bg">
        <FadeIn className="mx-auto max-w-7xl px-4 py-24 md:px-6">
          <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
            <div>
              <span className="font-sans text-xs font-bold uppercase tracking-widest text-brand-textMuted">
                Don&apos;t Miss Out
              </span>
              <h2 className="mt-4 font-display text-4xl uppercase text-brand-text md:text-5xl">Upcoming Events</h2>
            </div>
            <Link href="/events" className="btn-secondary">
              View Full Schedule
            </Link>
          </div>

          {upcomingEvents.length === 0 ? (
            <p className="mt-12 rounded-2xl border border-white/10 bg-brand-panel p-6 font-sans text-sm text-brand-textSecondary">
              No events scheduled yet — check back soon.
            </p>
          ) : (
            <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6">
              {upcomingEvents.map((event) => (
                <div
                  key={event.id}
                  className="flex gap-4 rounded-2xl border border-white/10 bg-brand-panel p-6"
                >
                  <div className="flex h-16 w-16 flex-none flex-col items-center justify-center rounded-xl bg-brand-bg">
                    <span className="font-display text-2xl leading-none text-brand-orange">{event.day}</span>
                    <span className="mt-1 font-sans text-[10px] font-bold uppercase tracking-widest text-brand-textMuted">
                      {event.month}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-display text-lg uppercase leading-tight text-brand-text">{event.title}</h3>
                    {event.meta && (
                      <p className="mt-2 font-sans text-sm text-brand-textSecondary">{event.meta}</p>
                    )}
                    {event.registerUrl && (
                      <a
                        href={event.registerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 inline-block font-sans text-xs font-bold uppercase tracking-wide text-brand-orange hover:text-brand-orangeHover"
                      >
                        Register &rarr;
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </FadeIn>
      </section>

      {/* Store teaser */}
      <section className="bg-brand-panel">
        <FadeIn className="mx-auto max-w-7xl px-4 py-24 md:px-6">
          <div className="grid grid-cols-1 items-center gap-10 md:grid-cols-2">
            <div>
              <span className="font-sans text-xs font-bold uppercase tracking-widest text-brand-textMuted">
                Repping The League
              </span>
              <h2 className="mt-4 font-display text-4xl uppercase text-brand-text md:text-5xl">
                Gear up for game night.
              </h2>
              <p className="mt-4 max-w-md font-sans text-brand-textSecondary">
                League tees, hoodies, and bags &mdash; show up looking like you belong on the board.
              </p>
              <Link href="/leagues?tab=store" className="btn-primary mt-8 inline-flex">
                Shop the Store
              </Link>
            </div>

            <div className="relative aspect-square overflow-hidden rounded-3xl border border-white/10 bg-brand-bg">
              <div
                className="pointer-events-none absolute inset-0 opacity-[0.1]"
                style={{
                  transform: "rotate(-9deg) scale(1.3)",
                  maskImage: "radial-gradient(ellipse at center, black 40%, transparent 75%)",
                  WebkitMaskImage: "radial-gradient(ellipse at center, black 40%, transparent 75%)",
                }}
                aria-hidden
              >
                <Image src="/ec-logo-full.png" alt="" fill className="object-contain" />
              </div>
              <div className="absolute inset-0 flex items-center justify-center font-display text-2xl uppercase tracking-wide text-brand-textMuted">
                Store Preview
              </div>
            </div>
          </div>
        </FadeIn>
      </section>
    </main>
  );
}

function StandingsIcon() {
  return (
    <div className="flex items-end gap-1">
      <div className="h-4 w-1.5 rounded-sm bg-brand-bg" />
      <div className="h-6 w-1.5 rounded-sm bg-brand-bg" />
      <div className="h-3 w-1.5 rounded-sm bg-brand-bg" />
    </div>
  );
}

function WeeklyIcon() {
  return <div className="h-5 w-5 bg-brand-bg" style={{ clipPath: "polygon(50% 0%, 0% 100%, 100% 100%)" }} />;
}

function AllTimeIcon() {
  return (
    <div className="relative flex h-6 w-6 items-center justify-center rounded-full border-2 border-brand-bg">
      <div className="h-1.5 w-1.5 rounded-full bg-brand-bg" />
    </div>
  );
}

function BadgesIcon() {
  return (
    <div
      className="h-6 w-6 bg-brand-bg"
      style={{
        clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
      }}
    />
  );
}
