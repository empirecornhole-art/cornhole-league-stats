"use client";

import { useRef } from "react";
import { gsap } from "gsap";
import { SplitText } from "gsap/SplitText";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(SplitText, useGSAP);

// Headline that reveals word by word, each word rising out of a mask. Children
// stay real markup (the orange <span> keeps its color) and the text is in the
// server HTML for SEO and screen readers; SplitText only re-wraps it on the
// client. [data-split-pending] hides it for the beat before JS runs, and a CSS
// failsafe (globals.css) shows it anyway if the script never arrives.
export default function SplitHeading({
  children,
  className = "",
  delay = 0.15,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLHeadingElement>(null);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduced) {
        el.removeAttribute("data-split-pending");
        return;
      }
      SplitText.create(el, {
        type: "words,chars",
        mask: "words",
        autoSplit: true,
        onSplit(self) {
          el.removeAttribute("data-split-pending");
          return gsap.from(self.chars, {
            yPercent: 110,
            rotate: 6,
            duration: 0.9,
            ease: "expo.out",
            stagger: 0.025,
            delay,
          });
        },
      });
    },
    { scope: ref }
  );

  return (
    <h1 ref={ref} data-split-pending className={className}>
      {children}
    </h1>
  );
}
