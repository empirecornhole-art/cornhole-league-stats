"use client";

import { useId, useState } from "react";

/**
 * Shows the start of a long recap with a soft fade, and a button to read the
 * rest in place. The full text is always in the page (just visually clipped),
 * so nothing is lost for search engines or screen readers.
 */
export default function ExpandableRecap({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();

  return (
    <div>
      <div
        id={id}
        className={`relative overflow-hidden transition-[max-height] duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] ${open ? "max-h-[200rem]" : "max-h-[24rem]"}`}
      >
        {children}
        {!open && (
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-brand-panel to-transparent"
            aria-hidden="true"
          />
        )}
      </div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={id}
        className="btn-secondary mt-4"
      >
        {open ? "Show less" : "Read the full recap"}
      </button>
    </div>
  );
}
