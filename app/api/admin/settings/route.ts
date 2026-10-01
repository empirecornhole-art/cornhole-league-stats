import { NextResponse } from "next/server";
import { getSiteSettings, updateSiteSettings } from "../../../../lib/settings";

export const runtime = "nodejs";

function checkPassword(req: Request) {
  const password = req.headers.get("x-admin-password");
  return password === process.env.ADMIN_PASSWORD;
}

export async function GET(req: Request) {
  if (!checkPassword(req)) {
    return NextResponse.json({ ok: false, error: "Invalid password" }, { status: 401 });
  }

  try {
    const settings = await getSiteSettings();
    return NextResponse.json({ ok: true, settings });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to load settings" },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  if (!checkPassword(req)) {
    return NextResponse.json({ ok: false, error: "Invalid password" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const settings = await updateSiteSettings({
      venue_name: body?.venue_name,
      venue_address: body?.venue_address,
      contact_email: body?.contact_email,
      facebook_url: body?.facebook_url,
      instagram_url: body?.instagram_url,
      season_label: body?.season_label,
      current_week: body?.current_week,
      scoreholio_match: body?.scoreholio_match,
    });

    return NextResponse.json({ ok: true, settings });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to save settings" },
      { status: 500 }
    );
  }
}
