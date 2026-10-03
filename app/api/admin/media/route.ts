import { NextResponse } from "next/server";
import { roleFor, type Role } from "../../../../lib/adminAuth";
import {
  addMedia,
  assignMedia,
  deleteMedia,
  listMedia,
  mediaConfigured,
  updateCaption,
  weekHasData,
} from "../../../../lib/media";

export const runtime = "nodejs";

/**
 * Photos & video management.
 *   uploader  may list this week's files and add new ones (no delete, no edits, no pairing)
 *   admin     everything, including pairing the Unassigned pool to a week
 */
function roleOf(req: Request): Role {
  return roleFor(req.headers.get("x-admin-password"));
}

const deny = () => NextResponse.json({ ok: false, error: "Invalid password" }, { status: 401 });
const forbidden = () => NextResponse.json({ ok: false, error: "That needs the admin password." }, { status: 403 });
const fail = (error: any) => NextResponse.json({ ok: false, error: error?.message || "Request failed" }, { status: 500 });

export async function GET(req: Request) {
  const role = roleOf(req);
  if (!role) return deny();
  try {
    const url = new URL(req.url);
    const season = url.searchParams.get("season") || undefined;
    const week = Number(url.searchParams.get("week")) || undefined;
    const wantUnassigned = url.searchParams.get("unassigned") === "1";

    // The Unassigned pool is admin-only. Uploaders just see their uploads confirmed.
    if (wantUnassigned && role !== "admin") return forbidden();
    const items = await listMedia(wantUnassigned ? { unassigned: true } : { season, week });
    return NextResponse.json({ ok: true, role, configured: mediaConfigured(), items });
  } catch (error) {
    return fail(error);
  }
}

// Record files after the browser has finished uploading them.
export async function POST(req: Request) {
  const role = roleOf(req);
  if (!role) return deny();
  try {
    const body = await req.json();
    const items = Array.isArray(body?.items) ? body.items : [];
    if (!items.length) {
      return NextResponse.json({ ok: false, error: "No files to save." }, { status: 400 });
    }

    let season = String(body?.season || "").trim();
    let week = Number(body?.week) || 0;

    // Anything without a real, imported week goes to the Unassigned pool until an admin pairs it.
    // For uploaders this is enforced here, whatever the browser sent.
    if (role !== "admin" || !season || !week) {
      if (!(await weekHasData(season, week))) {
        season = "";
        week = 0;
      }
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
    return NextResponse.json({ ok: true, items: saved, unassigned: !season || !week });
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(req: Request) {
  const role = roleOf(req);
  if (!role) return deny();
  if (role !== "admin") return forbidden();
  try {
    const body = await req.json();

    // Pair files to a week: { action: "assign", ids: [...], season, week }
    if (body?.action === "assign") {
      const ids: string[] = Array.isArray(body.ids) ? body.ids.map(String) : [];
      const season = String(body.season || "").trim();
      const week = Number(body.week);
      if (!ids.length || !season || !week) {
        return NextResponse.json({ ok: false, error: "Pick files, a season and a week." }, { status: 400 });
      }
      await assignMedia(ids, season, week);
      return NextResponse.json({ ok: true });
    }

    await updateCaption(String(body?.id), String(body?.caption ?? ""));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(req: Request) {
  const role = roleOf(req);
  if (!role) return deny();
  if (role !== "admin") return forbidden();
  try {
    const body = await req.json();
    await deleteMedia(String(body?.id));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return fail(error);
  }
}
