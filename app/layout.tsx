import "./globals.css";
import { Analytics } from "@vercel/analytics/next";

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
    <html lang="en">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
