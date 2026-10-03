import { NextResponse } from "next/server";
import { importScoreholioWeeks, parseScoreholioUpload } from "../../../../lib/scoreholioImport";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const formData = await req.formData();

    if (formData.get("password") !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ error: "Invalid password" }, { status: 401 });
    }

    const season = String(formData.get("season") || "");
    const files = formData.getAll("files").filter((f): f is File => typeof f !== "string");
    if (!files.length) return NextResponse.json({ error: "No files uploaded" }, { status: 400 });

    const uploads = await Promise.all(files.map(async (f) => ({ name: f.name, buffer: await f.arrayBuffer() })));
    const parsed = parseScoreholioUpload(uploads);

    const result = await importScoreholioWeeks(season, parsed);
    return NextResponse.json({ ok: true, ...result });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "Import failed" }, { status: 500 });
  }
}
