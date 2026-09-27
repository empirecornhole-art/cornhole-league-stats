import FadeIn from "../../components/site/FadeIn";

// TODO: replace with real event data
const EVENTS = [
  {
    day: "05",
    month: "OCT",
    title: "Blind Draw Night — Week 12",
    tag: "Weekly",
    meta: "6:30 PM · Pittsfield Firehouse",
  },
  {
    day: "12",
    month: "OCT",
    title: "Blind Draw Night — Week 13",
    tag: "Weekly",
    meta: "6:30 PM · Pittsfield Firehouse",
  },
  {
    day: "19",
    month: "OCT",
    title: "Swap Night — Week 14",
    tag: "Weekly",
    meta: "6:30 PM · Pittsfield Firehouse",
  },
  {
    day: "26",
    month: "OCT",
    title: "Swap Night — Week 15",
    tag: "Weekly",
    meta: "6:30 PM · Pittsfield Firehouse",
  },
  {
    day: "02",
    month: "NOV",
    title: "End of Summer Championship",
    tag: "Featured",
    meta: "12:00 PM · Empire Fairgrounds",
    featured: true,
  },
  {
    day: "09",
    month: "NOV",
    title: "Fall Kickoff — Week 1",
    tag: "Weekly",
    meta: "6:30 PM · Pittsfield Firehouse",
  },
];

export default function EventsPage() {
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

          <div className="mt-8 inline-flex rounded-full border border-white/10 bg-brand-panel p-1">
            <span className="rounded-full bg-brand-orange px-5 py-2 font-sans text-xs font-bold uppercase tracking-wide text-brand-bg">
              Upcoming
            </span>
            <span className="rounded-full px-5 py-2 font-sans text-xs font-bold uppercase tracking-wide text-brand-textMuted">
              Past Results
            </span>
          </div>
        </FadeIn>
      </section>

      <section className="bg-brand-panel">
        <FadeIn className="mx-auto max-w-4xl px-4 py-16 md:px-6">
          <div className="flex flex-col gap-4">
            {EVENTS.map((event) => (
              <div
                key={event.title}
                className={`flex flex-col gap-4 rounded-2xl border p-6 sm:flex-row sm:items-center sm:justify-between ${
                  event.featured
                    ? "border-brand-orange/40 bg-brand-orange/10"
                    : "border-white/10 bg-brand-bg"
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-16 w-16 flex-none flex-col items-center justify-center rounded-xl bg-brand-panel">
                    <span className="font-display text-2xl leading-none text-brand-orange">{event.day}</span>
                    <span className="mt-1 font-sans text-[10px] font-bold uppercase tracking-widest text-brand-textMuted">
                      {event.month}
                    </span>
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display text-lg uppercase leading-tight text-brand-text">
                        {event.title}
                      </h3>
                      <span
                        className={`rounded-full px-2.5 py-0.5 font-sans text-[10px] font-bold uppercase tracking-widest ${
                          event.featured
                            ? "bg-brand-orange text-brand-bg"
                            : "bg-white/10 text-brand-textMuted"
                        }`}
                      >
                        {event.tag}
                      </span>
                    </div>
                    <p className="mt-2 font-sans text-sm text-brand-textSecondary">{event.meta}</p>
                  </div>
                </div>
                <button type="button" className="btn-secondary self-start sm:self-auto">
                  Details
                </button>
              </div>
            ))}
          </div>
        </FadeIn>
      </section>
    </main>
  );
}
