"use client";

import { useState } from "react";

export type EventDisplay = {
  id: string;
  day: string;
  month: string;
  title: string;
  tag: string;
  meta: string;
  featured: boolean;
};

export default function EventsListToggle({
  upcoming,
  past,
}: {
  upcoming: EventDisplay[];
  past: EventDisplay[];
}) {
  const [view, setView] = useState<"upcoming" | "past">("upcoming");
  const events = view === "upcoming" ? upcoming : past;

  return (
    <div>
      <div className="mx-auto flex w-fit rounded-full border border-white/10 bg-brand-panel p-1">
        <button
          type="button"
          onClick={() => setView("upcoming")}
          className={`rounded-full px-5 py-2 font-sans text-xs font-bold uppercase tracking-wide transition duration-200 ${
            view === "upcoming" ? "bg-brand-orange text-brand-bg" : "text-brand-textMuted"
          }`}
        >
          Upcoming
        </button>
        <button
          type="button"
          onClick={() => setView("past")}
          className={`rounded-full px-5 py-2 font-sans text-xs font-bold uppercase tracking-wide transition duration-200 ${
            view === "past" ? "bg-brand-orange text-brand-bg" : "text-brand-textMuted"
          }`}
        >
          Past Results
        </button>
      </div>

      <div className="mt-10 flex flex-col gap-4">
        {events.length === 0 && (
          <p className="rounded-2xl border border-white/10 bg-brand-bg p-6 text-center font-sans text-sm text-brand-textSecondary">
            {view === "upcoming"
              ? "No events scheduled yet — check back soon."
              : "No past events to show."}
          </p>
        )}

        {events.map((event) => (
          <div
            key={event.id}
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
                {event.meta && (
                  <p className="mt-2 font-sans text-sm text-brand-textSecondary">{event.meta}</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
