import FadeIn from "../../components/site/FadeIn";
import EventsListToggle, { EventDisplay } from "../../components/site/EventsListToggle";
import { getPastEvents, getUpcomingEvents, EventRow } from "../../lib/events";
import { formatEventDateParts } from "../../lib/format";

export const dynamic = "force-dynamic";

function toDisplay(event: EventRow): EventDisplay {
  const { day, month } = formatEventDateParts(event.event_date);
  const meta = [event.time, event.location].filter(Boolean).join(" · ");

  return {
    id: event.id,
    day,
    month,
    title: event.title,
    tag: event.tag,
    meta,
    featured: event.featured,
  };
}

export default async function EventsPage() {
  let upcoming: EventDisplay[] = [];
  let past: EventDisplay[] = [];

  try {
    const [upcomingRows, pastRows] = await Promise.all([getUpcomingEvents(), getPastEvents()]);
    upcoming = upcomingRows.map(toDisplay);
    past = pastRows.map(toDisplay);
  } catch (error) {
    console.error("Failed to load events:", error);
  }

  return (
    <main className="bg-brand-bg">
      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute -top-32 left-1/2 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-brand-orange/20 blur-[120px]"
          aria-hidden
        />
        <FadeIn className="relative mx-auto max-w-4xl px-4 py-20 text-center md:py-28">
          <span className="font-sans text-xs font-bold uppercase tracking-widest text-brand-textMuted">
            Schedule
          </span>
          <h1 className="mt-4 font-display text-5xl uppercase text-brand-text md:text-7xl">Upcoming Events</h1>
          <p className="mt-5 font-sans text-brand-textSecondary">
            Blind draws, swap nights, and the events that decide who takes home the season.
          </p>
        </FadeIn>
      </section>

      <section className="bg-brand-panel">
        <FadeIn className="mx-auto max-w-4xl px-4 py-16 md:px-6">
          <EventsListToggle upcoming={upcoming} past={past} />
        </FadeIn>
      </section>
    </main>
  );
}
