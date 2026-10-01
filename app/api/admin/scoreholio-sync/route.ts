import { NextResponse } from "next/server";
import { syncScoreholioEvents } from "../../../../lib/scoreholio";

export const runtime = "nodejs";

function checkPassword(req: Request) {
  const password = req.headers.get("x-admin-password");
  return password === process.env.ADMIN_PASSWORD;
}

export async function POST(req: Request) {
  if (!checkPassword(req)) {
    return NextResponse.json({ ok: false, error: "Invalid password" }, { status: 401 });
  }

  try {
    const result = await syncScoreholioEvents();
    return NextResponse.json({ ok: true, ...result });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Scoreholio sync failed" },
      { status: 500 }
    );
  }
}
