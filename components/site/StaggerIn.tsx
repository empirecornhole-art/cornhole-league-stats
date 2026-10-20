"use client";

import { useRef } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

// Children rise in one after another when the group mounts. League tabs
// remount on every switch, so each tab gets a quick cascade. Capped so a
// 40-row list doesn't take two seconds to finish; skipped under reduced motion.
export default function StaggerIn({
  children,
  className = "",
  each = 0.03,
  max = 0.5,
}: {
  children: React.ReactNode;
  className?: string;
  each?: number;
  max?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const items = ref.current ? Array.from(ref.current.children) : [];
      if (!items.length) return;
      gsap.from(items, {
        y: 14,
        autoAlpha: 0,
        duration: 0.5,
        ease: "power3.out",
        stagger: { each: Math.min(each, max / items.length) },
        clearProps: "transform,opacity,visibility",
      });
    },
    { scope: ref }
  );

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
