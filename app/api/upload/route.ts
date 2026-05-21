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

    await put(`workbooks/${file.name}`, buffer, {
      access: "private",
      allowOverwrite: true,
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const parsed = await parseWorkbook(arrayBuffer, file.name);
    const existing = await loadLeagueData();
    const merged = mergeSeasonData(existing, parsed);
    await saveLeagueData(merged);

    return NextResponse.json({
      ok: true,
      message: `Workbook uploaded and parsed successfully. Season: ${parsed.seasons[0]}. Players: ${parsed.players.length}. Weekly standings: ${parsed.weekly.length}. Event stats: ${parsed.eventStats.length}.`,
      size: file.size,
      summary: {
        season: parsed.seasons[0],
        seasons: merged.seasons.length,
        players: merged.players.length,
        standings: merged.standings.length,
        weekly: merged.weekly.length,
        stats: merged.stats.length,
        eventStats: merged.eventStats.length,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Upload and parsing failed" },
      { status: 500 }
    );
  }
}
