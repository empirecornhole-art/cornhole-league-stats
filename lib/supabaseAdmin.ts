import { createClient } from "@supabase/supabase-js";

function cleanEnv(value: string | undefined) {
  return String(value || "")
    .trim()
    .replace(/^["']|["']$/g, "");
}

export function getSupabaseAdmin() {
  const url = cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const key = cleanEnv(process.env.SUPABASE_SERVICE_ROLE_KEY);

  if (!url) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  }

  if (!url.startsWith("https://") || !url.endsWith(".supabase.co")) {
    throw new Error(
      `Invalid NEXT_PUBLIC_SUPABASE_URL. It must look like https://your-project.supabase.co. Current value starts with: ${url.slice(
        0,
        40
      )}`
    );
  }

  if (!key) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
