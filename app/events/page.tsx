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
    registerUrl: event.register_url || "",
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
          className="pointer-events-none absolute -top-32 left-1/2 h-[300px] w-[360px] -translate-x-1/2 rounded-full bg-brand-orange/20 blur-[90px] md:h-[420px] md:w-[720px] md:blur-[120px]"
          aria-hidden
        />
        <FadeIn className="relative mx-auto max-w-4xl px-4 py-16 text-center md:px-6 md:py-28">
          <span className="eyebrow">
            Schedule
          </span>
          <h1 className="heading-page mt-4">Events</h1>
          <p className="mt-5 font-sans text-brand-textSecondary">
            Blind draws, switch nights, and the events that decide who takes home the season.
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
