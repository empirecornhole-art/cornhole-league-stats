"use client";

import { useState } from "react";
import EventCard from "./EventCard";

export type EventDisplay = {
  id: string;
  day: string;
  month: string;
  title: string;
  tag: string;
  meta: string;
  featured: boolean;
  registerUrl: string;
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
      <div className="relative mx-auto grid w-fit grid-cols-2 rounded-full border border-white/10 bg-brand-panel p-1">
        <span
          aria-hidden
          className={`absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-full bg-brand-orange transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:duration-1 ${
            view === "past" ? "translate-x-full" : ""
          }`}
        />
        <button
          type="button"
          onClick={() => setView("upcoming")}
          className={`relative rounded-full px-5 py-2 font-sans text-sm font-semibold transition-[transform,color] duration-200 active:scale-[0.97] ${
            view === "upcoming" ? "text-brand-bg" : "text-brand-textMuted"
          }`}
        >
          Upcoming
        </button>
        <button
          type="button"
          onClick={() => setView("past")}
          className={`relative rounded-full px-5 py-2 font-sans text-sm font-semibold transition-[transform,color] duration-200 active:scale-[0.97] ${
            view === "past" ? "text-brand-bg" : "text-brand-textMuted"
          }`}
        >
          Past Results
        </button>
      </div>

      <div key={view} className="tab-transition mt-10 flex flex-col gap-4">
        {events.length === 0 && (
          <p className="rounded-2xl border border-white/10 bg-brand-bg p-6 text-center font-sans text-sm text-brand-textSecondary">
            {view === "upcoming"
              ? "No events scheduled yet — check back soon."
              : "No past events to show."}
          </p>
        )}

        {events.map((event) => (
          <EventCard
            key={event.id}
            event={event}
            surface="panel"
            layout="row"
            showRegister={view === "upcoming"}
          />
        ))}
      </div>
    </div>
  );
}
