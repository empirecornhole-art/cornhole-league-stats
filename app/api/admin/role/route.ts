import { NextResponse } from "next/server";
import { roleFor } from "../../../../lib/adminAuth";

export const runtime = "nodejs";

// Tells the admin page which tabs to show for a password. This is only for the
// display. Every action is checked again on the server with its own permission.
export async function POST(req: Request) {
  try {
    const body = await req.json();
    return NextResponse.json({ ok: true, role: roleFor(body?.password) });
  } catch {
    return NextResponse.json({ ok: true, role: null });
  }
}
