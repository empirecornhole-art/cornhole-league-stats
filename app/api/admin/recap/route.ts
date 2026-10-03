import { NextResponse } from "next/server";
import { buildRecaps, getRecapOptions } from "../../../../lib/recap";
import { getSavedRecap, saveRecap } from "../../../../lib/recapStore";

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

    if (body.action === "load") {
      return NextResponse.json({ ok: true, saved: await getSavedRecap(season, week) });
    }

    if (body.action === "save") {
      const text = String(body.body ?? "");
      if (!text.trim()) {
        return NextResponse.json({ ok: false, error: "There's no recap text to save." }, { status: 400 });
      }
      return NextResponse.json({ ok: true, saved: await saveRecap(season, week, text, !!body.published) });
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
