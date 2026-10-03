"use client";

import { useState } from "react";
import SocialPanel from "./SocialPanel";

type Options = { season: string; weeks: number[] }[];

type Recap = {
  switch: { text: string; available: boolean };
  blind: { text: string; available: boolean };
  hasMatchLog: { switch: boolean; blind: boolean };
};

type Saved = { body: string; published: boolean; updated_at: string };

const inputClass =
  "mt-2 block w-full rounded-lg border border-white/10 bg-brand-bg px-4 py-3 font-sans text-sm text-brand-text";

// Between the Switch recap and the Blind Draw recap in the combined post.
const POST_DIVIDER = "\n\n━━━━━━━━━━━━\n\n";

function formatWhen(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

export default function RecapTab({ password }: { password: string }) {
  const [options, setOptions] = useState<Options>([]);
  const [season, setSeason] = useState("");
  const [week, setWeek] = useState("");
  const [switchNotes, setSwitchNotes] = useState("");
  const [blindNotes, setBlindNotes] = useState("");
  const [switchLink, setSwitchLink] = useState("");
  const [blindLink, setBlindLink] = useState("");
  const [postText, setPostText] = useState("");
  const [recap, setRecap] = useState<Recap | null>(null);
  const [saved, setSaved] = useState<Saved | null>(null);
  const [copied, setCopied] = useState(false);
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

  // Switching week shows whatever was saved for it (or an empty editor).
  async function loadSaved(forSeason: string, forWeek: string) {
    setRecap(null);
    setPostText("");
    setSaved(null);
    if (!forSeason || !forWeek) return;
    try {
      const data = await post({ action: "load", season: forSeason, week: Number(forWeek) });
      if (data.saved) {
        setSaved(data.saved);
        setPostText(data.saved.body);
      }
    } catch (err: any) {
      setMessage(err.message);
    }
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
      const s = opts[0].season;
      const w = String(opts[0].weeks[0]);
      setSeason(s);
      setWeek(w);
      await loadSaved(s, w);
    } catch (err: any) {
      setMessage(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function generate() {
    setMessage("");
    if (!season || !week) return setMessage("Pick a season and week first.");
    if (postText.trim() && !window.confirm("This replaces the text in the box with a fresh draft. Continue?")) return;
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
      // One post: the Switch recap first (it's played first), then the Blind Draw recap.
      setPostText([data.switch.text, data.blind.text].filter(Boolean).join(POST_DIVIDER));
      if (!data.switch.available && !data.blind.available) setMessage("Nothing imported for that week yet.");
    } catch (err: any) {
      setMessage(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function save(published: boolean) {
    setMessage("");
    setBusy(true);
    try {
      const data = await post({ action: "save", season, week: Number(week), body: postText, published });
      setSaved(data.saved);
      setMessage(
        published
          ? `Published. Week ${week}'s recap now shows on the site under Weeks.`
          : saved?.published
          ? `Unpublished. Week ${week}'s recap is saved as a draft and no longer shows on the site.`
          : "Draft saved. It isn't visible on the site."
      );
    } catch (err: any) {
      setMessage(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(postText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  const weeks = options.find((o) => o.season === season)?.weeks || [];
  const hasText = postText.trim().length > 0;
  const unsaved = hasText && (!saved || saved.body !== postText);

  const hints = recap
    ? [
        ...(recap.switch.available && !recap.hasMatchLog.switch ? ["No Switch match log was uploaded, so the Switch games section is left out."] : []),
        ...(recap.blind.available && !recap.hasMatchLog.blind ? ["No Blind Draw match log was uploaded, so the bracket story is left out."] : []),
      ]
    : [];

  return (
    <div>
      <p className="font-sans text-sm text-brand-textSecondary">
        Builds one recap post from a week&apos;s imported Switch and Blind Draw results. Only placings, records, game scores and
        event-wide totals go in. Individual player stats never do. Edit it, save it, and publish it to show on the site under Weeks.
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
                  const s = e.target.value;
                  const w = String(options.find((o) => o.season === s)?.weeks[0] ?? "");
                  setSeason(s);
                  setWeek(w);
                  setMessage("");
                  loadSaved(s, w);
                }}
              >
                {options.map((o) => (
                  <option key={o.season}>{o.season}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="field-label">Week</span>
              <select
                className={inputClass}
                value={week}
                onChange={(e) => {
                  setWeek(e.target.value);
                  setMessage("");
                  loadSaved(season, e.target.value);
                }}
              >
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
            {busy ? "Working..." : hasText ? "Generate a fresh draft" : "Generate recap"}
          </button>
        </>
      )}

      {message && (
        <div className="mt-5 whitespace-pre-wrap rounded-lg border border-white/10 bg-brand-bg p-4 font-sans text-sm text-brand-textSecondary">
          {message}
        </div>
      )}

      {hasText && (
        <div className="mt-6 rounded-xl border border-white/10 bg-brand-bg p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h4 className="font-display text-base uppercase text-brand-orange">Week {week} recap</h4>
              <p className="mt-1 font-sans text-xs text-brand-textMuted">
                {unsaved
                  ? saved
                    ? "Unsaved changes."
                    : "Not saved yet."
                  : saved?.published
                  ? `Published on the site. Saved ${formatWhen(saved.updated_at)}.`
                  : `Saved as a draft (not on the site). ${saved ? formatWhen(saved.updated_at) : ""}`}
              </p>
            </div>
            <button type="button" onClick={copy} className="btn-primary">
              {copied ? "Copied!" : "Copy text"}
            </button>
          </div>

          {hints.map((hint) => (
            <p key={hint} className="mt-2 font-sans text-xs text-brand-textMuted">
              {hint}
            </p>
          ))}

          <textarea
            value={postText}
            onChange={(e) => setPostText(e.target.value)}
            rows={Math.min(60, Math.max(10, postText.split("\n").length + 1))}
            className="mt-3 block w-full rounded-lg border border-white/10 bg-brand-panel px-4 py-3 font-sans text-sm leading-relaxed text-brand-text"
          />
          <p className="mt-1 font-sans text-xs text-brand-textFaint">{postText.length} characters. Edit freely.</p>

          <div className="mt-4 flex flex-wrap gap-3">
            <button type="button" onClick={() => save(true)} disabled={busy} className="btn-primary disabled:opacity-60">
              {saved?.published ? "Update published recap" : "Publish to website"}
            </button>
            <button
              type="button"
              onClick={() => save(false)}
              disabled={busy || (!unsaved && !saved?.published)}
              className="rounded-full border border-white/20 px-5 py-2 font-sans text-xs font-bold uppercase text-brand-text hover:bg-white/10 disabled:opacity-40"
            >
              {saved?.published ? "Unpublish (keep as draft)" : "Save draft"}
            </button>
          </div>
        </div>
      )}

      {hasText && season && week && <SocialPanel password={password} season={season} week={week} text={postText} />}
    </div>
  );
}
