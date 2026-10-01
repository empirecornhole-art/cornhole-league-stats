import { NextResponse } from "next/server";
import { syncScoreholioEvents } from "../../../../lib/scoreholio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Called by the Vercel cron in vercel.json. Vercel sends
// `Authorization: Bearer $CRON_SECRET` when that env var is set.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await syncScoreholioEvents();
    return NextResponse.json({ ok: true, ...result });
  } catch (error: any) {
    console.error("Scoreholio cron sync failed:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Scoreholio sync failed" },
      { status: 500 }
    );
  }
}
