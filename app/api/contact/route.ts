import { NextResponse } from "next/server";
import { markContactEmailSent, saveContactMessage, sendContactEmail, validateContact } from "../../../lib/contact";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  // Honeypot: a field real people never see. Bots that fill every input get
  // a normal-looking success so they don't retry, but nothing is saved.
  if (String(body?.website ?? "").trim()) {
    return NextResponse.json({ ok: true });
  }

  const { input, errors } = validateContact(body);
  if (Object.keys(errors).length) {
    return NextResponse.json({ ok: false, errors }, { status: 400 });
  }

  // Save first: once it's in the database the message can't be lost, even if
  // the email step fails.
  let id: string;
  try {
    id = await saveContactMessage(input);
  } catch (error: any) {
    console.error("Saving contact message failed:", error?.message || error);
    return NextResponse.json(
      { ok: false, error: "We couldn't send your message. Please try again, or email us directly." },
      { status: 500 }
    );
  }

  const emailed = await sendContactEmail(input);
  if (emailed) {
    await markContactEmailSent(id).catch((error) => console.error("Marking email_sent failed:", error?.message || error));
  }

  return NextResponse.json({ ok: true });
}
