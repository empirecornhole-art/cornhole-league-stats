"use client";

import { useEffect, useRef, useState } from "react";

/**
 * "Save photo" for the photo viewer.
 *
 * On a phone it hands the actual picture file to the share sheet, which lists
 * Instagram (to post it), Messages, and "Save Image" to the camera roll. On a
 * computer it downloads the file. If the file can't be fetched for some reason,
 * it opens the photo in a new tab so it can still be saved by hand.
 */

type Props = {
  /** The original photo file (a public storage URL). */
  url: string;
  /** File name without the extension, e.g. "empire-cornhole-fall-26-week-2-photo-3". */
  fileName: string;
  title?: string;
  tone?: "default" | "overlay";
  className?: string;
};

function DownloadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 17v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2" />
      <path d="M8 11l4 4 4-4" />
      <path d="M12 4v11" />
    </svg>
  );
}

export default function SavePhotoButton({ url, fileName, title = "Photo from Empire Cornhole League", tone = "default", className = "btn-secondary" }: Props) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  function say(message: string) {
    setNote(message);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setNote(""), 6000);
  }

  async function onSave() {
    if (busy) return;
    setBusy(true);
    setNote("");
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const ext = blob.type.includes("png") ? "png" : blob.type.includes("webp") ? "webp" : "jpg";
      const file = new File([blob], `${fileName}.${ext}`, { type: blob.type || "image/jpeg" });

      const touch = window.matchMedia("(pointer: coarse)").matches;
      if (touch && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title });
        return;
      }

      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(href), 10000);
      say("Photo saved to your downloads.");
    } catch (error) {
      if ((error as Error)?.name === "AbortError") return; // closed the share sheet
      window.open(url, "_blank", "noopener,noreferrer");
      say("Opened the photo in a new tab. Press and hold it (or right-click) to save.");
    } finally {
      setBusy(false);
    }
  }

  const buttonClass =
    tone === "overlay" ? "rounded-full bg-white/10 px-4 py-2 text-sm font-bold uppercase text-white hover:bg-white/20" : className;

  return (
    <div className="relative inline-block" onClick={(e) => e.stopPropagation()}>
      <button type="button" onClick={onSave} disabled={busy} className={`inline-flex items-center justify-center gap-2 disabled:opacity-60 ${buttonClass}`}>
        <DownloadIcon />
        {busy ? "Getting photo..." : "Save photo"}
      </button>
      <p
        role="status"
        aria-live="polite"
        className={note ? "absolute left-0 top-full z-40 mt-2 w-60 rounded-xl border border-white/10 bg-brand-raised p-3 font-sans text-xs normal-case text-brand-textSecondary shadow-2xl" : "sr-only"}
      >
        {note}
      </p>
    </div>
  );
}
