import { NextResponse } from "next/server";
import { addMedia, deleteMedia, listMedia, mediaConfigured, updateCaption } from "../../../../lib/media";

export const runtime = "nodejs";

function authorized(req: Request) {
  return req.headers.get("x-admin-password") === process.env.ADMIN_PASSWORD;
}

const unauthorized = () => NextResponse.json({ ok: false, error: "Invalid password" }, { status: 401 });
const fail = (error: any) => NextResponse.json({ ok: false, error: error?.message || "Request failed" }, { status: 500 });

export async function GET(req: Request) {
  if (!authorized(req)) return unauthorized();
  try {
    const url = new URL(req.url);
    const season = url.searchParams.get("season") || undefined;
    const week = Number(url.searchParams.get("week")) || undefined;
    return NextResponse.json({ ok: true, configured: mediaConfigured(), items: await listMedia({ season, week }) });
  } catch (error) {
    return fail(error);
  }
}

// Record files after the browser has finished uploading them.
export async function POST(req: Request) {
  if (!authorized(req)) return unauthorized();
  try {
    const body = await req.json();
    const season = String(body?.season || "").trim();
    const week = Number(body?.week);
    const items = Array.isArray(body?.items) ? body.items : [];
    if (!season || !week || !items.length) {
      return NextResponse.json({ ok: false, error: "Season, week and files are required." }, { status: 400 });
    }
    const saved = await addMedia(
      season,
      week,
      items.map((i: any) => ({
        url: String(i.url),
        pathname: String(i.pathname),
        kind: i.kind === "video" ? "video" : "photo",
        caption: i.caption,
      }))
    );
    return NextResponse.json({ ok: true, items: saved });
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(req: Request) {
  if (!authorized(req)) return unauthorized();
  try {
    const body = await req.json();
    await updateCaption(String(body?.id), String(body?.caption ?? ""));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(req: Request) {
  if (!authorized(req)) return unauthorized();
  try {
    const body = await req.json();
    await deleteMedia(String(body?.id));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return fail(error);
  }
}
