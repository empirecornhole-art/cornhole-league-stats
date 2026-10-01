import Link from "next/link";
import Image from "next/image";
import FadeIn from "../components/site/FadeIn";
import EventCard from "../components/site/EventCard";
import { StandingsIcon, CalendarIcon, TrophyIcon, BadgeIcon } from "../components/site/Icons";
import { getStorePreview, StorePreviewItem } from "../lib/storePreview";
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
    icon: <CalendarIcon />,
  },
  {
    href: "/leagues?tab=alltime",
    title: "All-Time Leaders",
    desc: "Career stats and records for every player who's ever picked up a bag.",
    icon: <TrophyIcon />,
  },
  {
    href: "/leagues?tab=badges",
    title: "Badges",
    desc: "Track the achievements and milestones players earn week to week.",
    icon: <BadgeIcon />,
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
  let storeItems: StorePreviewItem[] = [];
  let seasonLabel = "";
  let currentWeek = "";

  try {
    const [events, settings, products] = await Promise.all([
      getUpcomingEvents(3),
      getSiteSettings(),
      getStorePreview(4),
    ]);
    storeItems = products;
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
          className="absolute -top-32 right-[-20%] h-[360px] w-[360px] rounded-full bg-brand-orange/25 blur-[100px] md:-top-40 md:right-[-10%] md:h-[640px] md:w-[640px] md:blur-[140px]"
          aria-hidden
        />

        {/* Watermark layer 1: ambient far layer */}
        <div
          className="pointer-events-none absolute -right-40 -top-24 hidden h-[520px] w-[900px] opacity-5 blur-sm md:block"
          style={{ transform: "rotate(16deg)" }}
          aria-hidden
        >
          <Image src="/ec-logo-full.png" alt="" fill className="object-contain" />
        </div>

        {/* Watermark layer 3: primary mark, edge-masked */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 mx-auto h-[360px] w-full max-w-4xl opacity-[0.12] md:h-[520px]"
          style={{
            transform: "rotate(-9deg)",
            maskImage: "radial-gradient(ellipse at center, black 40%, transparent 75%)",
            WebkitMaskImage: "radial-gradient(ellipse at center, black 40%, transparent 75%)",
          }}
          aria-hidden
        >
          <Image src="/ec-logo-full.png" alt="" fill className="object-contain" />
        </div>

        <FadeIn className="relative mx-auto flex max-w-5xl flex-col items-center px-4 py-16 text-center sm:py-24 md:px-6 md:py-36">
          <span className="eyebrow">
            Empire Cornhole League
          </span>
          <h1 className="mt-5 font-display text-5xl uppercase leading-[0.95] text-brand-text sm:text-6xl md:text-8xl">
            Where every <span className="text-brand-orange">bag</span> counts.
          </h1>
          <p className="mt-6 max-w-2xl font-sans text-base text-brand-textSecondary sm:text-lg">
            Weekly blind draws, swap nights, and the standings that decide who&apos;s really got game. This is home.
          </p>
          <div className="mt-8 flex w-full flex-col gap-3 sm:mt-10 sm:w-auto sm:flex-row sm:gap-4">
            <Link href="/leagues" className="btn-primary">
              View Live Standings
            </Link>
            <Link href="/events" className="btn-secondary">
              See Upcoming Events
            </Link>
          </div>

          {(weekLine || nextEventLine) && (
            <div className="mt-12 rounded-2xl border border-white/10 bg-brand-panel/60 px-5 py-3 font-sans text-xs font-bold uppercase leading-relaxed tracking-wide text-brand-textMuted sm:mt-16 sm:rounded-full sm:px-6 sm:tracking-widest">
              {[weekLine, nextEventLine].filter(Boolean).join(" · ")}
            </div>
          )}
        </FadeIn>
      </section>

      {/* Feature grid */}
      <section className="bg-brand-panel">
        <FadeIn className="mx-auto max-w-7xl px-4 py-16 md:px-6 md:py-24">
          <div className="mx-auto max-w-2xl text-center">
            <span className="eyebrow">
              What&apos;s Inside
            </span>
            <h2 className="heading-section mt-4">
              Everything you need to compete.
            </h2>
            <p className="mt-4 font-sans text-brand-textSecondary">
              One live app for standings, results, records, and bragging rights.
            </p>
          </div>

          <div className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
            {FEATURES.map((feature) => (
              <Link
                key={feature.title}
                href={feature.href}
                className="group flex flex-col rounded-2xl border border-white/10 bg-brand-bg p-6 transition duration-200 hover:-translate-y-1 hover:border-white/20"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-brand-orange to-brand-orangeHover text-brand-bg">
                  {feature.icon}
                </div>
                <h3 className="heading-card mt-5">{feature.title}</h3>
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
        <FadeIn className="mx-auto max-w-7xl px-4 py-16 md:px-6 md:py-24">
          <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
            <div>
              <span className="eyebrow">
                Don&apos;t Miss Out
              </span>
              <h2 className="heading-section mt-4">Upcoming Events</h2>
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
                <EventCard key={event.id} event={event} surface="bg" />
              ))}
            </div>
          )}
        </FadeIn>
      </section>

      {/* Store teaser */}
      <section className="bg-brand-panel">
        <FadeIn className="mx-auto max-w-7xl px-4 py-16 md:px-6 md:py-24">
          <div className="grid grid-cols-1 items-center gap-10 md:grid-cols-2">
            <div>
              <span className="eyebrow">
                Repping The League
              </span>
              <h2 className="heading-section mt-4">
                Gear up for game night.
              </h2>
              <p className="mt-4 max-w-md font-sans text-brand-textSecondary">
                League tees, hoodies, and bags &mdash; show up looking like you belong on the board.
              </p>
              <Link href="/leagues?tab=store" className="btn-primary mt-8 inline-flex">
                Shop the Store
              </Link>
            </div>

            {storeItems.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                {storeItems.map((item) => (
                  <Link
                    key={item.id}
                    href="/leagues?tab=store"
                    className="group overflow-hidden rounded-2xl border border-white/10 bg-brand-bg"
                  >
                    <div className="aspect-square overflow-hidden bg-white/5">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.imageUrl}
                        alt={item.imageAlt}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.03]"
                      />
                    </div>
                    <div className="p-3 sm:p-4">
                      <div className="truncate font-sans text-sm font-bold text-brand-text">{item.title}</div>
                      <div className="mt-0.5 font-sans text-sm text-brand-orange">{item.price}</div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="relative hidden aspect-[4/3] overflow-hidden rounded-2xl border border-white/10 bg-brand-bg md:block">
                <div
                  className="pointer-events-none absolute inset-0 opacity-[0.14]"
                  style={{
                    transform: "rotate(-9deg) scale(1.2)",
                    maskImage: "radial-gradient(ellipse at center, black 40%, transparent 75%)",
                    WebkitMaskImage: "radial-gradient(ellipse at center, black 40%, transparent 75%)",
                  }}
                  aria-hidden
                >
                  <Image src="/ec-logo-full.png" alt="" fill className="object-contain" />
                </div>
              </div>
            )}
          </div>
        </FadeIn>
      </section>
    </main>
  );
}

