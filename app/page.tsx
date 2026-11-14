import Link from "next/link";
import Image from "next/image";
import FluidBackground from "../components/site/FluidBackground";
import SplitHeading from "../components/site/SplitHeading";
import Marquee from "../components/site/Marquee";
import HomeBento, { type BentoEvent } from "../components/site/HomeBento";
import ExpandableRecap from "../components/site/ExpandableRecap";
import RecapBody from "../components/site/RecapBody";
import PhotoThumb from "../components/site/PhotoThumb";
import { getStorePreview, StorePreviewItem } from "../lib/storePreview";
import { getUpcomingEvents } from "../lib/events";
import { getSiteSettings } from "../lib/settings";
import { getLatestImportedWeek } from "../lib/dataStamp";
import { getHomeRecap, type HomeRecap } from "../lib/homeRecap";
import { getHomeStandings, type HomeStandings } from "../lib/homeStandings";
import { formatEventDateParts, formatEventDateShort } from "../lib/format";

export const dynamic = "force-dynamic";

export default async function Home() {
  let upcomingEvents: BentoEvent[] = [];
  let standings: HomeStandings | null = null;
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
        tag: event.tag || "",
        event_date: event.event_date,
        dateLabel: formatEventDateShort(event.event_date),
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
    standings = await getHomeStandings(seasonLabel, 7);
  } catch (error) {
    console.error("Failed to load homepage data:", error);
  }

  const weekLine = currentWeek && seasonLabel ? `Week ${currentWeek} of ${seasonLabel}` : "";

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

        <div className="relative mx-auto flex max-w-5xl flex-col items-center px-4 py-16 text-center sm:py-24 md:px-6 md:py-32">
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
        </div>
      </section>

      <HomeBento standings={standings} events={upcomingEvents} weekLine={weekLine} />

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
                  className={`reveal rounded-3xl bg-brand-panel p-6 md:p-8 ${
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
                          className={`relative block overflow-hidden rounded-2xl bg-brand-panel ${size}`}
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
                        className="flex aspect-square flex-col items-center justify-center rounded-2xl bg-brand-panel text-center font-sans text-sm font-bold text-brand-orange transition-colors duration-200 hover:bg-brand-raised"
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
                    className="group overflow-hidden rounded-2xl bg-brand-bg"
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

