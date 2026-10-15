"use client";

import { useState } from "react";
import { thumbUrl } from "../../lib/imageUrl";

/**
 * A photo that fills its parent, loads a small optimized version, shows a
 * soft placeholder while it loads, and falls back to the original file if
 * the optimized one can't be made.
 */
export default function PhotoThumb({
  src,
  alt,
  width = 384,
  className = "",
}: {
  src: string;
  alt: string;
  width?: 256 | 384 | 640 | 1080 | 1920;
  className?: string;
}) {
  const [loaded, setLoaded] = useState(false);
  const [useOriginal, setUseOriginal] = useState(false);

  return (
    <div className={`relative h-full w-full ${loaded ? "" : "animate-pulse bg-white/5"}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={useOriginal ? src : thumbUrl(src, width)}
        alt={alt}
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => {
          if (!useOriginal) setUseOriginal(true);
        }}
        className={`h-full w-full object-cover transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"} ${className}`}
      />
    </div>
  );
}
