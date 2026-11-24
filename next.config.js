/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // 40 is used by the faint hero watermark; 75 is Next's default for everything else.
    qualities: [40, 75],
    // Week photos live in the public Vercel Blob store; allow the image optimizer to resize them.
    remotePatterns: [{ protocol: "https", hostname: "*.public.blob.vercel-storage.com" }],
  },
};
module.exports = nextConfig;
