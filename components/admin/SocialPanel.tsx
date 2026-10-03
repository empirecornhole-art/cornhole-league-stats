"use client";

import { useEffect, useRef, useState } from "react";

const IG_LIMIT = 2200;
const IG_MAX_ITEMS = 10;

type MediaItem = { id: string; kind: "photo" | "video"; url: string; caption: string };
type Platform = "facebook" | "instagram";
type Status = {
  facebook: { configured: boolean; ok: boolean; name?: string; error?: string };
  instagram: { configured: boolean; ok: boolean; name?: string; error?: string };
};
type Prior = { platform: Platform; post_id: string; permalink: string; posted_at: string };

// Lowest-priority sections go first when the recap is too long for Instagram.
const DROP_ORDER = ["📊", "🎯", "🥉 Third", "💪", "🔥 Winner", "🎁"];

/** Trims the recap to Instagram's caption limit by dropping whole sections, least important first. */
export function fitCaption(text: string, limit = IG_LIMIT) {
  // Links aren't clickable in Instagram captions, so they're dropped there.
  let blocks = text.split("\n\n").filter((b) => !/^(Full standings|Full bracket):/i.test(b.trim()));
  const length = () => blocks.join("\n\n").length;
  for (const prefix of DROP_ORDER) {
    if (length() <= limit) break;
    blocks = blocks.filter((b) => !b.trimStart().startsWith(prefix));
  }
  let out = blocks.join("\n\n");
  if (out.length > limit) {
    const cut = out.slice(0, limit - 2);
    out = `${cut.slice(0, Math.max(cut.lastIndexOf("\n"), 0) || cut.length).trimEnd()}\n…`;
  }
  return out;
}

