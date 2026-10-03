"use client";

import { useState } from "react";

type Options = { season: string; weeks: number[] }[];

type Recap = {
  switch: { text: string; available: boolean };
  blind: { text: string; available: boolean };
  hasMatchLog: { switch: boolean; blind: boolean };
};

const inputClass =
  "mt-2 block w-full rounded-lg border border-white/10 bg-brand-bg px-4 py-3 font-sans text-sm text-brand-text";

function RecapCard({
  title,
  text,
  onChange,
  missingLog,
}: {
  title: string;
  text: string;
  onChange: (value: string) => void;
  missingLog: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="mt-6 rounded-xl border border-white/10 bg-brand-bg p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h4 className="font-display text-base uppercase text-brand-orange">{title}</h4>
        <button type="button" onClick={copy} className="btn-primary">
          {copied ? "Copied!" : "Copy text"}
        </button>
      </div>
      {missingLog && (
        <p className="mt-2 font-sans text-xs text-brand-textMuted">
          No match log was uploaded for this event, so the game-by-game story is left out.
        </p>
      )}
      <textarea
        value={text}
        onChange={(e) => onChange(e.target.value)}
        rows={Math.min(36, Math.max(10, text.split("\n").length + 1))}
        className="mt-3 block w-full rounded-lg border border-white/10 bg-brand-panel px-4 py-3 font-sans text-sm leading-relaxed text-brand-text"
      />
      <p className="mt-1 font-sans text-xs text-brand-textFaint">{text.length} characters. Edit freely before copying.</p>
    </div>
  );
}

export default function RecapTab({ password }: { password: string }) {
  const [options, setOptions] = useState<Options>([]);
  const [season, setSeason] = useState("");
  const [week, setWeek] = useState("");
  const [switchNotes, setSwitchNotes] = useState("");
  const [blindNotes, setBlindNotes] = useState("");
  const [switchLink, setSwitchLink] = useState("");
  const [blindLink, setBlindLink] = useState("");
  const [switchText, setSwitchText] = useState("");
  const [blindText, setBlindText] = useState("");
  const [recap, setRecap] = useState<Recap | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function post(body: Record<string, any>) {
    const res = await fetch("/api/admin/recap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password, ...body }),
    });
    const data = await res.json().catch(() => ({ ok: false, error: "Unexpected response from server." }));
    if (!res.ok || !data.ok) throw new Error(data.error || "Request failed.");
    return data;
  }

  async function loadWeeks() {
    setMessage("");
    if (!password) return setMessage("Enter the admin password.");
    setBusy(true);
    try {
      const data = await post({ action: "options" });
      const opts: Options = data.options || [];
      setOptions(opts);
      if (!opts.length) return setMessage("No weeks found yet. Import a week first.");
      setSeason(opts[0].season);
      setWeek(String(opts[0].weeks[0]));
    } catch (err: any) {
      setMessage(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function generate() {
    setMessage("");
    if (!season || !week) return setMessage("Pick a season and week first.");
    setBusy(true);
    try {
      const data: Recap = await post({
        action: "build",
        season,
        week: Number(week),
        switchNotes,
        blindNotes,
        switchLink,
        blindLink,
      });
      setRecap(data);
      setSwitchText(data.switch.text);
      setBlindText(data.blind.text);
      if (!data.switch.available && !data.blind.available) setMessage("Nothing imported for that week yet.");
    } catch (err: any) {
      setMessage(err.message);
    } finally {
      setBusy(false);
    }
  }

  const weeks = options.find((o) => o.season === season)?.weeks || [];

  return (
    <div>
      <p className="font-sans text-sm text-brand-textSecondary">
        Builds the Switch and Blind Draw recap posts from a week&apos;s imported results. Only placings, records, game scores and
        event-wide totals go in. Individual player stats never do. Edit the text, then copy it into Facebook.
      </p>

      <button type="button" onClick={loadWeeks} disabled={busy} className="btn-primary mt-5 disabled:opacity-60">
        {options.length ? "Reload weeks" : "Load weeks"}
      </button>

      {options.length > 0 && (
        <>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="field-label">Season</span>
              <select
                className={inputClass}
                value={season}
                onChange={(e) => {
                  setSeason(e.target.value);
                  setWeek(String(options.find((o) => o.season === e.target.value)?.weeks[0] ?? ""));
                }}
              >
                {options.map((o) => (
                  <option key={o.season}>{o.season}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="field-label">Week</span>
              <select className={inputClass} value={week} onChange={(e) => setWeek(e.target.value)}>
                {weeks.map((w) => (
                  <option key={w} value={w}>
                    Week {w}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="field-label">Switch highlight (optional)</span>
              <textarea
                className={inputClass}
                rows={2}
                value={switchNotes}
                onChange={(e) => setSwitchNotes(e.target.value)}
                placeholder="One or two sentences added under the intro"
              />
            </label>
            <label className="block">
              <span className="field-label">Blind Draw highlight (optional)</span>
              <textarea
                className={inputClass}
                rows={2}
                value={blindNotes}
                onChange={(e) => setBlindNotes(e.target.value)}
                placeholder="One or two sentences added under the intro"
              />
            </label>
            <label className="block">
              <span className="field-label">Switch standings link (optional)</span>
              <input className={inputClass} value={switchLink} onChange={(e) => setSwitchLink(e.target.value)} placeholder="https://..." />
            </label>
            <label className="block">
              <span className="field-label">Blind Draw bracket link (optional)</span>
              <input className={inputClass} value={blindLink} onChange={(e) => setBlindLink(e.target.value)} placeholder="https://..." />
            </label>
          </div>

          <button type="button" onClick={generate} disabled={busy} className="btn-primary mt-5 disabled:opacity-60">
            {busy ? "Working..." : recap ? "Regenerate (replaces edits)" : "Generate recaps"}
          </button>
        </>
      )}

      {message && (
        <div className="mt-5 whitespace-pre-wrap rounded-lg border border-white/10 bg-brand-bg p-4 font-sans text-sm text-brand-textSecondary">
          {message}
        </div>
      )}

      {recap?.switch.available && (
        <RecapCard title="Switch recap" text={switchText} onChange={setSwitchText} missingLog={!recap.hasMatchLog.switch} />
      )}
      {recap?.blind.available && (
        <RecapCard title="Blind Draw recap" text={blindText} onChange={setBlindText} missingLog={!recap.hasMatchLog.blind} />
      )}

      {recap && (
        <p className="mt-6 font-sans text-xs text-brand-textFaint">
          Posting straight to Facebook and Instagram isn&apos;t connected yet. For now, copy each recap and attach the week&apos;s photos from
          the Photos &amp; Video tab.
        </p>
      )}
    </div>
  );
}
