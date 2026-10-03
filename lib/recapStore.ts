import { getSupabaseAdmin } from "./supabaseAdmin";

/**
 * Saved weekly recaps. One row per season + week. Drafts are only visible in
 * admin; published ones are served to the public Weeks tab.
 */

export type SavedRecap = {
  season_name: string;
  week_number: number;
  body: string;
  published: boolean;
  updated_at: string;
};

const TABLE_HINT =
  "The saved-recaps table hasn't been created yet. Run the new week_recaps part of recaps-media.sql in Supabase first.";

function wrap(error: any) {
  if (/week_recaps|schema cache|does not exist/i.test(error?.message || "")) return new Error(TABLE_HINT);
  return error;
}

export async function getSavedRecap(season: string, week: number): Promise<SavedRecap | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("week_recaps")
    .select("season_name,week_number,body,published,updated_at")
    .eq("season_name", season)
    .eq("week_number", week)
    .maybeSingle();
  if (error) throw wrap(error);
  return (data as SavedRecap) || null;
}

export async function saveRecap(season: string, week: number, body: string, published: boolean): Promise<SavedRecap> {
  const { data, error } = await getSupabaseAdmin()
    .from("week_recaps")
    .upsert(
      { season_name: season, week_number: week, body, published, updated_at: new Date().toISOString() },
      { onConflict: "season_name,week_number" }
    )
    .select("season_name,week_number,body,published,updated_at")
    .single();
  if (error) throw wrap(error);
  return data as SavedRecap;
}

export async function listPublishedRecaps(): Promise<SavedRecap[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("week_recaps")
    .select("season_name,week_number,body,published,updated_at")
    .eq("published", true)
    .order("season_name", { ascending: true })
    .order("week_number", { ascending: true });
  if (error) throw wrap(error);
  return (data || []) as SavedRecap[];
}
