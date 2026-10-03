import { NextResponse } from "next/server";
import { listPublishedRecaps } from "../../../lib/recapStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Public feed behind the Weeks tab's recap. Published recaps only. Fails soft
// so the Weeks tab still works if the table doesn't exist yet.
export async function GET() {
  try {
    const recaps = await listPublishedRecaps();
    return NextResponse.json(
      {
        items: recaps.map((r) => ({ season: r.season_name, week: r.week_number, body: r.body, updated: r.updated_at })),
      },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } }
    );
  } catch {
    return NextResponse.json({ items: [] });
  }
}
