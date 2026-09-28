import Link from "next/link";
import Image from "next/image";
import { getSiteSettings } from "../../lib/settings";

const EXPLORE_LINKS = [
  { href: "/", label: "Home" },
  { href: "/leagues", label: "League" },
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
                <span className="font-display text-base uppercase tracking-wide text-brand-text">
                  Empire Cornhole
                </span>
                <span className="font-sans text-[10px] font-bold uppercase tracking-widest text-brand-orange">
                  League
                </span>
              </span>
            </div>
            <p className="mt-4 font-sans text-sm text-brand-textSecondary">
              connect &middot; compete &mdash; the home for Empire Cornhole League standings, events, and community.
            </p>
          </div>

          <div>
            <h3 className="font-sans text-xs font-bold uppercase tracking-widest text-brand-textMuted">Explore</h3>
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
            <h3 className="font-sans text-xs font-bold uppercase tracking-widest text-brand-textMuted">Connect</h3>
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
                <a href="#" className="font-sans text-sm text-brand-textSecondary transition duration-200 hover:text-brand-orange">
                  Store
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-sans text-xs font-bold uppercase tracking-widest text-brand-textMuted">
              Get Season Updates
            </h3>
            <p className="mt-4 font-sans text-sm text-brand-textSecondary">
              Standings recaps and event reminders, straight to your inbox.
            </p>
            {/* TODO: wire up newsletter signup */}
            <form className="mt-4 flex items-center gap-2">
              <input
                type="email"
                placeholder="you@email.com"
                className="w-full rounded-full border border-white/10 bg-brand-bg px-4 py-2.5 font-sans text-sm text-brand-text placeholder:text-brand-textFaint focus:border-brand-orange focus:outline-none"
              />
              <button type="button" className="btn-nav-cta whitespace-nowrap">
                Join
              </button>
            </form>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-8 font-sans text-xs text-brand-textFaint md:flex-row">
          <span>&copy; 2026 Empire Cornhole League. All rights reserved.</span>
          <div className="flex items-center gap-6">
            <a href="#" className="transition duration-200 hover:text-brand-textSecondary">
              Privacy
            </a>
            <a href="#" className="transition duration-200 hover:text-brand-textSecondary">
              Terms
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
