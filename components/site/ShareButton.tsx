"use client";

import { useEffect, useRef, useState } from "react";
import { SITE_URL } from "../../lib/site";

/**
 * A Share button for any page on the site.
 *
 * Phones and tablets open the device's own share sheet, which lists Facebook,
 * Instagram, Messages and whatever else is installed. On a computer it opens a
 * small menu: Facebook, X, email and copy link. Instagram has no web "share"
 * link (only its mobile app can share to it), so on a computer the Instagram
 * entry copies the link and says where to paste it.
 *
 * The link shared is always the canonical address (SITE_URL + path), so the
 * preview card people see comes from that page's own metadata.
 */

type Props = {
  /** Path on this site, like "/recaps/fall-26-week-2". */
  path: string;
  title: string;
  /** One line shown alongside the link in the share sheet, email and X. */
  text?: string;
  label?: string;
  className?: string;
  /** Which edge the desktop menu lines up with. */
  align?: "left" | "right";
  /** Style used inside dark overlays like the photo viewer. */
  tone?: "default" | "overlay";
};

const itemClass =
  "block w-full rounded-xl px-3 py-2.5 text-left font-sans text-sm font-bold text-brand-text transition-colors duration-150 hover:bg-white/10 focus-visible:bg-white/10 focus-visible:outline-none";

function ShareIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" />
      <path d="M16 6l-4-4-4 4" />
      <path d="M12 2v13" />
    </svg>
  );
}

export default function ShareButton({
  path,
  title,
  text = "",
  label = "Share",
  className = "btn-secondary",
  align = "left",
  tone = "default",
}: Props) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const url = new URL(path, SITE_URL).toString();

  // Close on outside click and Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        rootRef.current?.querySelector<HTMLButtonElement>("button[aria-haspopup]")?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function copy(message: string) {
    try {
      await navigator.clipboard.writeText(url);
      setNote(message);
    } catch {
      setNote("Couldn't copy automatically. Copy the address from your browser's address bar.");
    }
  }

  async function onTrigger() {
    const touch = typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
    if (touch && typeof navigator.share === "function") {
      try {
        await navigator.share({ title, text, url });
      } catch {
        /* closed without sharing */
      }
      return;
    }
    setNote("");
    setOpen((o) => !o);
  }

  const encoded = encodeURIComponent(url);
  const triggerClass = tone === "overlay" ? "rounded-full bg-white/10 px-4 py-2 text-sm font-bold uppercase text-white hover:bg-white/20" : className;

  return (
    <div ref={rootRef} className="relative inline-block" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={onTrigger}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`inline-flex items-center justify-center gap-2 ${triggerClass}`}
      >
        <ShareIcon />
        {label}
        <span className="sr-only"> this page</span>
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Share this page"
          className={`absolute z-40 mt-2 w-64 rounded-2xl border border-white/10 bg-brand-raised p-2 shadow-2xl ${align === "right" ? "right-0" : "left-0"}`}
        >
          <a
            role="menuitem"
            href={`https://www.facebook.com/sharer/sharer.php?u=${encoded}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className={itemClass}
          >
            Share on Facebook
          </a>
          <button type="button" role="menuitem" onClick={() => copy("Link copied. Instagram has no web share button, so paste it into a story, post or message.")} className={itemClass}>
            Instagram (copy link)
          </button>
          <a
            role="menuitem"
            href={`https://twitter.com/intent/tweet?url=${encoded}&text=${encodeURIComponent(title)}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className={itemClass}
          >
            Share on X
          </a>
          <a
            role="menuitem"
            href={`mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(`${text ? `${text}\n\n` : ""}${url}`)}`}
            onClick={() => setOpen(false)}
            className={itemClass}
          >
            Email
          </a>
          <button type="button" role="menuitem" onClick={() => copy("Link copied.")} className={itemClass}>
            Copy link
          </button>
          <p aria-live="polite" className={`px-3 font-sans text-xs text-brand-textSecondary ${note ? "py-2" : "sr-only"}`}>
            {note}
          </p>
        </div>
      )}
    </div>
  );
}
