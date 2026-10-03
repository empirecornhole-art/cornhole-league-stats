import { NextResponse } from "next/server";
import { buildRecaps, getRecapOptions } from "../../../../lib/recap";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (body?.password !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ ok: false, error: "Invalid password" }, { status: 401 });
    }

    if (body.action === "options") {
      return NextResponse.json({ ok: true, options: await getRecapOptions() });
    }

    const season = String(body.season || "").trim();
    const week = Number(body.week);
    if (!season || !week) {
      return NextResponse.json({ ok: false, error: "Pick a season and week." }, { status: 400 });
    }

    const recap = await buildRecaps(season, week, {
      switchNotes: body.switchNotes,
      blindNotes: body.blindNotes,
      switchLink: body.switchLink,
      blindLink: body.blindLink,
    });
    return NextResponse.json({ ok: true, ...recap });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "Recap failed" }, { status: 500 });
  }
}
