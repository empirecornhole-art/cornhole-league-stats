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

// Picker value for "I don't know the week / it isn't imported yet".
const UNASSIGNED = "__unassigned";

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

function Thumb({ item }: { item: Item }) {
  return item.kind === "video" ? (
    <video src={`${item.url}#t=0.1`} preload="metadata" muted playsInline className="aspect-square w-full rounded-lg bg-black object-cover" />
  ) : (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={item.url} alt={item.caption || "Uploaded photo"} loading="lazy" className="aspect-square w-full rounded-lg object-cover" />
  );
}

export default function MediaTab({ password, role = "admin" }: { password: string; role?: "admin" | "uploader" }) {
  const isAdmin = role === "admin";

  const [options, setOptions] = useState<Options>([]);
  const [season, setSeason] = useState("");
  const [week, setWeek] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [pool, setPool] = useState<Item[]>([]);
  const [poolSelected, setPoolSelected] = useState<Set<string>>(new Set());
  const [assignSeason, setAssignSeason] = useState("");
  const [assignWeek, setAssignWeek] = useState("");
  const [sessionUploads, setSessionUploads] = useState<{ name: string; where: string }[]>([]);
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
    if (!isAdmin || !forSeason || !forWeek || forWeek === UNASSIGNED) {
      setItems([]);
      return;
    }
    const data = await api(`/api/admin/media?season=${encodeURIComponent(forSeason)}&week=${forWeek}`);
    setConfigured(!!data.configured);
    setItems(data.items || []);
  }

  async function loadPool() {
    if (!isAdmin) return;
    const data = await api("/api/admin/media?unassigned=1");
    setPool(data.items || []);
    setPoolSelected(new Set());
  }

  async function loadWeeks() {
    setMessage("");
    if (!password) return setMessage("Enter the password.");
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

      if (!opts.length) {
        // Nothing imported yet: files can still go in, waiting to be paired.
        setSeason("");
        setWeek(UNASSIGNED);
      } else {
        const s = opts[0].season;
        const w = String(opts[0].weeks[0]);
        setSeason(s);
        setWeek(w);
        setAssignSeason(s);
        setAssignWeek(w);
        await loadItems(s, w);
      }
      await loadPool();
      if (!isAdmin) {
        // Uploaders can't read the library, so just confirm the storage is set up.
        const check = await fetch("/api/admin/media", { headers: { "x-admin-password": password } });
        const checkData = await check.json();
        if (check.ok && checkData.ok) setConfigured(!!checkData.configured);
      }
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
    const toUnassigned = week === UNASSIGNED || !season || !week;
    const uploaded: { url: string; pathname: string; kind: "photo" | "video"; name: string }[] = [];
    const failed: string[] = [];

    for (const file of Array.from(files)) {
      if (!/^(image|video)\//.test(file.type)) {
        failed.push(`${file.name} (not a photo or video)`);
        continue;
      }
      try {
        const folder = toUnassigned ? "media/unassigned" : `media/${slug(season)}/week-${week}`;
        const blob = await upload(`${folder}/${file.name}`, file, {
          access: "public",
          handleUploadUrl: "/api/admin/media/upload",
          clientPayload: JSON.stringify({ password }),
          multipart: file.size > 20 * 1024 * 1024,
          onUploadProgress: ({ percentage }) => setProgress((p) => ({ ...p, [file.name]: Math.round(percentage) })),
        });
        uploaded.push({ url: blob.url, pathname: blob.pathname, kind: file.type.startsWith("video/") ? "video" : "photo", name: file.name });
      } catch (err: any) {
        failed.push(`${file.name} (${err.message})`);
      }
    }

    try {
      let lines: string[] = [];
      if (uploaded.length) {
        const saved = await api("/api/admin/media", {
          method: "POST",
          body: JSON.stringify({
            season: toUnassigned ? "" : season,
            week: toUnassigned ? 0 : Number(week),
            items: uploaded.map(({ url, pathname, kind }) => ({ url, pathname, kind })),
          }),
        });
        const where = saved.unassigned ? "waiting for an admin to pair them to a week" : `added to Week ${week} (live now)`;
        lines.push(`${uploaded.length} file${uploaded.length === 1 ? "" : "s"} uploaded: ${where}.`);
        setSessionUploads((current) => [...uploaded.map((u) => ({ name: u.name, where: saved.unassigned ? "Waiting for pairing" : `Week ${week}` })), ...current]);
      }
      if (failed.length) lines.push(`Couldn't upload: ${failed.join("; ")}`);
      setMessage(lines.join("\n"));
      await loadItems();
      await loadPool();
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

  function togglePool(id: string) {
    setPoolSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function assignSelected() {
    if (!poolSelected.size || !assignSeason || !assignWeek) return;
    setBusy(true);
    setMessage("");
    try {
      await api("/api/admin/media", {
        method: "PATCH",
        body: JSON.stringify({ action: "assign", ids: Array.from(poolSelected), season: assignSeason, week: Number(assignWeek) }),
      });
      setMessage(`Paired ${poolSelected.size} file${poolSelected.size === 1 ? "" : "s"} to ${assignSeason} Week ${assignWeek}. They're live on the site now.`);
      await loadPool();
      await loadItems();
    } catch (err: any) {
      setMessage(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function deleteSelected() {
    if (!poolSelected.size) return;
    if (!window.confirm(`Delete ${poolSelected.size} selected file${poolSelected.size === 1 ? "" : "s"}? This can't be undone.`)) return;
    setBusy(true);
    setMessage("");
    try {
      for (const id of Array.from(poolSelected)) {
        await api("/api/admin/media", { method: "DELETE", body: JSON.stringify({ id }) });
      }
      await loadPool();
    } catch (err: any) {
      setMessage(err.message);
    } finally {
      setBusy(false);
    }
  }

  const weeks = options.find((o) => o.season === season)?.weeks || [];
  const assignWeeks = options.find((o) => o.season === assignSeason)?.weeks || [];
  const loaded = options.length > 0 || week === UNASSIGNED;

  return (
    <div>
      <p className="font-sans text-sm text-brand-textSecondary">
        {isAdmin
          ? "Add photos and videos to a week. They show up on the site's Photos tab and under that week's recap, and can be reused for Facebook and Instagram posts."
          : "Add photos and videos from league night. If the week's results are already on the site, your photos go live right away. If not, choose \"Not sure\" and an admin will pair them to the right week."}
      </p>

      <button type="button" onClick={loadWeeks} disabled={busy} className="btn-primary mt-5 disabled:opacity-60">
        {loaded ? "Reload weeks" : "Load weeks"}
      </button>

      {loaded && (
        <>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="field-label">Season</span>
              <select
                className={inputClass}
                value={week === UNASSIGNED ? UNASSIGNED : season}
                disabled={week === UNASSIGNED && !options.length}
                onChange={async (e) => {
                  const s = e.target.value;
                  if (s === UNASSIGNED) {
                    setWeek(UNASSIGNED);
                    return;
                  }
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
                <option value={UNASSIGNED}>Not sure / week not on the site yet</option>
              </select>
            </label>
            {week !== UNASSIGNED && (
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
            )}
          </div>

          {week === UNASSIGNED && (
            <p className="mt-3 font-sans text-xs text-brand-textMuted">
              These files will be saved but kept hidden from the public until an admin pairs them to a week.
            </p>
          )}

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
              <span className="field-label">
                {week === UNASSIGNED ? "Add photos or videos (waiting to be paired)" : `Add photos or videos to Week ${week}`}
              </span>
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

      {/* Uploaders can't browse the library; they just see what they've added on this visit. */}
      {!isAdmin && sessionUploads.length > 0 && (
        <div className="mt-6">
          <h4 className="font-display text-base uppercase text-brand-orange">Added this visit</h4>
          <ul className="mt-2 space-y-1 font-sans text-xs text-brand-textSecondary">
            {sessionUploads.map((u, i) => (
              <li key={`${u.name}-${i}`}>
                {u.name} &middot; {u.where}
              </li>
            ))}
          </ul>
        </div>
      )}

      {isAdmin && loaded && pool.length > 0 && (
        <div className="mt-8 rounded-xl border border-brand-orange/40 bg-brand-bg p-4">
          <h4 className="font-display text-base uppercase text-brand-orange">
            Unassigned ({pool.length}) &mdash; waiting to be paired
          </h4>
          <p className="mt-1 font-sans text-xs text-brand-textMuted">
            These were uploaded before their week was on the site. They stay hidden until you pair them to a week.
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-3 font-sans text-xs">
            <button type="button" className="underline" onClick={() => setPoolSelected(new Set(pool.map((p) => p.id)))}>
              Select all
            </button>
            <button type="button" className="underline" onClick={() => setPoolSelected(new Set())}>
              Clear
            </button>
            <span className="text-brand-textFaint">{poolSelected.size} selected</span>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
            {pool.map((item) => {
              const on = poolSelected.has(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => togglePool(item.id)}
                  aria-pressed={on}
                  aria-label={`${item.kind === "video" ? "Video" : "Photo"} ${on ? "selected" : "not selected"}`}
                  className={`relative overflow-hidden rounded-lg border-2 ${on ? "border-brand-orange" : "border-white/10"}`}
                >
                  <Thumb item={item} />
                  {item.kind === "video" && (
                    <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1.5 py-0.5 text-[0.625rem] font-bold uppercase text-white">Video</span>
                  )}
                  <span
                    className={`absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${on ? "bg-brand-orange text-brand-bg" : "bg-black/60 text-white"}`}
                    aria-hidden="true"
                  >
                    {on ? "✓" : ""}
                  </span>
                </button>
              );
            })}
          </div>

          {options.length > 0 ? (
            <div className="mt-4 flex flex-wrap items-end gap-3">
              <label className="block">
                <span className="field-label">Pair to season</span>
                <select
                  className="mt-1 block rounded-lg border border-white/10 bg-brand-panel px-3 py-2 font-sans text-sm text-brand-text"
                  value={assignSeason}
                  onChange={(e) => {
                    setAssignSeason(e.target.value);
                    setAssignWeek(String(options.find((o) => o.season === e.target.value)?.weeks[0] ?? ""));
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
                  className="mt-1 block rounded-lg border border-white/10 bg-brand-panel px-3 py-2 font-sans text-sm text-brand-text"
                  value={assignWeek}
                  onChange={(e) => setAssignWeek(e.target.value)}
                >
                  {assignWeeks.map((w) => (
                    <option key={w} value={w}>
                      Week {w}
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" onClick={assignSelected} disabled={busy || !poolSelected.size} className="btn-primary disabled:opacity-50">
                Pair selected to Week {assignWeek}
              </button>
              <button
                type="button"
                onClick={deleteSelected}
                disabled={busy || !poolSelected.size}
                className="font-sans text-xs font-bold uppercase text-red-400 hover:text-red-300 disabled:opacity-40"
              >
                Delete selected
              </button>
            </div>
          ) : (
            <p className="mt-4 font-sans text-xs text-brand-textMuted">No weeks are imported yet. Import a week, then come back to pair these.</p>
          )}
        </div>
      )}

      {isAdmin && loaded && week !== UNASSIGNED && (
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
