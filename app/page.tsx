import Link from "next/link";
import Image from "next/image";
import FluidBackground from "../components/site/FluidBackground";
import SplitHeading from "../components/site/SplitHeading";
import Marquee from "../components/site/Marquee";
import SpotlightCard from "../components/reactbits/SpotlightCard/SpotlightCard";
import EventCard from "../components/site/EventCard";
import ExpandableRecap from "../components/site/ExpandableRecap";
import RecapBody from "../components/site/RecapBody";
import PhotoThumb from "../components/site/PhotoThumb";
import { StandingsIcon, CalendarIcon, TrophyIcon, BadgeIcon } from "../components/site/Icons";
import { getStorePreview, StorePreviewItem } from "../lib/storePreview";
import { getUpcomingEvents } from "../lib/events";
import { getSiteSettings } from "../lib/settings";
import { getLatestImportedWeek } from "../lib/dataStamp";
import { getHomeRecap, type HomeRecap } from "../lib/homeRecap";
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
  let homeRecap: HomeRecap | null = null;

  try {
    const [events, settings, products, recap] = await Promise.all([
      getUpcomingEvents(3),
      getSiteSettings(),
      getStorePreview(4),
      getHomeRecap(),
    ]);
    storeItems = products;
    homeRecap = recap;
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
    // The hero's status line follows the data: the newest imported week, not a setting to remember.
    const latest = await getLatestImportedWeek();
    if (latest) {
      seasonLabel = latest.season;
      currentWeek = String(latest.week);
    }
  } catch (error) {
    console.error("Failed to load homepage data:", error);
  }

  const nextEvent = upcomingEvents[0];
  const weekLine = currentWeek && seasonLabel ? `Week ${currentWeek} of ${seasonLabel}` : "";
  const nextEventLine = nextEvent
    ? `Next Event: ${nextEvent.title} — ${formatEventDateShort(nextEvent.event_date)}`
    : "";

  // The status pill under the hero buttons is a link to the next event (its sign-up page if it has one).
  const pillText = [weekLine, nextEventLine].filter(Boolean).join(" · ");
  const pillBase =
    "hero-step mt-12 block rounded-2xl border border-white/10 bg-brand-panel/60 px-5 py-3 font-sans text-sm font-semibold leading-relaxed text-brand-textSecondary sm:mt-16 sm:rounded-full sm:px-6";
  const pillLink =
    pillBase +
    " transition-colors duration-200 hover:border-brand-orange/60 hover:bg-brand-panel hover:text-brand-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-orange";

  // Latest recap section: links open that exact week on the League page.
  const recapWeekLabel = homeRecap ? `Week ${homeRecap.week}` : "";
  const recapQuery = homeRecap ? `season=${encodeURIComponent(homeRecap.season)}&week=${encodeURIComponent(recapWeekLabel)}` : "";
  const recapHref = `/leagues?tab=weeks&${recapQuery}`;
  const photosHref = `/leagues?tab=photos&${recapQuery}`;
  const recapPhotos = homeRecap?.photos ?? [];
  const mosaic = recapPhotos.length >= 5; // 3x3: one big photo, four small, and an "all photos" tile
  const shownPhotos = recapPhotos.slice(0, mosaic ? 5 : 4);
  const hiddenPhotoCount = recapPhotos.length - shownPhotos.length;

  return (
    <main className="bg-brand-bg">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <FluidBackground className="absolute inset-0 h-full w-full opacity-90" />
        <div className="hairline-bg absolute inset-0" />
        <div
          className="hero-glow absolute -top-32 right-[-20%] h-[360px] w-[360px] rounded-full bg-brand-orange/25 blur-[100px] md:-top-40 md:right-[-10%] md:h-[640px] md:w-[640px] md:blur-[140px]"
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

        <div className="relative mx-auto flex max-w-5xl flex-col items-center px-4 py-16 text-center sm:py-24 md:px-6 md:py-36">
          <span className="eyebrow hero-step" style={{ "--i": 0 } as React.CSSProperties}>
            Empire Cornhole League
          </span>
          <SplitHeading className="mt-5 font-display text-5xl uppercase leading-[0.92] tracking-[-0.015em] text-brand-text sm:text-6xl md:text-8xl">
            Where every <span className="text-brand-orange">bag</span> counts.
          </SplitHeading>
          <p style={{ "--i": 2 } as React.CSSProperties} className="hero-step mt-6 max-w-2xl font-sans text-base text-brand-textSecondary sm:text-lg">
            Weekly blind draws, switch nights, and the standings that decide who&apos;s really got game. This is home.
          </p>
          <div style={{ "--i": 3 } as React.CSSProperties} className="hero-step mt-8 flex w-full flex-col gap-3 sm:mt-10 sm:w-auto sm:flex-row sm:gap-4">
            <Link href="/leagues" className="btn-primary">
              View Live Standings
            </Link>
            <Link href="/events" className="btn-secondary">
              See Upcoming Events
            </Link>
          </div>

          {pillText &&
            (nextEvent ? (
              nextEvent.registerUrl ? (
                <a
                  href={nextEvent.registerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ "--i": 4 } as React.CSSProperties}
                  className={pillLink}
                >
                  {pillText} <span className="whitespace-nowrap text-brand-orange">&middot; Register &rarr;</span>
                  <span className="sr-only"> (opens the sign-up page in a new tab)</span>
                </a>
              ) : (
                <Link href="/events" style={{ "--i": 4 } as React.CSSProperties} className={pillLink}>
                  {pillText} <span className="whitespace-nowrap text-brand-orange">&middot; Event details &rarr;</span>
                </Link>
              )
            ) : (
              <div style={{ "--i": 4 } as React.CSSProperties} className={pillBase}>
                {pillText}
              </div>
            ))}
        </div>
      </section>

      <Marquee />

      {/* Latest recap: the newest published recap with that week's photos */}
      {homeRecap && (homeRecap.body || shownPhotos.length > 0) && (
        <section className="bg-brand-bg">
          <div className="mx-auto max-w-7xl px-4 py-16 md:px-6 md:py-24">
            <div className="reveal flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
              <div>
                <span className="eyebrow">{homeRecap.season} &middot; Latest</span>
                <h2 className="heading-section mt-4">Week {homeRecap.week} recap</h2>
              </div>
              <Link href={recapHref} className="btn-secondary">
                Full results
              </Link>
            </div>

            <div className={`mt-12 grid grid-cols-1 gap-6 lg:gap-8 ${homeRecap.body && shownPhotos.length > 0 ? "lg:grid-cols-12" : ""}`}>
              {homeRecap.body && (
                <div
                  className={`reveal rounded-2xl border border-white/10 bg-brand-panel p-6 md:p-8 ${
                    shownPhotos.length > 0 ? "lg:col-span-7" : "mx-auto w-full max-w-3xl"
                  }`}
                >
                  <ExpandableRecap>
                    <RecapBody text={homeRecap.body} />
                  </ExpandableRecap>
                </div>
              )}

              {shownPhotos.length > 0 && (
                <div className={`reveal ${homeRecap.body ? "lg:sticky lg:top-24 lg:col-span-5 lg:self-start" : ""}`} style={{ "--i": 1 } as React.CSSProperties}>
                  <div className={`grid gap-2 sm:gap-3 ${mosaic ? "grid-cols-3" : "grid-cols-2"}`}>
                    {shownPhotos.map((photo, i) => {
                      const big = mosaic ? i === 0 : shownPhotos.length % 2 === 1 && i === 0;
                      const size = mosaic
                        ? big
                          ? "col-span-2 row-span-2 aspect-square"
                          : "aspect-square"
                        : big
                        ? "col-span-2 aspect-[4/3]"
                        : "aspect-square";
                      return (
                        <Link
                          key={photo.id}
                          href={photosHref}
                          aria-label={`View Week ${homeRecap.week} photo ${i + 1}`}
                          className={`relative block overflow-hidden rounded-2xl border border-white/10 bg-brand-panel ${size}`}
                        >
                          <PhotoThumb
                            src={photo.url}
                            alt={photo.caption || `Week ${homeRecap.week} photo ${i + 1}`}
                            width={big ? 640 : 384}
                            className="object-[50%_25%]"
                          />
                        </Link>
                      );
                    })}
                    {mosaic && (
                      <Link
                        href={photosHref}
                        className="flex aspect-square flex-col items-center justify-center rounded-2xl border border-white/10 bg-brand-panel text-center font-sans text-sm font-bold text-brand-orange transition-colors duration-200 hover:border-brand-orange/60"
                      >
                        <span className="font-display text-3xl leading-none">{hiddenPhotoCount > 0 ? `+${hiddenPhotoCount}` : "All"}</span>
                        <span className="mt-1">{hiddenPhotoCount > 0 ? "more photos" : "photos"} &rarr;</span>
                      </Link>
                    )}
                  </div>
                  {!mosaic && (
                    <Link href={photosHref} className="mt-4 inline-block font-sans text-sm font-bold text-brand-orange underline-offset-4 hover:underline">
                      See all photos &rarr;
                    </Link>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Feature grid */}
      <section className="bg-brand-panel">
        <div className="mx-auto max-w-7xl px-4 py-16 md:px-6 md:py-24">
          <div className="reveal mx-auto max-w-2xl text-center">
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
            {FEATURES.map((feature, i) => (
              <SpotlightCard
                key={feature.title}
                style={{ "--i": i, "--spotlight-card-surface": "#0d0c0b", "--spotlight-card-border": "rgba(255,255,255,0.1)" } as React.CSSProperties}
                spotlightColor="#f04a22"
                intensity={0.28}
                spotlightSize={260}
                className="reveal !rounded-2xl !p-0 transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] hover:-translate-y-1"
              >
                <Link href={feature.href} className="group flex h-full flex-col p-6 active:scale-[0.98]">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-brand-orange to-brand-orangeHover text-brand-bg">
                    {feature.icon}
                  </div>
                  <h3 className="heading-card mt-5">{feature.title}</h3>
                  <p className="mt-2 font-sans text-sm text-brand-textSecondary">{feature.desc}</p>
                  <span className="mt-4 font-sans text-sm font-bold text-brand-orange transition-transform duration-200 group-hover:translate-x-1">
                    View &rarr;
                  </span>
                </Link>
              </SpotlightCard>
            ))}
          </div>
        </div>
      </section>

      {/* Upcoming events preview */}
      <section className="bg-brand-bg">
        <div className="mx-auto max-w-7xl px-4 py-16 md:px-6 md:py-24">
          <div className="reveal flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
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
              {upcomingEvents.map((event, i) => (
                <EventCard key={event.id} event={event} surface="bg" index={i} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Store teaser */}
      <section className="bg-brand-panel">
        <div className="mx-auto max-w-7xl px-4 py-16 md:px-6 md:py-24">
          <div className="reveal grid grid-cols-1 items-center gap-10 md:grid-cols-2">
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
        </div>
      </section>
    </main>
  );
}

