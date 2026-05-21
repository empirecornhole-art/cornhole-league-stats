import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { parseWorkbook } from "../../../lib/parseWorkbook";
import { loadLeagueData, mergeSeasonData, saveLeagueData } from "../../../lib/blob";

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
    const buffer = Buffer.from(arrayBuffer);

    const parsed = await parseWorkbook(arrayBuffer, file.name);
    const existing = await loadLeagueData();
    const merged = mergeSeasonData(existing, parsed);

    const safeSeason = parsed.seasons[0]?.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "season";

    await put(`workbooks/${safeSeason}.xlsx`, buffer, {
      access: "private",
      allowOverwrite: true,
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    await saveLeagueData(merged);

    return NextResponse.json({
      ok: true,
      message: `Season uploaded and merged successfully. Season: ${parsed.seasons[0]}. Total seasons: ${merged.seasons.length}. Total players: ${merged.players.length}.`,
      size: file.size,
      summary: {
        uploadedSeason: parsed.seasons[0],
        seasons: merged.seasons.length,
        players: merged.players.length,
        standings: merged.standings.length,
        weekly: merged.weekly.length,
        stats: merged.stats.length,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Upload and parsing failed" },
      { status: 500 }
    );
  }
}
