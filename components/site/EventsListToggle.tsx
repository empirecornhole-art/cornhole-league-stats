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
      <div className="mx-auto flex w-fit rounded-full border border-white/10 bg-brand-panel p-1">
        <button
          type="button"
          onClick={() => setView("upcoming")}
          className={`rounded-full px-5 py-2 font-sans text-sm font-semibold transition-[transform,background-color,color] duration-200 active:scale-[0.97] ${
            view === "upcoming" ? "bg-brand-orange text-brand-bg" : "text-brand-textMuted"
          }`}
        >
          Upcoming
        </button>
        <button
          type="button"
          onClick={() => setView("past")}
          className={`rounded-full px-5 py-2 font-sans text-sm font-semibold transition-[transform,background-color,color] duration-200 active:scale-[0.97] ${
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
