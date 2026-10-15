/**
 * Smaller, cached versions of uploaded photos for grids and the viewer.
 *
 * Phone photos are often 4000+ pixels wide and several MB; showing them in a
 * 224px tile means downloading the whole file. Photos in the public Blob store
 * are served through Next's image optimizer instead (resized and compressed
 * once, then cached). Anything else is returned unchanged. Widths must be one
 * of Next's configured sizes, and the default quality (75) is the only one
 * allowed.
 */
export function thumbUrl(url: string, width: 256 | 384 | 640 | 1080 | 1920 = 384): string {
  try {
    if (!/\.public\.blob\.vercel-storage\.com$/.test(new URL(url).hostname)) return url;
  } catch {
    return url;
  }
  return `/_next/image?url=${encodeURIComponent(url)}&w=${width}&q=75`;
}
