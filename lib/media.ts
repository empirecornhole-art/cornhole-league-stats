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

export async function listMedia(filter: { season?: string; week?: number } = {}): Promise<MediaItem[]> {
  const supabase = getSupabaseAdmin();
  let q = supabase.from("week_media").select("*");
  if (filter.season) q = q.eq("season_name", filter.season);
  if (filter.week) q = q.eq("week_number", filter.week);
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
  const existing = await listMedia({ season, week });
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
