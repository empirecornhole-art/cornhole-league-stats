import { NextResponse } from "next/server";
import { readLeagueDataFromSupabase } from "../../../lib/supabaseLeague";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await readLeagueDataFromSupabase();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({
      error: error?.message || "Failed to load Supabase league data",
      seasons: [],
      players: [],
      standings: [],
      weekly: [],
      eventStats: [],
      stats: [],
    });
  }
}
