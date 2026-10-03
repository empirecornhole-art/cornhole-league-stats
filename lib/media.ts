import { del } from "@vercel/blob";
import { getSupabaseAdmin } from "./supabaseAdmin";

/**
 * Weekly photos and videos. Files are stored in a *public* Vercel Blob store
 * (token in MEDIA_READ_WRITE_TOKEN) so the site and, later, Facebook and
 * Instagram can fetch them by URL. The league data store is private and
 * separate. The week_media table remembers which file belongs to which week.
 */

export type MediaItem = {
  id: string;
  season_name: string;
  week_number: number;
  kind: "photo" | "video";
  url: string;
  pathname: string;
  caption: string;
  sort_order: number;
};

export function mediaToken() {
  return String(process.env.MEDIA_READ_WRITE_TOKEN || "").trim();
}

export function mediaConfigured() {
  return !!mediaToken();
}

const TABLE_HINT =
  "The photo/video database table hasn't been created yet. Run the recaps-media.sql script in Supabase first.";

function wrap(error: any) {
  if (/week_media|schema cache|does not exist/i.test(error?.message || "")) return new Error(TABLE_HINT);
  return error;
}

// Files uploaded before their week's results are imported wait here (season "" and week 0)
// until an admin pairs them to a week. They are never shown on the public site.
export const UNASSIGNED_SEASON = "";
export const UNASSIGNED_WEEK = 0;

export async function listMedia(
  filter: { season?: string; week?: number; unassigned?: boolean } = {}
): Promise<MediaItem[]> {
  const supabase = getSupabaseAdmin();
  let q = supabase.from("week_media").select("*");
  if (filter.unassigned) {
    q = q.eq("season_name", UNASSIGNED_SEASON).eq("week_number", UNASSIGNED_WEEK);
  } else {
    if (filter.season) q = q.eq("season_name", filter.season);
    if (filter.week) q = q.eq("week_number", filter.week);
  }
  const { data, error } = await q
    .order("season_name", { ascending: true })
    .order("week_number", { ascending: true })
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw wrap(error);
  return (data || []) as MediaItem[];
}

export async function addMedia(
  season: string,
  week: number,
  items: { url: string; pathname: string; kind: "photo" | "video"; caption?: string }[]
) {
  const supabase = getSupabaseAdmin();
  const unassigned = !season || !week;
  if (unassigned) {
    season = UNASSIGNED_SEASON;
    week = UNASSIGNED_WEEK;
  }
  const existing = await listMedia(unassigned ? { unassigned: true } : { season, week });
  let order = existing.reduce((m, r) => Math.max(m, r.sort_order), -1) + 1;
  const rows = items.map((i) => ({
    season_name: season,
    week_number: week,
    kind: i.kind,
    url: i.url,
    pathname: i.pathname,
    caption: (i.caption || "").trim(),
    sort_order: order++,
  }));
  const { data, error } = await supabase.from("week_media").insert(rows).select("*");
  if (error) throw wrap(error);
  return (data || []) as MediaItem[];
}

/** True if that season/week has imported results (so photos for it can go live straight away). */
export async function weekHasData(season: string, week: number): Promise<boolean> {
  if (!season || !week) return false;
  const supabase = getSupabaseAdmin();
  const { data: s } = await supabase.from("seasons").select("id").eq("name", season).maybeSingle();
  if (!s) return false;
  const { data: e } = await supabase.from("events").select("id").eq("season_id", s.id).eq("week_number", week).limit(1);
  return !!(e && e.length);
}

/** Pairs files (usually from the Unassigned pool) to a season/week. */
export async function assignMedia(ids: string[], season: string, week: number) {
  if (!ids.length) return;
  const supabase = getSupabaseAdmin();
  const existing = await listMedia({ season, week });
  let order = existing.reduce((m, r) => Math.max(m, r.sort_order), -1) + 1;
  for (const id of ids) {
    const { error } = await supabase
      .from("week_media")
      .update({ season_name: season, week_number: week, sort_order: order++ })
      .eq("id", id);
    if (error) throw wrap(error);
  }
}

export async function updateCaption(id: string, caption: string) {
  const { error } = await getSupabaseAdmin().from("week_media").update({ caption: caption.trim() }).eq("id", id);
  if (error) throw wrap(error);
}

export async function deleteMedia(id: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("week_media").select("url").eq("id", id).maybeSingle();
  if (error) throw wrap(error);
  if (!data) return;
  const { error: delErr } = await supabase.from("week_media").delete().eq("id", id);
  if (delErr) throw wrap(delErr);
  // Best effort: the row is already gone, so a failed file delete isn't fatal.
  try {
    await del(data.url, { token: mediaToken() });
  } catch {
    /* leave the orphaned file */
  }
}
