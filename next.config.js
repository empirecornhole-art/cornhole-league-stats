/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Week photos live in the public Vercel Blob store; allow the image optimizer to resize them.
    remotePatterns: [{ protocol: "https", hostname: "*.public.blob.vercel-storage.com" }],
  },
};
module.exports = nextConfig;
