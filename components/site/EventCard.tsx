export type EventCardData = {
  id: string;
  day: string;
  month: string;
  title: string;
  meta: string;
  tag?: string;
  featured?: boolean;
  registerUrl?: string;
};

/**
 * Shared event card for the homepage preview and the Events page.
 * `surface` is the section background it sits on; the card takes the other
 * brand surface so it always reads as raised.
 */
export default function EventCard({
  event,
  surface,
  layout = "stack",
  showRegister = true,
}: {
  event: EventCardData;
  surface: "bg" | "panel";
  layout?: "stack" | "row";
  showRegister?: boolean;
}) {
  const cardBg = surface === "panel" ? "bg-brand-bg" : "bg-brand-panel";
  const dateBg = surface === "panel" ? "bg-brand-panel" : "bg-brand-bg";
  const tone = event.featured ? "border-brand-orange/40 bg-brand-orange/10" : `border-white/10 ${cardBg}`;
  const register = showRegister && event.registerUrl;

  return (
    <div
      className={`flex h-full flex-col gap-5 rounded-2xl border p-5 sm:p-6 ${tone} ${
        layout === "row" ? "sm:flex-row sm:items-center sm:justify-between" : ""
      }`}
    >
      <div className="flex items-start gap-4">
        <div className={`flex h-16 w-16 flex-none flex-col items-center justify-center rounded-xl ${dateBg}`}>
          <span className="font-display text-2xl leading-none text-brand-orange">{event.day}</span>
          <span className="mt-1 font-sans text-xs font-bold uppercase tracking-[0.08em] text-brand-textMuted">
            {event.month}
          </span>
        </div>
        <div className="min-w-0">
          <h3 className="font-display text-xl uppercase leading-tight text-brand-text">{event.title}</h3>
          {event.meta && <p className="mt-1.5 font-sans text-sm text-brand-textSecondary">{event.meta}</p>}
          {event.tag && (
            <span
              className={`mt-3 inline-block rounded-full px-2.5 py-1 font-sans text-xs font-semibold ${
                event.featured ? "bg-brand-orange text-brand-bg" : "bg-white/10 text-brand-textSecondary"
              }`}
            >
              {event.tag}
            </span>
          )}
        </div>
      </div>

      {register && (
        <a
          href={event.registerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`btn-nav-cta flex-none ${layout === "row" ? "sm:self-center" : "mt-auto self-start"}`}
        >
          Register
        </a>
      )}
    </div>
  );
}
