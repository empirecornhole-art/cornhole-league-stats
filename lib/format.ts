// Shared date formatting helpers for events.

/**
 * Formats an ISO/date-string (YYYY-MM-DD, as returned by Postgres `date`
 * columns) into the two-line day/month badge shape used across the site,
 * e.g. "2026-10-12" -> { day: "12", month: "OCT" }.
 *
 * Parses the pieces manually (rather than `new Date(str)`) so the value
 * isn't shifted by the viewer's/server's timezone -- a plain "YYYY-MM-DD"
 * string parsed via the Date constructor is treated as UTC midnight, which
 * can render as the previous day in negative-UTC-offset timezones.
 */
export function formatEventDateParts(eventDate: string): { day: string; month: string } {
  const match = String(eventDate || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return { day: "--", month: "" };

  const [, , monthStr, dayStr] = match;
  const monthIndex = Number(monthStr) - 1;
  const months = [
    "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
    "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
  ];

  return {
    day: dayStr,
    month: months[monthIndex] || "",
  };
}

/** e.g. "2026-10-12" -> "Sat, Oct 12" (used in the homepage hero strip). */
export function formatEventDateShort(eventDate: string): string {
  const match = String(eventDate || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return "";

  const [, yearStr, monthStr, dayStr] = match;
  const year = Number(yearStr);
  const month = Number(monthStr) - 1;
  const day = Number(dayStr);

  // Construct at noon UTC to avoid any DST/timezone edge cases shifting
  // the weekday when formatting.
  const date = new Date(Date.UTC(year, month, day, 12));
  const weekday = date.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
  const monthName = date.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });

  return `${weekday}, ${monthName} ${day}`;
}

/** Today as a YYYY-MM-DD string, for comparing against `event_date` columns. */
export function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

function eventDateUtc(eventDate: string) {
  const match = String(eventDate || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  // Noon UTC so no timezone can shift the day.
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12));
}

/** e.g. "2026-12-07" -> "December 2026" (month headings on the Events page). */
export function formatMonthYear(eventDate: string): string {
  const date = eventDateUtc(eventDate);
  return date ? date.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" }) : "";
}

/** e.g. "2026-12-07" -> "Mon" */
export function formatWeekday(eventDate: string): string {
  const date = eventDateUtc(eventDate);
  return date ? date.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }) : "";
}

/** Whole days from today to a YYYY-MM-DD date (negative once it has passed). */
export function daysUntilDate(eventDate: string): number | null {
  const to = Date.parse(`${String(eventDate).slice(0, 10)}T00:00:00Z`);
  const from = Date.parse(`${todayDateString()}T00:00:00Z`);
  if (Number.isNaN(to) || Number.isNaN(from)) return null;
  return Math.round((to - from) / 86_400_000);
}
