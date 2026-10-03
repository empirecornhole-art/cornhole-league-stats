import { getSupabaseAdmin } from "./supabaseAdmin";
import { getSiteSettings } from "./settings";

export type ContactInput = {
  name: string;
  email: string;
  interest: string;
  message: string;
};

export type ContactMessageRow = ContactInput & {
  id: string;
  created_at: string;
  email_sent: boolean;
};

export const CONTACT_LIMITS = {
  name: 120,
  email: 254,
  interest: 200,
  message: 5000,
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Trims and validates a submission. Returns field errors keyed by field name. */
export function validateContact(body: any): { input: ContactInput; errors: Record<string, string> } {
  const input: ContactInput = {
    name: String(body?.name ?? "").trim(),
    email: String(body?.email ?? "").trim(),
    interest: String(body?.interest ?? "").trim(),
    message: String(body?.message ?? "").trim(),
  };

  const errors: Record<string, string> = {};
  if (!input.name) errors.name = "Please add your name.";
  if (!input.email) errors.email = "Please add your email so we can reply.";
  else if (!EMAIL_PATTERN.test(input.email)) errors.email = "That email doesn't look right.";
  if (!input.message) errors.message = "Please write a message.";

  for (const [field, max] of Object.entries(CONTACT_LIMITS)) {
    if (input[field as keyof ContactInput].length > max) errors[field] = `Please keep this under ${max} characters.`;
  }

  return { input, errors };
}

export async function saveContactMessage(input: ContactInput): Promise<string> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("contact_messages").insert(input).select("id").single();
  if (error) throw error;
  return data.id as string;
}

export async function markContactEmailSent(id: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("contact_messages").update({ email_sent: true }).eq("id", id);
  if (error) throw error;
}

export async function getContactMessages(limit = 200): Promise<ContactMessageRow[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("contact_messages")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data || []) as ContactMessageRow[];
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Emails the league about a new submission via Resend's HTTP API. Reply-To is
 * the sender, so hitting Reply in your inbox answers them directly.
 *
 * Env:
 *   RESEND_API_KEY        required to send at all
 *   CONTACT_NOTIFY_EMAIL  where to send (falls back to Site Settings contact email)
 *   CONTACT_FROM_EMAIL    verified sender (defaults to Resend's onboarding sender,
 *                         which can only deliver to the Resend account owner)
 *
 * Returns false (never throws) when email isn't configured or fails, so a
 * mail problem never loses a message that's already saved.
 */
export async function sendContactEmail(input: ContactInput): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("Contact email skipped: RESEND_API_KEY is not set");
    return false;
  }

  try {
    const settings = await getSiteSettings();
    const to = process.env.CONTACT_NOTIFY_EMAIL || settings.contact_email;
    if (!to) {
      console.warn("Contact email skipped: no CONTACT_NOTIFY_EMAIL or Site Settings contact email");
      return false;
    }

    const from = process.env.CONTACT_FROM_EMAIL || "Empire Cornhole Website <onboarding@resend.dev>";
    const rows: [string, string][] = [
      ["Name", input.name],
      ["Email", input.email],
      ["Interested in", input.interest || "—"],
    ];

    const html = `
      <div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5;color:#111">
        <h2 style="margin:0 0 12px">New message from the website</h2>
        <table style="border-collapse:collapse;margin-bottom:16px">
          ${rows
            .map(
              ([k, v]) =>
                `<tr><td style="padding:4px 16px 4px 0;color:#666">${k}</td><td style="padding:4px 0"><strong>${escapeHtml(v)}</strong></td></tr>`
            )
            .join("")}
        </table>
        <div style="white-space:pre-wrap;padding:12px 16px;background:#f5f5f0;border-radius:8px">${escapeHtml(input.message)}</div>
        <p style="color:#666;font-size:13px;margin-top:16px">Reply to this email to answer ${escapeHtml(input.name)} directly.</p>
      </div>`;

    const text = `New message from the website\n\n${rows.map(([k, v]) => `${k}: ${v}`).join("\n")}\n\n${input.message}`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [to],
        reply_to: input.email,
        subject: `Website message from ${input.name}${input.interest ? ` — ${input.interest}` : ""}`.slice(0, 200),
        html,
        text,
      }),
    });

    if (!res.ok) {
      console.error("Contact email failed:", res.status, (await res.text().catch(() => "")).slice(0, 500));
      return false;
    }
    return true;
  } catch (error: any) {
    console.error("Contact email failed:", error?.message || error);
    return false;
  }
}
