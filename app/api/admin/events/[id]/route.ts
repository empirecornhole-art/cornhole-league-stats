import { NextResponse } from "next/server";
import { deleteEvent, updateEvent } from "../../../../../lib/events";

export const runtime = "nodejs";

function checkPassword(req: Request) {
  const password = req.headers.get("x-admin-password");
  return password === process.env.ADMIN_PASSWORD;
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!checkPassword(req)) {
    return NextResponse.json({ ok: false, error: "Invalid password" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await req.json();

    if (body?.title !== undefined && !String(body.title).trim()) {
      return NextResponse.json({ ok: false, error: "Title is required" }, { status: 400 });
    }
    if (body?.event_date !== undefined && !String(body.event_date).trim()) {
      return NextResponse.json({ ok: false, error: "Event date is required" }, { status: 400 });
    }

    const event = await updateEvent(id, {
      event_date: body?.event_date,
      time: body?.time,
      title: body?.title,
      location: body?.location,
      tag: body?.tag,
      featured: body?.featured,
    });

    return NextResponse.json({ ok: true, event });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to update event" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!checkPassword(req)) {
    return NextResponse.json({ ok: false, error: "Invalid password" }, { status: 401 });
  }

  try {
    const { id } = await params;
    await deleteEvent(id);
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to delete event" },
      { status: 500 }
    );
  }
}
