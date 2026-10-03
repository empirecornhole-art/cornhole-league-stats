"use client";

import { useEffect, useState } from "react";

type Message = {
  id: string;
  created_at: string;
  name: string;
  email: string;
  interest: string;
  message: string;
  email_sent: boolean;
};

export default function MessagesTab({ password }: { password: string }) {
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [loadedForPassword, setLoadedForPassword] = useState("");

  useEffect(() => {
    if (password && password !== loadedForPassword) {
      load();
      setLoadedForPassword(password);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [password]);

  async function load() {
    if (!password) {
      setError("Enter the admin password.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/messages", { headers: { "x-admin-password": password } });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "Failed to load messages.");
        setMessages(null);
        return;
      }
      setMessages(data.messages || []);
    } catch (err: any) {
      setError(err?.message || "Failed to load messages.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-sans text-sm text-brand-textSecondary">
          Messages sent from the Contact page, newest first. Each one is also emailed to you.
        </p>
        <button type="button" onClick={load} className="btn-secondary" disabled={loading}>
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-white/10 bg-brand-bg p-4 font-sans text-sm text-brand-textSecondary">
          {error}
        </div>
      )}

      <div className="mt-6 flex flex-col gap-3">
        {messages === null && !loading && !error && (
          <p className="font-sans text-sm text-brand-textMuted">Enter the password above, then Refresh to load messages.</p>
        )}
        {messages !== null && messages.length === 0 && (
          <p className="font-sans text-sm text-brand-textMuted">No messages yet.</p>
        )}
        {messages?.map((m) => (
          <article key={m.id} className="rounded-xl border border-white/10 bg-brand-bg p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h4 className="font-sans text-base font-bold text-brand-text">{m.name}</h4>
              <time className="font-sans text-xs text-brand-textMuted" dateTime={m.created_at}>
                {new Date(m.created_at).toLocaleString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </time>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <a href={`mailto:${m.email}`} className="font-sans text-sm text-brand-orange hover:text-brand-orangeHover">
                {m.email}
              </a>
              {m.interest && (
                <span className="rounded-full bg-white/10 px-2.5 py-0.5 font-sans text-xs font-semibold text-brand-textSecondary">
                  {m.interest}
                </span>
              )}
              {!m.email_sent && (
                <span className="rounded-full border border-brand-down/40 px-2.5 py-0.5 font-sans text-xs font-semibold text-brand-down">
                  Email not sent
                </span>
              )}
            </div>
            <p className="mt-3 whitespace-pre-wrap font-sans text-sm text-brand-textSecondary">{m.message}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
