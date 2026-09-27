"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/leagues", label: "League" },
  { href: "/events", label: "Events" },
  { href: "/contact", label: "Contact" },
];

export default function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-brand-bg/95 backdrop-blur supports-[backdrop-filter]:bg-brand-bg/85">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 md:px-6">
        <Link href="/" className="flex items-center gap-3" onClick={() => setOpen(false)}>
          <Image
            src="/ec-logo.png"
            alt="Empire Cornhole League"
            width={64}
            height={64}
            className="h-11 w-11 rounded-lg object-contain md:h-14 md:w-14"
            priority
          />
          <span className="flex flex-col leading-none">
            <span className="font-display text-lg uppercase tracking-wide text-brand-text md:text-xl">
              Empire Cornhole
            </span>
            <span className="font-sans text-[11px] font-bold uppercase tracking-widest text-brand-orange">
              League
            </span>
          </span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`font-sans text-sm font-bold uppercase tracking-wide transition duration-200 ${
                  active
                    ? "text-brand-orange underline decoration-2 underline-offset-8"
                    : "text-brand-textSecondary hover:text-brand-text"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden md:block">
          <Link href="/contact" className="btn-nav-cta">
            Join the League
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle navigation menu"
          aria-expanded={open}
          className="flex h-10 w-10 flex-col items-center justify-center gap-1.5 rounded-md border border-white/15 md:hidden"
        >
          <span
            className={`block h-0.5 w-5 bg-brand-text transition duration-200 ${open ? "translate-y-2 rotate-45" : ""}`}
          />
          <span className={`block h-0.5 w-5 bg-brand-text transition duration-200 ${open ? "opacity-0" : ""}`} />
          <span
            className={`block h-0.5 w-5 bg-brand-text transition duration-200 ${open ? "-translate-y-2 -rotate-45" : ""}`}
          />
        </button>
      </div>

      {open && (
        <div className="border-t border-white/10 bg-brand-bg px-4 pb-6 pt-2 md:hidden">
          <nav className="flex flex-col gap-1">
            {NAV_LINKS.map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className={`rounded-lg px-3 py-3 font-sans text-base font-bold uppercase tracking-wide transition duration-200 ${
                    active ? "bg-white/5 text-brand-orange" : "text-brand-textSecondary hover:bg-white/5 hover:text-brand-text"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
          <Link href="/contact" onClick={() => setOpen(false)} className="btn-nav-cta mt-4 w-full">
            Join the League
          </Link>
        </div>
      )}
    </header>
  );
}
