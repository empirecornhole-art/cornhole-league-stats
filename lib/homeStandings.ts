import { getSupabaseAdmin } from "./supabaseAdmin";
import { useDevMock, mockHomeStandings } from "./devMock";

/**
 * The top of the season standings for the homepage: player name and league
 * points only (the same numbers the League page's standings show), plus how
 * many players are on the board. Never throws: the homepage just leaves the
 * tile out.
 */

export type HomeStandingRow = { name: string; points: number };

export type HomeStandings = {
  season: string;
  rows: HomeStandingRow[];
  playerCount: number;
};

function validName(name: string) {
  const n = name.trim();
  return !!n && !/^\d+$/.test(n) && !n.startsWith("#");
}

export async function getHomeStandings(season: string, limit = 5): Promise<HomeStandings | null> {
  if (useDevMock()) return mockHomeStandings(limit);
  if (!season) return null;

  try {
    const supabase = getSupabaseAdmin();
    const { data: seasonRow } = await supabase.from("seasons").select("id").eq("name", season).maybeSingle();
    if (!seasonRow) return null;

    const { data, error } = await supabase
      .from("season_stats")
      .select("player_name,standing_points,total_points")
      .eq("season_id", seasonRow.id)
      .limit(1000);
    if (error || !data?.length) return null;

    const ranked = data
      .map((row: any) => ({ name: String(row.player_name || ""), points: Number(row.standing_points ?? row.total_points) || 0 }))
      .filter((row) => validName(row.name) && row.points > 0)
      .sort((a, b) => b.points - a.points);
    if (!ranked.length) return null;

    return { season, rows: ranked.slice(0, limit), playerCount: ranked.length };
  } catch {
    return null;
  }
}
