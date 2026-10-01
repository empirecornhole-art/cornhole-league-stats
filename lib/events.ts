import { getSupabaseAdmin } from "./supabaseAdmin";
import { todayDateString } from "./format";

export type EventRow = {
  id: string;
  event_date: string; // YYYY-MM-DD
  time: string;
  title: string;
  location: string;
  tag: string;
  featured: boolean;
  scoreholio_id: string | null;
  register_url: string | null;
  created_at: string;
};

export type EventInput = {
  event_date: string;
  time?: string;
  title: string;
  location?: string;
  tag?: string;
  featured?: boolean;
};

/**
 * Events dated today or later, soonest first. Table is expected to stay
 * small (a season's worth of events at most), so no pagination workaround
 * is needed here the way the big stats tables in supabaseLeague.ts need it.
 */
export async function getUpcomingEvents(limit?: number): Promise<EventRow[]> {
  const supabase = getSupabaseAdmin();
  let query = supabase
    .from("site_events")
    .select("*")
    .gte("event_date", todayDateString())
    .order("event_date", { ascending: true });

  if (typeof limit === "number") {
    query = query.limit(limit);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as EventRow[];
}

/** Events dated before today, most recent first. */
export async function getPastEvents(): Promise<EventRow[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("site_events")
    .select("*")
    .lt("event_date", todayDateString())
    .order("event_date", { ascending: false });

  if (error) throw error;
  return (data || []) as EventRow[];
}

/** All events for the admin listing, soonest-first (upcoming first, then past descending would split oddly, so just order by date ascending overall isn't ideal either -- soonest/newest first reads best for admin management). */
export async function getAllEventsForAdmin(): Promise<EventRow[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("site_events")
    .select("*")
    .order("event_date", { ascending: false });

  if (error) throw error;
  return (data || []) as EventRow[];
}

export async function createEvent(input: EventInput): Promise<EventRow> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("site_events")
    .insert({
      event_date: input.event_date,
      time: input.time ?? "",
      title: input.title,
      location: input.location ?? "",
      tag: input.tag ?? "Weekly",
      featured: input.featured ?? false,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data as EventRow;
}

export async function updateEvent(id: string, input: Partial<EventInput>): Promise<EventRow> {
  const supabase = getSupabaseAdmin();
  const patch: Record<string, any> = {};
  if (input.event_date !== undefined) patch.event_date = input.event_date;
  if (input.time !== undefined) patch.time = input.time;
  if (input.title !== undefined) patch.title = input.title;
  if (input.location !== undefined) patch.location = input.location;
  if (input.tag !== undefined) patch.tag = input.tag;
  if (input.featured !== undefined) patch.featured = input.featured;

  const { data, error } = await supabase
    .from("site_events")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return data as EventRow;
}

export async function deleteEvent(id: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("site_events").delete().eq("id", id);
  if (error) throw error;
}
