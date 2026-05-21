import { NextResponse } from "next/server";
import { parseWorkbook } from "../../../lib/parseWorkbook";
import { importLeagueDataToSupabase } from "../../../lib/supabaseLeague";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const password = formData.get("password");
    const file = formData.get("file") as File | null;

    if (password !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ error: "Invalid password" }, { status: 401 });
    }

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const parsed = await parseWorkbook(arrayBuffer, file.name);
    const summary = await importLeagueDataToSupabase(parsed);

    return NextResponse.json({
      ok: true,
      message: `Imported ${summary.season} into Supabase. Players: ${summary.players}. Events: ${summary.events}. Season stats: ${summary.seasonStats}. Event results: ${summary.eventResults}. Event stats: ${summary.eventStats}.`,
      size: file.size,
      summary,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: error?.message || "Upload/import failed",
      },
      { status: 500 }
    );
  }
}
