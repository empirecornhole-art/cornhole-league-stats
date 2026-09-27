import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import localFont from "next/font/local";
import Nav from "../components/site/Nav";
import Footer from "../components/site/Footer";

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

export const metadata = {
  title: "League Stats",
  description: "Empire Cornhole League Stats",
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
    <html lang="en" className={`${anton.variable} ${barlow.variable}`}>
      <body className="font-sans">
        <Nav />
        {children}
        <Footer />
        <Analytics />
      </body>
    </html>
  );
}
