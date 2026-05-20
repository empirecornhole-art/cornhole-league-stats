import './globals.css';
import Link from 'next/link';

export const metadata = { title: 'League Stats', description: 'Cornhole League Stats' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen bg-neutral-950 text-neutral-100">
          <header className="sticky top-0 z-10 border-b border-neutral-800 bg-neutral-950/90 backdrop-blur">
            <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
              <Link href="/" className="text-xl font-bold">League Stats</Link>
              <nav className="flex gap-3 text-sm text-neutral-300">
                <Link href="/">Dashboard</Link>
                <Link href="/#players">Players</Link>
                <Link href="/#weeks">Weeks</Link>
                <Link href="/#compare">Compare</Link>
                <Link href="/admin">Admin</Link>
              </nav>
            </div>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
