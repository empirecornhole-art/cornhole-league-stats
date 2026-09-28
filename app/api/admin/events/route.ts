import { NextResponse } from "next/server";
import { createEvent, getAllEventsForAdmin } from "../../../../lib/events";

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
    const events = await getAllEventsForAdmin();
    return NextResponse.json({ ok: true, events });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to load events" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  if (!checkPassword(req)) {
    return NextResponse.json({ ok: false, error: "Invalid password" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const title = String(body?.title || "").trim();
    const event_date = String(body?.event_date || "").trim();

    if (!title) {
      return NextResponse.json({ ok: false, error: "Title is required" }, { status: 400 });
    }
    if (!event_date) {
      return NextResponse.json({ ok: false, error: "Event date is required" }, { status: 400 });
    }

    const event = await createEvent({
      event_date,
      title,
      time: body?.time,
      location: body?.location,
      tag: body?.tag,
      featured: body?.featured,
    });

    return NextResponse.json({ ok: true, event });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to create event" },
      { status: 500 }
    );
  }
}
