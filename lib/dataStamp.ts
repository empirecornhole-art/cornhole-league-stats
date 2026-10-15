import { getSupabaseAdmin } from "./supabaseAdmin";
import { seasonOrderKey } from "./recap";

/**
 * When results were last imported, and which week is the latest on the site.
 * Both degrade quietly (no timestamp / no week) if the column or tables aren't
 * there yet, so public pages never break over them.
 */

/** Records "results just changed". Called after every successful import. Never throws. */
export async function touchDataUpdated(): Promise<void> {
  try {
    await getSupabaseAdmin()
      .from("site_settings")
      .update({ data_updated_at: new Date().toISOString() })
      .eq("id", 1);
  } catch {
    /* column not created yet: the site just shows no timestamp */
  }
}

/** ISO time of the last import, or "" if unknown. */
export async function getDataUpdated(): Promise<string> {
  try {
    const { data, error } = await getSupabaseAdmin().from("site_settings").select("data_updated_at").eq("id", 1).maybeSingle();
    if (error) return "";
    return (data as any)?.data_updated_at || "";
  } catch {
    return "";
  }
}

/** The newest season that has imported results, and its highest imported week. */
export async function getLatestImportedWeek(): Promise<{ season: string; week: number } | null> {
  try {
    const supabase = getSupabaseAdmin();
    const { data: seasons } = await supabase.from("seasons").select("id,name");
    const { data: events } = await supabase.from("events").select("season_id,week_number");
    if (!seasons?.length || !events?.length) return null;

    const maxWeek = new Map<string, number>();
    for (const e of events) {
      if (!e.week_number) continue;
      maxWeek.set(e.season_id, Math.max(maxWeek.get(e.season_id) || 0, e.week_number));
    }
    const withResults = seasons.filter((s) => maxWeek.has(s.id));
    if (!withResults.length) return null;
    const newest = withResults.sort((a, b) => seasonOrderKey(b.name) - seasonOrderKey(a.name))[0];
    return { season: newest.name, week: maxWeek.get(newest.id)! };
  } catch {
    return null;
  }
}
