import { getSupabaseAdmin } from "./supabaseAdmin";

export type SiteSettings = {
  venue_name: string;
  venue_address: string;
  contact_email: string;
  facebook_url: string;
  instagram_url: string;
  season_label: string;
  current_week: string;
};

const DEFAULT_SETTINGS: SiteSettings = {
  venue_name: "",
  venue_address: "",
  contact_email: "",
  facebook_url: "",
  instagram_url: "",
  season_label: "",
  current_week: "",
};

function toSiteSettings(row: any): SiteSettings {
  return {
    venue_name: row?.venue_name ?? "",
    venue_address: row?.venue_address ?? "",
    contact_email: row?.contact_email ?? "",
    facebook_url: row?.facebook_url ?? "",
    instagram_url: row?.instagram_url ?? "",
    season_label: row?.season_label ?? "",
    current_week: row?.current_week ?? "",
  };
}

/**
 * Returns the single site_settings row (id=1). If the table/row doesn't
 * exist yet (e.g. the SQL migration hasn't been run), or Supabase env vars
 * aren't configured (e.g. during a build without live credentials), this
 * degrades to a sensible empty-string default instead of throwing, so
 * public pages never hard-crash over missing settings.
 */
export async function getSiteSettings(): Promise<SiteSettings> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("site_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle();

    if (error) {
      console.error("getSiteSettings error:", error.message);
      return { ...DEFAULT_SETTINGS };
    }

    if (!data) return { ...DEFAULT_SETTINGS };

    return toSiteSettings(data);
  } catch (error: any) {
    console.error("getSiteSettings failed:", error?.message || error);
    return { ...DEFAULT_SETTINGS };
  }
}

/** Upserts the single settings row (id always 1). */
export async function updateSiteSettings(input: Partial<SiteSettings>): Promise<SiteSettings> {
  const supabase = getSupabaseAdmin();

  const patch: Record<string, any> = { id: 1 };
  if (input.venue_name !== undefined) patch.venue_name = input.venue_name;
  if (input.venue_address !== undefined) patch.venue_address = input.venue_address;
  if (input.contact_email !== undefined) patch.contact_email = input.contact_email;
  if (input.facebook_url !== undefined) patch.facebook_url = input.facebook_url;
  if (input.instagram_url !== undefined) patch.instagram_url = input.instagram_url;
  if (input.season_label !== undefined) patch.season_label = input.season_label;
  if (input.current_week !== undefined) patch.current_week = input.current_week;

  const { data, error } = await supabase
    .from("site_settings")
    .upsert(patch, { onConflict: "id" })
    .select("*")
    .single();

  if (error) throw error;
  return toSiteSettings(data);
}
