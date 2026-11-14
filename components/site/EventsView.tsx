"use client";

import { useState } from "react";
import Link from "next/link";
import StaggerIn from "./StaggerIn";

export type EventDisplay = {
  id: string;
  date: string; // YYYY-MM-DD
  day: string;
  month: string; // JAN..DEC
  weekday: string;
  monthLabel: string; // "December 2026"
  title: string;
  tag: string;
  meta: string;
  featured: boolean;
  registerUrl: string;
  daysUntil: number | null;
};

function countdown(days: number | null) {
  if (days === null) return "";
  if (days <= 0) return "Tonight";
  if (days === 1) return "Tomorrow";
  return `In ${days} days`;
}

// Events grouped by month, in the order given.
function groupByMonth(events: EventDisplay[]) {
  const groups: { label: string; events: EventDisplay[] }[] = [];
  for (const event of events) {
    const last = groups[groups.length - 1];
    if (last && last.label === event.monthLabel) last.events.push(event);
    else groups.push({ label: event.monthLabel, events: [event] });
  }
  return groups;
}

function EventRow({ event, past }: { event: EventDisplay; past: boolean }) {
  return (
    <li className="grid grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-x-4 gap-y-3 py-4 sm:grid-cols-[4rem_minmax(0,1fr)_auto] sm:gap-x-6">
      <div className="text-center">
        <div className={`font-display text-4xl leading-none ${past ? "text-brand-textSecondary" : "text-brand-text"}`}>{event.day}</div>
        <div className="mt-1 font-sans text-xs font-bold uppercase tracking-[0.08em] text-brand-textMuted">{event.weekday}</div>
      </div>
      <div className="min-w-0">
        <h3 className="truncate font-display text-xl uppercase leading-tight text-brand-text">{event.title}</h3>
        {event.meta && <p className="mt-1 font-sans text-sm text-brand-textSecondary">{event.meta}</p>}
        {event.tag && (
          <span className={`mt-2 inline-block rounded-full px-2.5 py-1 font-sans text-xs font-semibold ${event.featured ? "bg-brand-orange text-brand-bg" : "bg-white/10 text-brand-textSecondary"}`}>
            {event.tag}
          </span>
        )}
      </div>
      {!past && event.registerUrl && (
        <a
          href={event.registerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-nav-cta col-start-2 justify-self-start sm:col-start-3 sm:justify-self-end"
        >
          Register
          <span className="sr-only"> for {event.title} (opens in a new tab)</span>
        </a>
      )}
    </li>
  );
}

export default function EventsView({ upcoming, past }: { upcoming: EventDisplay[]; past: EventDisplay[] }) {
  const [view, setView] = useState<"upcoming" | "past">("upcoming");
  const isPast = view === "past";
  const next = !isPast ? upcoming[0] : undefined;
  const list = isPast ? past : upcoming.slice(1);
  const groups = groupByMonth(list);

  return (
    <div>
      <div role="tablist" aria-label="Events" className="mx-auto flex w-fit rounded-full bg-white/[0.06] p-1">
        {(
          [
            { id: "upcoming", label: "Upcoming" },
            { id: "past", label: "Past results" },
          ] as const
        ).map((item) => {
          const active = view === item.id;
          return (
            <button
              key={item.id}
              role="tab"
              aria-selected={active}
              onClick={() => setView(item.id)}
              className={`min-h-10 whitespace-nowrap rounded-full px-5 font-sans text-sm font-semibold transition-[background-color,color] duration-200 ${
                active ? "bg-brand-text text-brand-bg" : "text-brand-textSecondary hover:text-brand-text"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      <StaggerIn key={view} className="mt-10 space-y-8 md:mt-12 md:space-y-10">
        {!isPast && upcoming.length === 0 && (
          <p className="rounded-3xl bg-brand-panel p-8 text-center font-sans text-brand-textSecondary">No events scheduled yet. Check back soon.</p>
        )}
        {isPast && past.length === 0 && (
          <p className="rounded-3xl bg-brand-panel p-8 text-center font-sans text-brand-textSecondary">No past events to show.</p>
        )}

        {next && (
          <section className="relative overflow-hidden rounded-3xl bg-brand-panel p-6 md:p-10">
            <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-brand-orange/20 blur-[90px]" aria-hidden />
            <div className="relative">
              <div className="flex items-center justify-between gap-4">
                <span className="eyebrow">Next up</span>
                {countdown(next.daysUntil) && (
                  <span className="rounded-full bg-brand-orange px-3 py-1 font-sans text-xs font-bold text-brand-bg">{countdown(next.daysUntil)}</span>
                )}
              </div>
              <h2 className="mt-5 font-display text-5xl uppercase leading-none text-brand-text md:text-7xl">{next.title}</h2>
              <p className="mt-4 font-sans text-lg text-brand-textSecondary">
                {next.weekday}, {next.monthLabel.split(" ")[0].slice(0, 3)} {next.day}
                {next.meta ? ` · ${next.meta}` : ""}
              </p>
              {next.tag && (
                <span className="mt-4 inline-block rounded-full bg-white/10 px-3 py-1 font-sans text-sm font-semibold text-brand-textSecondary">{next.tag}</span>
              )}
              {next.registerUrl && (
                <div className="mt-7">
                  <a href={next.registerUrl} target="_blank" rel="noopener noreferrer" className="btn-primary">
                    Register
                    <span className="sr-only"> for {next.title} (opens in a new tab)</span>
                  </a>
                </div>
              )}
            </div>
          </section>
        )}

        {isPast && past.length > 0 && (
          <p className="font-sans text-brand-textSecondary">
            Looking for scores? Every week&apos;s results are on the{" "}
            <Link href="/leagues?tab=weeks" className="font-bold text-brand-orange underline-offset-4 hover:underline">
              League page
            </Link>
            .
          </p>
        )}

        {groups.map((group) => (
          <section key={group.label}>
            <h2 className="mb-1 font-display text-2xl uppercase text-brand-textSecondary">{group.label}</h2>
            <ul className="divide-y divide-white/[0.07] rounded-3xl bg-brand-panel px-5 md:px-8">
              {group.events.map((event) => (
                <EventRow key={event.id} event={event} past={isPast} />
              ))}
            </ul>
          </section>
        ))}
      </StaggerIn>
    </div>
  );
}
