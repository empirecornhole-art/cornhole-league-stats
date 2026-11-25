import Link from "next/link";
import Image from "next/image";
import { getSiteSettings } from "../../lib/settings";

const EXPLORE_LINKS = [
  { href: "/", label: "Home" },
  { href: "/leagues", label: "League" },
  { href: "/recaps", label: "Recaps" },
  { href: "/events", label: "Events" },
  { href: "/contact", label: "Contact" },
];

export default async function Footer() {
  const settings = await getSiteSettings();
  const facebookUrl = settings.facebook_url || "https://facebook.com/empirecornhole";
  const instagramUrl = settings.instagram_url || "https://instagram.com/empirecornhole";

  return (
    <footer className="border-t border-white/10 bg-brand-panel">
      <div className="mx-auto max-w-7xl px-4 py-14 md:px-6">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-4">
          <div className="md:col-span-1">
            <div className="flex items-center gap-3">
              <Image
                src="/ec-logo.png"
                alt="Empire Cornhole League"
                width={48}
                height={48}
                className="h-10 w-10 rounded-lg object-contain"
              />
              <span className="flex flex-col leading-none">
                <span className="font-display text-base uppercase tracking-[0.01em] text-brand-text">
                  Empire Cornhole
                </span>
                <span className="font-sans text-xs font-bold uppercase tracking-[0.12em] text-brand-orange">
                  League
                </span>
              </span>
            </div>
            <p className="mt-4 font-sans text-sm text-brand-textSecondary">
              Connect &middot; compete. Standings, events, and recaps for Empire Cornhole League.
            </p>
          </div>

          <div>
            <h2 className="eyebrow">Explore</h2>
            <ul className="mt-4 space-y-2">
              {EXPLORE_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="font-sans text-sm text-brand-textSecondary transition duration-200 hover:text-brand-orange"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="eyebrow">Connect</h2>
            <ul className="mt-4 space-y-2">
              <li>
                <a
                  href={facebookUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-sans text-sm text-brand-textSecondary transition duration-200 hover:text-brand-orange"
                >
                  Facebook
                </a>
              </li>
              <li>
                <a
                  href={instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-sans text-sm text-brand-textSecondary transition duration-200 hover:text-brand-orange"
                >
                  Instagram
                </a>
              </li>
              <li>
                <Link href="/leagues?tab=store" className="font-sans text-sm text-brand-textSecondary transition duration-200 hover:text-brand-orange">
                  Store
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h2 className="eyebrow">
              Get Season Updates
            </h2>
            <p className="mt-4 font-sans text-sm text-brand-textSecondary">
              Week recaps and event reminders are posted on Facebook and Instagram. Want them by email? Send us a note and
              we&apos;ll add you.
            </p>
            <Link href="/contact" className="btn-nav-cta mt-4 inline-flex whitespace-nowrap">
              Get on the list
            </Link>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-center gap-4 border-t border-white/10 pt-8 font-sans text-xs text-brand-textFaint md:flex-row">
          <span>&copy; 2026 Empire Cornhole League. All rights reserved.</span>
        </div>
      </div>
    </footer>
  );
}
