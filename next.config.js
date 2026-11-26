/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // 40 is used by the faint hero watermark; 75 is Next's default for everything else.
    qualities: [40, 75],
    // Week photos live in the public Vercel Blob store; allow the image optimizer to resize them.
    remotePatterns: [{ protocol: "https", hostname: "*.public.blob.vercel-storage.com" }],
  },
  // Links from the league's earlier store-style site (/pages, /collections, /products, /policies, /blogs)
  // still get visits and used to 404. Send each to the closest current page. Permanent, so search engines
  // and old links follow along. Equipment rentals and sales are no longer offered, so that page goes home.
  async redirects() {
    return [
      { source: "/pages/contact", destination: "/contact", permanent: true },
      { source: "/pages/about-us", destination: "/", permanent: true },
      { source: "/pages/equipment-rentals", destination: "/", permanent: true },
      { source: "/collections/:path*", destination: "/leagues?tab=store", permanent: true },
      { source: "/products/:path*", destination: "/leagues?tab=store", permanent: true },
      { source: "/policies/:path*", destination: "/contact", permanent: true },
      { source: "/blogs/:path*", destination: "/recaps", permanent: true },
    ];
  },
};
module.exports = nextConfig;
