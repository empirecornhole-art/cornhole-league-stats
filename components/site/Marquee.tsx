"use client";

import ScrollVelocity from "../reactbits/ScrollVelocity/ScrollVelocity";

// Two counter-running rows of league slogans. They drift on their own and
// surge with scroll speed, so the band reacts to how fast you move through
// the page. Under reduced motion the component itself stops the drift.
export default function Marquee() {
  const dot = <span className="mx-6 text-brand-orange md:mx-10">&bull;</span>;
  return (
    <div className="overflow-hidden border-y border-white/10 bg-brand-bg py-6 md:py-10" aria-hidden>
      <ScrollVelocity
        texts={[
          <>Connect{dot}Compete{dot}Every bag counts{dot}</>,
          <>Blind draw{dot}Switch nights{dot}Season standings{dot}</>,
        ]}
        velocity={40}
        numCopies={6}
        outlineAlternate
        skewWithVelocity={0.4}
        className="font-display uppercase text-brand-text"
        fontSize="clamp(2.5rem, 7vw, 6rem)"
        fontWeight={400}
        fadeEdges
      />
    </div>
  );
}
