import { NextResponse } from 'next/server';
import { parseWorkbook } from "../../../lib/parseWorkbook";
import { saveLeagueData } from "../../../lib/blob";

export async function POST(req: Request) {
  const form = await req.formData();
  const password = String(form.get('password') ?? '');
  const file = form.get('file');

  if (!process.env.ADMIN_PASSWORD || password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Invalid admin password.' }, { status: 401 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No workbook uploaded.' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const parsed = await parseWorkbook(buffer.buffer as ArrayBuffer);
  
  await saveLeagueData(parsed);
  return NextResponse.json({ ok: true, summary: { seasons: parsed.seasons.length, players: parsed.players.length, lastUpdated: parsed.lastUpdated } });
}
