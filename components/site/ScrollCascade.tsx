"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

// Anything marked data-cascade rises into place as it scrolls into view, one
// after another: elements that arrive together (a row of tiles, a heading and
// the card under it) are staggered in page order, so the page "pours in"
// instead of everything fading at once. Each item plays once.
//
// Before JS runs, an inline script in the layout sets html[data-cascade="on"],
// which hides marked elements in CSS so nothing flashes visible and then
// jumps. If this component never starts, that script turns it back off.

export type CascadeConfig = {
  distance: number; // px each item travels up
  duration: number; // seconds per item
  stagger: number; // seconds between items that arrive together
  ease: string;
  start: number; // % of viewport height at which an item counts as "arrived" (top edge)
  scale: number; // starting scale (1 = none)
};

export const CASCADE_DEFAULTS: CascadeConfig = {
  distance: 60,
  duration: 1.1,
  stagger: 0.15,
  ease: "power3.out",
  start: 90,
  scale: 0.98,
};

export const CASCADE_STORAGE_KEY = "ec-cascade-config";
export const CASCADE_EVENT = "ec-cascade-change";

function readConfig(): CascadeConfig {
  // The tuner (development only) saves its sliders here; production always uses the defaults.
  if (process.env.NODE_ENV === "development") {
    try {
      const raw = window.localStorage.getItem(CASCADE_STORAGE_KEY);
      if (raw) return { ...CASCADE_DEFAULTS, ...JSON.parse(raw) };
    } catch {
      /* fall through to defaults */
    }
  }
  return CASCADE_DEFAULTS;
}

export default function ScrollCascade() {
  const pathname = usePathname();

  useEffect(() => {
    const root = document.documentElement;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      root.dataset.cascade = "off";
      return;
    }

    let triggers: ScrollTrigger[] = [];
    let frame = 0;

    const teardown = () => {
      triggers.forEach((t) => t.kill());
      triggers = [];
      gsap.killTweensOf("[data-cascade]");
      gsap.set("[data-cascade]", { clearProps: "opacity,visibility,transform" });
    };

    const setup = () => {
      teardown();
      const cfg = readConfig();
      const items = gsap.utils.toArray<HTMLElement>("[data-cascade]");
      if (!items.length) return;

      gsap.set(items, { autoAlpha: 0, y: cfg.distance, scale: cfg.scale });
      // Inline styles hide them now; the pre-hydration CSS gate can step aside.
      root.dataset.cascade = "live";

      triggers = ScrollTrigger.batch(items, {
        start: `top ${cfg.start}%`,
        once: true,
        interval: 0.1,
        batchMax: 8,
        onEnter: (batch) =>
          gsap.to(batch, {
            autoAlpha: 1,
            y: 0,
            scale: 1,
            duration: cfg.duration,
            ease: cfg.ease,
            stagger: cfg.stagger,
            overwrite: true,
            // Hand transform/opacity back to CSS so hover effects keep working.
            clearProps: "opacity,visibility,transform",
          }),
      }) as unknown as ScrollTrigger[];
      ScrollTrigger.refresh();
    };

    // After the new page's markup is in place.
    frame = requestAnimationFrame(() => requestAnimationFrame(setup));

    const onChange = () => {
      window.scrollTo({ top: 0 });
      requestAnimationFrame(setup);
    };
    window.addEventListener(CASCADE_EVENT, onChange);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener(CASCADE_EVENT, onChange);
      teardown();
    };
  }, [pathname]);

  return null;
}
