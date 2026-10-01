import { getSupabaseAdmin } from "./supabaseAdmin";
import { getSiteSettings } from "./settings";
import { todayDateString } from "./format";

/**
 * Pulls the club's upcoming tournaments from Scoreholio into site_events.
 *
 * Scoreholio has no public API; this is the same endpoint their own
 * "find a tournament" page calls for an organizer's share link. It is
 * undocumented and may change -- if it does, the sync fails loudly in the
 * logs/admin and existing events stay as they are.
 */

const SCOREHOLIO_ENDPOINT = "https://us-central1-scoreholio.cloudfunctions.net/apiv2/find/get-tournaments";

// Organizer account behind https://share.scoreholio.com/ss23QWxYR6b
const SCOREHOLIO_ORGANIZER_ID = "ek83uwLyPQXsyVnvoxERJto6kDU2";

const DEFAULT_MATCH_PHRASE = "Empire Cornhole";

type ScoreholioRow = {
  gameid: string;
  name: string;
  gametime: string; // unix seconds
  timezone: string;
  locationname: string;
  locationcity: string;
  locationstate: string;
  teamcreate: string;
  format: string;
  seasonName: string;
  dynamiclink: string;
};

export type ScoreholioSyncResult = {
  fetched: number;
  matched: number;
  upserted: number;
  removed: number;
  skipped: string[];
};

async function fetchOrganizerTournaments(): Promise<ScoreholioRow[]> {
  const res = await fetch(SCOREHOLIO_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      sport: "cornhole",
      lat: 0,
      lng: 0,
      type: "Organizer",
      customID: SCOREHOLIO_ORGANIZER_ID,
      sort: "date",
      sortDir: "asc",
      startRow: 0,
      endRow: 100,
      filterModel: {},
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Scoreholio request failed (${res.status})`);
  }

  const data = await res.json();
  if (!Array.isArray(data?.rows)) {
    throw new Error("Unexpected Scoreholio response shape");
  }
  return data.rows as ScoreholioRow[];
}

/** Ours if the tournament name or its season contains the phrase. */
function isOurs(row: ScoreholioRow, phrase: string): boolean {
  const needle = phrase.trim().toLowerCase();
  if (!needle) return false;
  return [row.name, row.seasonName].some((v) => String(v || "").toLowerCase().includes(needle));
}

function toEventFields(row: ScoreholioRow) {
  const when = new Date(Number(row.gametime) * 1000);
  const timeZone = row.timezone || "America/New_York";

  // en-CA formats as YYYY-MM-DD, matching the event_date column.
  const event_date = when.toLocaleDateString("en-CA", { timeZone });
  const time = when.toLocaleTimeString("en-US", { timeZone, hour: "numeric", minute: "2-digit" });

  const hasLocation = row.locationname && !/location not detected/i.test(row.locationname);
  const cityState = [row.locationcity, row.locationstate].filter((v) => v && !/^unknown/i.test(v)).join(", ");
  const location = hasLocation ? [row.locationname, cityState].filter(Boolean).join(", ") : "";

  return {
    scoreholio_id: row.gameid,
    event_date,
    time,
    title: row.name.trim(),
    location,
    tag: row.teamcreate || row.format || "Tournament",
    register_url: row.dynamiclink || "",
  };
}

export async function syncScoreholioEvents(): Promise<ScoreholioSyncResult> {
  const settings = await getSiteSettings();
  const phrase = settings.scoreholio_match || DEFAULT_MATCH_PHRASE;

  const rows = await fetchOrganizerTournaments();
  const ours = rows.filter((row) => isOurs(row, phrase));
  const skipped = rows.filter((row) => !isOurs(row, phrase)).map((row) => row.name.trim());
  const events = ours.map(toEventFields);

  const supabase = getSupabaseAdmin();

  // `featured` is left out so an admin's choice survives re-syncs; new rows
  // get the column default (false).
  if (events.length > 0) {
    const { error } = await supabase.from("site_events").upsert(events, { onConflict: "scoreholio_id" });
    if (error) throw error;
  }

  // Remove upcoming synced events that are no longer on Scoreholio (cancelled,
  // or renamed so they no longer match). Past events and manual events are
  // never touched.
  const { data: existing, error: existingError } = await supabase
    .from("site_events")
    .select("id, scoreholio_id")
    .not("scoreholio_id", "is", null)
    // Strictly after today: a tournament already underway may drop off
    // Scoreholio's upcoming list, and today's event shouldn't vanish mid-night.
    .gt("event_date", todayDateString());
  if (existingError) throw existingError;

  const keep = new Set(events.map((e) => e.scoreholio_id));
  const staleIds = (existing || []).filter((e) => !keep.has(e.scoreholio_id)).map((e) => e.id);

  if (staleIds.length > 0) {
    const { error } = await supabase.from("site_events").delete().in("id", staleIds);
    if (error) throw error;
  }

  return {
    fetched: rows.length,
    matched: ours.length,
    upserted: events.length,
    removed: staleIds.length,
    skipped,
  };
}
