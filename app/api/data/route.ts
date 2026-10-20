import { NextResponse } from "next/server";
import { readLeagueDataFromSupabase } from "../../../lib/supabaseLeague";
import { useDevMock, mockLeagueData } from "../../../lib/devMock";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (useDevMock()) return NextResponse.json(mockLeagueData());
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
