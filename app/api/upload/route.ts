import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { parseWorkbook } from "../../../lib/parseWorkbook";
import { saveLeagueData } from "../../../lib/blob";

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

    await put("league-workbook.xlsx", buffer, {
      access: "private",
      allowOverwrite: true,
      contentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const parsed = await parseWorkbook(arrayBuffer);
    await saveLeagueData(parsed);

    return NextResponse.json({
      ok: true,
      message: `Workbook uploaded and parsed successfully. Seasons: ${parsed.seasons.length}. Players: ${parsed.players.length}. Weekly rows: ${parsed.weekly.length}.`,
      size: file.size,
      summary: {
        seasons: parsed.seasons.length,
        players: parsed.players.length,
        standings: parsed.standings.length,
        weekly: parsed.weekly.length,
        stats: parsed.stats.length,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: error?.message || "Upload and parsing failed",
      },
      { status: 500 }
    );
  }
}
