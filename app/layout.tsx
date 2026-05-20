import "./globals.css";

export const metadata = {
  title: "League Stats",
  description: "Cornhole League Stats"
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
