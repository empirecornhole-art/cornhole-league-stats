"use client";

import { useEffect, useState } from "react";
import { CASCADE_DEFAULTS, CASCADE_EVENT, CASCADE_STORAGE_KEY, type CascadeConfig } from "./ScrollCascade";

// Development-only control panel for the scroll cascade: drag a slider and the
// page replays from the top with the new numbers. "Copy values" puts the
// current settings on the clipboard so they can be sent back as the final look.
// Renders nothing in production builds.

const EASES = ["power2.out", "power3.out", "power4.out", "expo.out", "back.out(1.4)", "elastic.out(1, 0.6)"];

const SLIDERS: { key: keyof CascadeConfig; label: string; min: number; max: number; step: number }[] = [
  { key: "distance", label: "Rise distance (px)", min: 0, max: 160, step: 4 },
  { key: "duration", label: "Duration (s)", min: 0.2, max: 2.5, step: 0.05 },
  { key: "stagger", label: "Delay between items (s)", min: 0, max: 0.5, step: 0.01 },
  { key: "start", label: "Trigger point (% down screen)", min: 60, max: 100, step: 1 },
  { key: "scale", label: "Starting scale", min: 0.8, max: 1, step: 0.01 },
];

export default function CascadeTuner() {
  const [open, setOpen] = useState(false);
  const [cfg, setCfg] = useState<CascadeConfig>(CASCADE_DEFAULTS);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(CASCADE_STORAGE_KEY);
      if (raw) setCfg({ ...CASCADE_DEFAULTS, ...JSON.parse(raw) });
    } catch {
      /* defaults */
    }
  }, []);

  if (process.env.NODE_ENV !== "development") return null;

  const update = (patch: Partial<CascadeConfig>) => {
    const next = { ...cfg, ...patch };
    setCfg(next);
    try {
      window.localStorage.setItem(CASCADE_STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* private mode */
    }
    window.dispatchEvent(new Event(CASCADE_EVENT));
  };

  return (
    <div className="fixed bottom-4 right-4 z-[60] font-sans text-sm text-brand-text">
      {open ? (
        <div className="w-72 rounded-2xl bg-brand-raised p-4 shadow-float">
          <div className="mb-3 flex items-center justify-between">
            <strong className="font-display text-lg uppercase">Scroll motion</strong>
            <button onClick={() => setOpen(false)} className="min-h-9 px-2 text-brand-textMuted hover:text-brand-text" aria-label="Close motion panel">
              Close
            </button>
          </div>
          <div className="space-y-3">
            {SLIDERS.map((s) => (
              <label key={s.key} className="block">
                <span className="flex justify-between text-xs font-semibold text-brand-textSecondary">
                  {s.label}
                  <span className="tabular-nums text-brand-text">{cfg[s.key] as number}</span>
                </span>
                <input
                  type="range"
                  min={s.min}
                  max={s.max}
                  step={s.step}
                  value={cfg[s.key] as number}
                  onChange={(e) => update({ [s.key]: Number(e.target.value) } as Partial<CascadeConfig>)}
                  className="mt-1 w-full accent-[#f04a22]"
                />
              </label>
            ))}
            <label className="block">
              <span className="text-xs font-semibold text-brand-textSecondary">Easing</span>
              <select value={cfg.ease} onChange={(e) => update({ ease: e.target.value })} className="field-control mt-1 w-full">
                {EASES.map((e) => (
                  <option key={e}>{e}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="mt-4 flex gap-2">
            <button onClick={() => update({})} className="min-h-10 flex-1 rounded-full bg-brand-orange font-bold text-brand-bg">
              Replay
            </button>
            <button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(JSON.stringify(cfg, null, 2));
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                } catch {
                  window.prompt("Copy these values:", JSON.stringify(cfg));
                }
              }}
              className="min-h-10 flex-1 rounded-full bg-white/10 font-bold hover:bg-white/15"
            >
              {copied ? "Copied" : "Copy values"}
            </button>
            <button onClick={() => { try { window.localStorage.removeItem(CASCADE_STORAGE_KEY); } catch {} setCfg(CASCADE_DEFAULTS); window.dispatchEvent(new Event(CASCADE_EVENT)); }} className="min-h-10 rounded-full bg-white/10 px-3 font-bold hover:bg-white/15">
              Reset
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setOpen(true)} className="min-h-11 rounded-full bg-brand-raised px-4 font-bold shadow-float hover:bg-brand-raisedHover">
          Scroll motion
        </button>
      )}
    </div>
  );
}
