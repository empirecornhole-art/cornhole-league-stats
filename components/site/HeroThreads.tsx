"use client";

import Threads from "../reactbits/Threads/Threads";

// Flowing ember threads behind a page hero. Fades out toward the edges so
// the title and the section below stay clean; pointer-transparent.
export default function HeroThreads({ className = "" }: { className?: string }) {
  return (
    <div
      className={`pointer-events-none absolute inset-0 opacity-80 ${className}`}
      style={{
        WebkitMaskImage: "radial-gradient(ellipse at center, black 35%, transparent 85%)",
        maskImage: "radial-gradient(ellipse at center, black 35%, transparent 85%)",
      }}
      aria-hidden
    >
      <Threads color="#f04a22" accentColor="#f2c14e" enableMouseInteraction={false} />
    </div>
  );
}
