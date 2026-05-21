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

    const result = await importLeagueDataToSupabase(parsed);

    return NextResponse.json({
      ok: true,
      message: `SUPABASE IMPORT SUCCESS: Imported ${parsed.seasons.join(
        ", "
      )}. Players: ${result.players}. Events: ${result.events}. Season stats: ${
        result.seasonStats
      }. Event results: ${result.eventResults}. Event stats: ${
        result.eventStats
      }.`,
      summary: result,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Supabase import failed",
      },
      { status: 500 }
    );
  }
}