function formatWhen(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

export default function SocialPanel({
  password,
  season,
  week,
  text,
}: {
  password: string;
  season: string;
  week: string;
  text: string;
}) {
  const [status, setStatus] = useState<Status | null>(null);
  const [prior, setPrior] = useState<Prior[]>([]);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [igCaption, setIgCaption] = useState("");
  const igEdited = useRef(false);
  const [busy, setBusy] = useState<Platform | null>(null);
  const [message, setMessage] = useState("");

  async function post(body: Record<string, any>) {
    const res = await fetch("/api/admin/social", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password, season, week: Number(week), ...body }),
    });
    const data = await res.json().catch(() => ({ ok: false, error: "Unexpected response from server." }));
    return { res, data };
  }

  // Connection status, earlier posts and this week's media, whenever the week changes.
  useEffect(() => {
    let cancelled = false;
    setMessage("");
    (async () => {
      try {
        const { data } = await post({ action: "status" });
        if (!cancelled && data.ok) {
          setStatus(data.status);
          setPrior(data.prior || []);
        }
        const res = await fetch(`/api/admin/media?season=${encodeURIComponent(season)}&week=${week}`, {
          headers: { "x-admin-password": password },
        });
        const media = await res.json();
        if (!cancelled && media.ok) {
          setMedia(media.items || []);
          setSelected(new Set((media.items || []).map((m: MediaItem) => m.id)));
        }
      } catch {
        /* the panel just shows less */
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [season, week, password]);

  // Keep the Instagram caption in step with the recap until it's edited by hand.
  useEffect(() => {
    if (!igEdited.current) setIgCaption(fitCaption(text));
  }, [text]);

  const chosen = media.filter((m) => selected.has(m.id));
  const photos = chosen.filter((m) => m.kind === "photo").length;
  const videos = chosen.length - photos;

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function send(platform: Platform, force = false) {
    const label = platform === "facebook" ? "Facebook" : "Instagram";
    setMessage("");

    if (!force) {
      const summary = `${chosen.length ? `${photos} photo${photos === 1 ? "" : "s"}${videos ? ` and ${videos} video${videos === 1 ? "" : "s"}` : ""}` : "no photos or videos"}`;
      if (!window.confirm(`Post Week ${week} to ${label} now with ${summary}? It goes live immediately.`)) return;
    }

    setBusy(platform);
    try {
      const { res, data } = await post({
        action: "post",
        platform,
        text: platform === "instagram" ? igCaption : text,
        mediaIds: chosen.map((m) => m.id),
        force,
      });

      if (res.status === 409 && data.code === "already_posted") {
        const when = data.prior?.[0]?.posted_at ? ` on ${formatWhen(data.prior[0].posted_at)}` : "";
        setBusy(null);
        if (window.confirm(`Week ${week} was already posted to ${label}${when}. Post it again?`)) await send(platform, true);
        return;
      }
      if (!res.ok || !data.ok) throw new Error(data.error || "Posting failed.");

      setMessage(
        `Posted to ${label}.${data.permalink ? ` ${data.permalink}` : ""}${data.recorded === false ? " (Couldn't record it. Run the social_posts SQL so repeat posts are flagged.)" : ""}`
      );
      const refreshed = await post({ action: "status" });
      if (refreshed.data.ok) setPrior(refreshed.data.prior || []);
    } catch (err: any) {
      setMessage(`${label} didn't post: ${err.message}`);
    } finally {
      setBusy(null);
    }
  }

  function StatusLine({ platform }: { platform: Platform }) {
    const label = platform === "facebook" ? "Facebook" : "Instagram";
    const s = status?.[platform];
    if (!s) return <div className="text-brand-textFaint">{label}: checking...</div>;
    if (!s.configured) {
      return (
        <div className="text-brand-textMuted">
          {label}: not set up yet (needs {platform === "facebook" ? "META_PAGE_ID and META_PAGE_ACCESS_TOKEN" : "META_IG_USER_ID and META_PAGE_ACCESS_TOKEN"} in Vercel).
        </div>
      );
    }
    if (!s.ok) return <div className="text-red-400">{label}: connection problem. {s.error}</div>;
    return (
      <div className="text-green-400">
        {label}: connected to {platform === "instagram" ? "@" : ""}
        {s.name}
      </div>
    );
  }

  const ready = (p: Platform) => !!status?.[p].ok;
  const igOver = igCaption.length > IG_LIMIT;
  const igTooMany = chosen.length > IG_MAX_ITEMS;
  const igNoMedia = chosen.length === 0;

  return (
    <div className="mt-6 rounded-xl border border-white/10 bg-brand-bg p-4">
      <h4 className="font-display text-base uppercase text-brand-orange">Post to social media</h4>

      <div className="mt-2 space-y-1 font-sans text-xs">
        <StatusLine platform="facebook" />
        <StatusLine platform="instagram" />
      </div>

      {prior.length > 0 && (
        <ul className="mt-3 space-y-1 font-sans text-xs text-brand-textSecondary">
          {prior.map((p) => (
            <li key={`${p.platform}-${p.post_id}`}>
              Posted to {p.platform === "facebook" ? "Facebook" : "Instagram"} {formatWhen(p.posted_at)}
              {p.permalink && (
                <>
                  {" "}
                  &middot;{" "}
                  <a href={p.permalink} target="_blank" rel="noreferrer" className="underline hover:text-brand-orange">
                    view
                  </a>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="field-label">Photos &amp; videos to include ({chosen.length} of {media.length})</span>
          {media.length > 0 && (
            <span className="space-x-3 font-sans text-xs">
              <button type="button" className="underline" onClick={() => setSelected(new Set(media.map((m) => m.id)))}>
                All
              </button>
              <button type="button" className="underline" onClick={() => setSelected(new Set())}>
                None
              </button>
            </span>
          )}
        </div>
        {media.length === 0 ? (
          <p className="mt-2 font-sans text-xs text-brand-textMuted">
            No photos or videos uploaded for Week {week}. Add some in the Photos &amp; Video tab (Instagram needs at least one).
          </p>
        ) : (
          <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5">
            {media.map((m) => {
              const on = selected.has(m.id);
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => toggle(m.id)}
                  aria-pressed={on}
                  aria-label={`${m.kind === "video" ? "Video" : "Photo"} ${on ? "selected" : "not selected"}`}
                  className={`relative aspect-square overflow-hidden rounded-lg border-2 ${on ? "border-brand-orange" : "border-white/10 opacity-50"}`}
                >
                  {m.kind === "video" ? (
                    <video src={`${m.url}#t=0.1`} preload="metadata" muted playsInline className="h-full w-full object-cover" />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.url} alt="" loading="lazy" className="h-full w-full object-cover" />
                  )}
                  {m.kind === "video" && (
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
        )}
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div>
          <div className="font-sans text-sm font-bold text-brand-textSecondary">Facebook</div>
          <p className="mt-1 font-sans text-xs text-brand-textMuted">
            Posts the full recap above{photos ? ` with ${photos} photo${photos === 1 ? "" : "s"}` : ""}. Videos go up as their own posts
            {photos ? "" : " (the first one carries the recap text)"}.
          </p>
          <button
            type="button"
            onClick={() => send("facebook")}
            disabled={busy !== null || !ready("facebook")}
            className="btn-primary mt-3 disabled:opacity-50"
          >
            {busy === "facebook" ? "Posting..." : "Post to Facebook"}
          </button>
        </div>

        <div>
          <div className="flex items-center justify-between gap-2">
            <span className="font-sans text-sm font-bold text-brand-textSecondary">Instagram caption</span>
            <button
              type="button"
              className="font-sans text-xs underline"
              onClick={() => {
                igEdited.current = false;
                setIgCaption(fitCaption(text));
              }}
            >
              Re-fit from recap
            </button>
          </div>
          <textarea
            value={igCaption}
            onChange={(e) => {
              igEdited.current = true;
              setIgCaption(e.target.value);
            }}
            rows={8}
            className="mt-2 block w-full rounded-lg border border-white/10 bg-brand-panel px-3 py-2 font-sans text-xs leading-relaxed text-brand-text"
          />
          <p className={`mt-1 font-sans text-xs ${igOver ? "text-red-400" : "text-brand-textFaint"}`}>
            {igCaption.length} / {IG_LIMIT} characters. Trimmed from the recap by dropping the stats and extras first.
          </p>
          {igNoMedia && <p className="mt-1 font-sans text-xs text-brand-textMuted">Select at least one photo or video for Instagram.</p>}
          {igTooMany && <p className="mt-1 font-sans text-xs text-red-400">Instagram allows up to {IG_MAX_ITEMS} items. Deselect some.</p>}
          <button
            type="button"
            onClick={() => send("instagram")}
            disabled={busy !== null || !ready("instagram") || igOver || igNoMedia || igTooMany}
            className="btn-primary mt-3 disabled:opacity-50"
          >
            {busy === "instagram" ? "Posting (can take a minute)..." : "Post to Instagram"}
          </button>
        </div>
      </div>

      {message && (
        <div className="mt-4 whitespace-pre-wrap break-words rounded-lg border border-white/10 bg-brand-panel p-3 font-sans text-sm text-brand-textSecondary">
          {message}
        </div>
      )}
    </div>
  );
}
