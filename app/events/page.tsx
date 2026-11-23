import type { Metadata } from "next";
import HeroThreads from "../../components/site/HeroThreads";
import JsonLd from "../../components/site/JsonLd";
import { SITE_NAME, SITE_URL, eventStartDate } from "../../lib/site";
import FadeIn from "../../components/site/FadeIn";
import EventsView, { EventDisplay } from "../../components/site/EventsView";
import { getPastEvents, getUpcomingEvents, EventRow } from "../../lib/events";
import { daysUntilDate, formatEventDateParts, formatMonthYear, formatWeekday } from "../../lib/format";

export const metadata: Metadata = {
  title: "Cornhole Events & Schedule in New Berlin, NY",
  description:
    "Upcoming blind draw and switch nights, registration links and past results for Empire Cornhole League in New Berlin, NY.",
  alternates: { canonical: "/events" },
};

export const dynamic = "force-dynamic";

function toDisplay(event: EventRow): EventDisplay {
  const { day, month } = formatEventDateParts(event.event_date);

  return {
    id: event.id,
    date: event.event_date,
    day,
    month,
    weekday: formatWeekday(event.event_date),
    monthLabel: formatMonthYear(event.event_date),
    title: event.title,
    tag: event.tag,
    meta: [event.time, event.location].filter(Boolean).join(" · "),
    featured: event.featured,
    registerUrl: event.register_url || "",
    daysUntil: daysUntilDate(event.event_date),
  };
}

export default async function EventsPage() {
  let upcoming: EventDisplay[] = [];
  let past: EventDisplay[] = [];
  let upcomingRaw: EventRow[] = [];

  try {
    const [upcomingRows, pastRows] = await Promise.all([getUpcomingEvents(), getPastEvents()]);
    upcomingRaw = upcomingRows;
    upcoming = upcomingRows.map(toDisplay);
    past = pastRows.map(toDisplay);
  } catch (error) {
    console.error("Failed to load events:", error);
  }

  // One SportsEvent per upcoming night so Google can show them as event results.
  const eventsJsonLd = upcomingRaw.slice(0, 10).map((event) => ({
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    name: event.title,
    startDate: eventStartDate(event.event_date, event.time),
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    sport: "Cornhole",
    url: `${SITE_URL}/events`,
    location: event.location
      ? { "@type": "Place", name: event.location.split(",")[0].trim(), address: event.location }
      : undefined,
    organizer: { "@type": "SportsOrganization", name: SITE_NAME, url: SITE_URL },
    offers: event.register_url ? { "@type": "Offer", url: event.register_url, availability: "https://schema.org/InStock" } : undefined,
  }));

  return (
    <main className="bg-brand-bg">
      {eventsJsonLd.length > 0 && <JsonLd data={eventsJsonLd} />}
      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute -top-32 left-1/2 h-[300px] w-[360px] -translate-x-1/2 rounded-full bg-brand-orange/20 blur-[90px] md:h-[420px] md:w-[720px] md:blur-[120px]"
          aria-hidden
        />
        <HeroThreads />
        <FadeIn className="relative mx-auto max-w-4xl px-4 py-14 text-center md:px-6 md:py-24">
          <span className="eyebrow">Schedule</span>
          <h1 className="heading-page mt-4">Events</h1>
          <p className="mx-auto mt-5 max-w-xl font-sans text-lg text-brand-textSecondary">
            Blind draws, switch nights, and the events that decide who takes home the season.
          </p>
        </FadeIn>
      </section>

      <section className="bg-brand-bg">
        <FadeIn className="mx-auto max-w-4xl px-4 pb-20 pt-4 md:px-6 md:pb-28">
          <EventsView upcoming={upcoming} past={past} />
        </FadeIn>
      </section>
    </main>
  );
}
