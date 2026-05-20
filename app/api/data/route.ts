import { NextResponse } from "next/server";
import { loadLeagueData } from "../../../lib/blob";

export const runtime = "nodejs";

export async function GET() {
  try {
    const data = await loadLeagueData();

    if (!data) {
      return NextResponse.json({
        seasons: [],
        players: [],
        standings: [],
        weekly: [],
        stats: [],
      });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json(
      {
        error: error?.message || "Failed to load league data",
        seasons: [],
        players: [],
        standings: [],
        weekly: [],
        stats: [],
      },
      { status: 200 }
    );
  }
}
