import { NextResponse } from "next/server";
import { loadLeagueData } from "../../../lib/blob";

export const runtime = "nodejs";

export async function GET() {
  try {
    const data = await loadLeagueData();

    if (!data) {
      return NextResponse.json({
        debug: "No league data found in Blob",
        seasons: [],
        players: [],
        standings: [],
        weekly: [],
        stats: [],
      });
    }

    return NextResponse.json({
      ...data,
      debug: "League data loaded successfully",
    });
  } catch (error: any) {
    return NextResponse.json({
      debug: "Error loading league data",
      error: error?.message || "Unknown error",
      seasons: [],
      players: [],
      standings: [],
      weekly: [],
      stats: [],
    });
  }
}
