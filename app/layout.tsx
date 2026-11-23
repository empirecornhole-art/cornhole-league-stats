import "./globals.css";
import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import JsonLd from "../components/site/JsonLd";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL, organizationJsonLd } from "../lib/site";
import localFont from "next/font/local";
import Nav from "../components/site/Nav";
import Footer from "../components/site/Footer";
import SmoothScroll from "../components/site/SmoothScroll";
import ScrollCascade from "../components/site/ScrollCascade";
import CascadeTuner from "../components/site/CascadeTuner";

const anton = localFont({
  src: "./fonts/anton-400.woff2",
  weight: "400",
  variable: "--font-anton",
  display: "swap",
});

const barlow = localFont({
  src: [
    { path: "./fonts/barlow-semi-condensed-500.woff2", weight: "500" },
    { path: "./fonts/barlow-semi-condensed-600.woff2", weight: "600" },
    { path: "./fonts/barlow-semi-condensed-700.woff2", weight: "700" },
  ],
  variable: "--font-barlow",
  display: "swap",
});

// viewport-fit=cover exposes env(safe-area-inset-*) so the league tab bar can
// clear the iPhone home indicator.
export const viewport = {
  viewportFit: "cover",
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Empire Cornhole League | Weekly Cornhole in New Berlin, NY",
    template: "%s | Empire Cornhole League",
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  manifest: "/manifest.json",
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "en_US",
    title: "Empire Cornhole League | Weekly Cornhole in New Berlin, NY",
    description: SITE_DESCRIPTION,
    images: [{ url: "/og", width: 1200, height: 630, alt: "Empire Cornhole League: weekly cornhole in New Berlin, NY" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Empire Cornhole League | Weekly Cornhole in New Berlin, NY",
    description: SITE_DESCRIPTION,
    images: ["/og"],
  },
  icons: {
    icon: "/icon.png",
    apple: "/icon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${anton.variable} ${barlow.variable}`} suppressHydrationWarning>
      <head>
        {/* Sets html[data-cascade="on"] before first paint so scroll-in items start hidden (see ScrollCascade). */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var d=document.documentElement;if(!matchMedia('(prefers-reduced-motion: reduce)').matches){d.dataset.cascade='on';setTimeout(function(){if(d.dataset.cascade==='on')d.dataset.cascade='off'},4000)}}catch(e){}})()",
          }}
        />
      </head>
      <body className="font-sans">
        <SmoothScroll />
        <ScrollCascade />
        <CascadeTuner />
        <Nav />
        {children}
        <Footer />
        <JsonLd data={organizationJsonLd()} />
        <Analytics />
      </body>
    </html>
  );
}
