"use client";

import { useState } from "react";
import { upload } from "@vercel/blob/client";

type Options = { season: string; weeks: number[] }[];

type Item = {
  id: string;
  season_name: string;
  week_number: number;
  kind: "photo" | "video";
  url: string;
  caption: string;
};

const inputClass =
  "mt-2 block w-full rounded-lg border border-white/10 bg-brand-bg px-4 py-3 font-sans text-sm text-brand-text";

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function CaptionInput({ item, password }: { item: Item; password: string }) {
  const [value, setValue] = useState(item.caption);
  const [saved, setSaved] = useState(true);

  async function save() {
    if (saved) return;
    await fetch("/api/admin/media", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-admin-password": password },
      body: JSON.stringify({ id: item.id, caption: value }),
    });
    setSaved(true);
  }

  return (
    <input
      className="mt-2 block w-full rounded-lg border border-white/10 bg-brand-panel px-3 py-2 font-sans text-xs text-brand-text"
      value={value}
      placeholder="Caption (optional)"
      onChange={(e) => {
        setValue(e.target.value);
        setSaved(false);
      }}
      onBlur={save}
    />
  );
}

export default function MediaTab({ password }: { password: string }) {
  const [options, setOptions] = useState<Options>([]);
  const [season, setSeason] = useState("");
  const [week, setWeek] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [configured, setConfigured] = useState(true);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<Record<string, number>>({});

  async function api(path: string, init: RequestInit = {}) {
    const res = await fetch(path, {
      ...init,
      headers: { "Content-Type": "application/json", "x-admin-password": password, ...(init.headers || {}) },
    });
    const data = await res.json().catch(() => ({ ok: false, error: "Unexpected response from server." }));
    if (!res.ok || data.ok === false) throw new Error(data.error || "Request failed.");
    return data;
  }

  async function loadItems(forSeason = season, forWeek = week) {
    if (!forSeason || !forWeek) return;
    const data = await api(`/api/admin/media?season=${encodeURIComponent(forSeason)}&week=${forWeek}`);
    setConfigured(!!data.configured);
    setItems(data.items || []);
  }

  async function loadWeeks() {
    setMessage("");
    if (!password) return setMessage("Enter the admin password.");
    setBusy(true);
    try {
      const res = await fetch("/api/admin/recap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, action: "options" }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Request failed.");
      const opts: Options = data.options || [];
      setOptions(opts);
      if (!opts.length) return setMessage("No weeks found yet. Import a week first.");
      const s = opts[0].season;
      const w = String(opts[0].weeks[0]);
      setSeason(s);
      setWeek(w);
      await loadItems(s, w);
    } catch (err: any) {
      setMessage(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    setMessage("");
    setBusy(true);
    const uploaded: { url: string; pathname: string; kind: "photo" | "video" }[] = [];
    const failed: string[] = [];

    for (const file of Array.from(files)) {
      if (!/^(image|video)\//.test(file.type)) {
        failed.push(`${file.name} (not a photo or video)`);
        continue;
      }
      try {
        const blob = await upload(`media/${slug(season)}/week-${week}/${file.name}`, file, {
          access: "public",
          handleUploadUrl: "/api/admin/media/upload",
          clientPayload: JSON.stringify({ password }),
          multipart: file.size > 20 * 1024 * 1024,
          onUploadProgress: ({ percentage }) => setProgress((p) => ({ ...p, [file.name]: Math.round(percentage) })),
        });
        uploaded.push({ url: blob.url, pathname: blob.pathname, kind: file.type.startsWith("video/") ? "video" : "photo" });
      } catch (err: any) {
        failed.push(`${file.name} (${err.message})`);
      }
    }

    try {
      if (uploaded.length) await api("/api/admin/media", { method: "POST", body: JSON.stringify({ season, week: Number(week), items: uploaded }) });
      await loadItems();
      setMessage(
        [uploaded.length ? `Added ${uploaded.length} file${uploaded.length === 1 ? "" : "s"} to Week ${week}.` : "", failed.length ? `Couldn't upload: ${failed.join("; ")}` : ""]
          .filter(Boolean)
          .join("\n")
      );
    } catch (err: any) {
      setMessage(err.message);
    } finally {
      setProgress({});
      setBusy(false);
    }
  }

  async function remove(item: Item) {
    if (!window.confirm("Delete this file from the site? This can't be undone.")) return;
    try {
      await api("/api/admin/media", { method: "DELETE", body: JSON.stringify({ id: item.id }) });
      setItems((current) => current.filter((i) => i.id !== item.id));
    } catch (err: any) {
      setMessage(err.message);
    }
  }

  const weeks = options.find((o) => o.season === season)?.weeks || [];

  return (
    <div>
      <p className="font-sans text-sm text-brand-textSecondary">
        Add photos and videos to a week. They show up on the site&apos;s Photos tab and can be reused for Facebook and Instagram posts later.
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
                onChange={async (e) => {
                  const s = e.target.value;
                  const w = String(options.find((o) => o.season === s)?.weeks[0] ?? "");
                  setSeason(s);
                  setWeek(w);
                  try {
                    await loadItems(s, w);
                  } catch (err: any) {
                    setMessage(err.message);
                  }
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
                onChange={async (e) => {
                  setWeek(e.target.value);
                  try {
                    await loadItems(season, e.target.value);
                  } catch (err: any) {
                    setMessage(err.message);
                  }
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

          {!configured ? (
            <div className="mt-5 rounded-lg border border-brand-orange/40 bg-brand-bg p-4 font-sans text-sm text-brand-textSecondary">
              <div className="font-bold text-brand-orange">One-time setup needed for uploads</div>
              <ol className="mt-2 list-decimal space-y-1 pl-5">
                <li>In Vercel, open Storage and create a new <b>Blob</b> store set to <b>Public</b>.</li>
                <li>Connect it to this project and set the environment variable prefix to <b>MEDIA</b>.</li>
                <li>Redeploy, then come back here.</li>
              </ol>
            </div>
          ) : (
            <label className="mt-5 block">
              <span className="field-label">Add photos or videos to Week {week}</span>
              <input
                type="file"
                multiple
                accept="image/*,video/*"
                disabled={busy}
                onChange={(e) => {
                  handleFiles(e.target.files);
                  e.target.value = "";
                }}
                className="mt-2 block w-full rounded-lg border border-white/10 bg-brand-bg px-4 py-3 font-sans text-sm text-brand-text file:mr-4 file:rounded-full file:border-0 file:bg-brand-orange file:px-4 file:py-2 file:font-sans file:text-xs file:font-bold file:uppercase file:text-brand-bg"
              />
            </label>
          )}

          {Object.keys(progress).length > 0 && (
            <div className="mt-3 space-y-1 font-sans text-xs text-brand-textSecondary">
              {Object.entries(progress).map(([name, pct]) => (
                <div key={name}>
                  {name}: {pct}%
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {message && (
        <div className="mt-5 whitespace-pre-wrap rounded-lg border border-white/10 bg-brand-bg p-4 font-sans text-sm text-brand-textSecondary">
          {message}
        </div>
      )}

      {options.length > 0 && (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
          {items.length === 0 && <p className="col-span-full font-sans text-sm text-brand-textMuted">Nothing uploaded for this week yet.</p>}
          {items.map((item) => (
            <div key={item.id} className="rounded-xl border border-white/10 bg-brand-bg p-2">
              {item.kind === "video" ? (
                <video src={item.url} controls preload="metadata" className="aspect-square w-full rounded-lg bg-black object-cover" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.url} alt={item.caption || "Week photo"} loading="lazy" className="aspect-square w-full rounded-lg object-cover" />
              )}
              <CaptionInput item={item} password={password} />
              <button type="button" onClick={() => remove(item)} className="mt-2 font-sans text-xs font-bold uppercase text-red-400 hover:text-red-300">
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
