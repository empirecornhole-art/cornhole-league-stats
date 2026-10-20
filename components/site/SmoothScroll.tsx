"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import Lenis from "lenis";
import "lenis/dist/lenis.css";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

// Page-wide inertial scrolling (Lenis) driven by GSAP's ticker so ScrollTrigger
// effects stay in lockstep with the scroll position. Mouse wheels and
// trackpads get the glide; phones keep native touch scrolling (syncTouch off),
// which is what iOS/Android users expect. Skipped entirely under reduced
// motion and on the admin console, where plain scrolling is the right feel.
export default function SmoothScroll() {
  const pathname = usePathname();
  const enabled = !pathname.startsWith("/admin");

  useEffect(() => {
    if (!enabled) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduced.matches) return;

    const lenis = new Lenis({
      lerp: 0.1,
      wheelMultiplier: 1,
      // Wide tables and the player picker scroll on their own; don't hijack them.
      allowNestedScroll: true,
      anchors: true,
    });
    lenis.on("scroll", ScrollTrigger.update);
    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    // The mobile nav locks body scroll by setting overflow: hidden; mirror
    // that onto Lenis so the page doesn't drift behind the open menu.
    const body = new MutationObserver(() => {
      if (document.body.style.overflow === "hidden") lenis.stop();
      else lenis.start();
    });
    body.observe(document.body, { attributes: true, attributeFilter: ["style"] });

    return () => {
      body.disconnect();
      gsap.ticker.remove(tick);
      lenis.destroy();
    };
  }, [enabled]);

  // A new page starts at the top, and ScrollTrigger needs to re-measure.
  useEffect(() => {
    ScrollTrigger.refresh();
  }, [pathname]);

  return null;
}
