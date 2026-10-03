import { NextResponse } from "next/server";
import { getContactMessages } from "../../../../lib/contact";

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
    const messages = await getContactMessages();
    return NextResponse.json({ ok: true, messages });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to load messages" },
      { status: 500 }
    );
  }
}
