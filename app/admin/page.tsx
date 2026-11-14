"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import UploadTab from "../../components/admin/UploadTab";
import EventsTab from "../../components/admin/EventsTab";
import SettingsTab from "../../components/admin/SettingsTab";
import MessagesTab from "../../components/admin/MessagesTab";
import RecapTab from "../../components/admin/RecapTab";
import MediaTab from "../../components/admin/MediaTab";

type Tab = "upload" | "recap" | "media" | "events" | "messages" | "settings";

// The weekly routine runs top to bottom (results in, recap written, photos added),
// so those three are numbered and grouped; the rest is occasional site upkeep.
const GROUPS: { label: string; tabs: { id: Tab; label: string; title: string; step?: number }[] }[] = [
  {
    label: "Each week",
    tabs: [
      { id: "upload", label: "Upload results", title: "Upload season data", step: 1 },
      { id: "recap", label: "Week recap", title: "Week recap", step: 2 },
      { id: "media", label: "Photos & video", title: "Photos & video", step: 3 },
    ],
  },
  {
    label: "Site",
    tabs: [
      { id: "events", label: "Events", title: "Events" },
      { id: "messages", label: "Messages", title: "Messages" },
      { id: "settings", label: "Site settings", title: "Site settings" },
    ],
  },
];
const ALL_TABS = GROUPS.flatMap((g) => g.tabs);

type Role = "admin" | "uploader" | null;

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [tab, setTab] = useState<Tab>("upload");
  const [role, setRole] = useState<Role>(null);
  // The password the last role check answered for, and whether that check reached the server.
  const [checked, setChecked] = useState({ password: "", failed: false });

  // Which tabs to show for this password. Display only: the server checks every action itself.
  useEffect(() => {
    if (!password) {
      setRole(null);
      setChecked({ password: "", failed: false });
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/admin/role", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password }),
        });
        const data = await res.json();
        setRole(data.role || null);
        setChecked({ password, failed: false });
      } catch {
        setRole(null);
        setChecked({ password, failed: true });
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [password]);

  const isUploader = role === "uploader";
  const activeTab: Tab = isUploader ? "media" : tab;
  const active = ALL_TABS.find((t) => t.id === activeTab)!;

  // ---- Signed out: just the password ----
  if (!role) {
    const checking = !!password && checked.password !== password;
    const message = !password
      ? "Enter the password to continue."
      : checking
        ? "Checking..."
        : checked.failed
          ? "Couldn't reach the server. Check your connection."
          : "That password wasn't recognized.";
    return (
      <main className="flex min-h-[calc(100vh-var(--nav-h))] items-center justify-center bg-brand-bg px-4 py-12 text-brand-text">
        <section className="w-full max-w-md rounded-3xl bg-brand-panel p-7 md:p-9">
          <span className="eyebrow">Empire Cornhole League</span>
          <h1 className="mt-3 font-display text-5xl uppercase leading-none">Admin</h1>
          <label className="mt-8 block">
            <span className="field-label">Password</span>
            <input
              type="password"
              autoFocus
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-2 block min-h-12 w-full rounded-xl border border-white/10 bg-brand-bg px-4 py-3 font-sans text-base text-brand-text placeholder:text-brand-textFaint focus:border-brand-orange focus:outline-none"
              placeholder="Enter the password"
            />
          </label>
          <p className={`mt-3 font-sans text-sm ${password && !checking ? "text-brand-down" : "text-brand-textMuted"}`} role="status">
            {message}
          </p>
        </section>
      </main>
    );
  }

  // ---- Signed in ----
  return (
    <main className="min-h-screen bg-brand-bg px-4 pb-16 pt-8 text-brand-text md:px-6 md:pt-12">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="eyebrow">{isUploader ? "Photo uploads" : "Signed in as admin"}</span>
            <h1 className="mt-2 font-display text-5xl uppercase leading-none md:text-6xl">Admin</h1>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/" className="btn-secondary !px-5 !py-2.5 !text-sm">
              View site
            </Link>
            <button type="button" onClick={() => setPassword("")} className="min-h-11 rounded-full px-4 font-sans text-sm font-bold text-brand-textMuted transition-colors duration-150 hover:text-brand-text">
              Sign out
            </button>
          </div>
        </header>

        <div className={`mt-8 grid gap-6 ${isUploader ? "" : "md:grid-cols-[13.5rem_minmax(0,1fr)] lg:gap-10"}`}>
          {!isUploader && (
            <>
              {/* Phone: one swipeable row, pinned under the site nav */}
              <nav aria-label="Admin sections" className="chrome sticky top-[var(--nav-h)] z-20 -mx-4 overflow-x-auto px-4 py-2 md:hidden">
                <div className="flex gap-2">
                  {ALL_TABS.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      aria-current={activeTab === t.id ? "page" : undefined}
                      onClick={() => setTab(t.id)}
                      className={`min-h-11 flex-none whitespace-nowrap rounded-full px-4 font-sans text-sm font-semibold transition-[background-color,color] duration-150 ${
                        activeTab === t.id ? "bg-brand-text text-brand-bg" : "bg-white/[0.07] text-brand-textSecondary"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </nav>

              {/* Desktop: grouped sidebar */}
              <nav aria-label="Admin sections" className="hidden self-start md:sticky md:top-[calc(var(--nav-h)+1.5rem)] md:block">
                {GROUPS.map((group) => (
                  <div key={group.label} className="mb-6">
                    <div className="eyebrow mb-2 px-3">{group.label}</div>
                    <ul className="space-y-1">
                      {group.tabs.map((t) => {
                        const on = activeTab === t.id;
                        return (
                          <li key={t.id}>
                            <button
                              type="button"
                              aria-current={on ? "page" : undefined}
                              onClick={() => setTab(t.id)}
                              className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left font-sans text-[0.9375rem] font-semibold transition-[background-color,color] duration-150 ${
                                on ? "bg-brand-text text-brand-bg" : "text-brand-textSecondary hover:bg-white/[0.06] hover:text-brand-text"
                              }`}
                            >
                              {t.step ? (
                                <span className={`flex h-6 w-6 flex-none items-center justify-center rounded-full text-xs font-bold ${on ? "bg-brand-bg text-brand-text" : "bg-white/10 text-brand-textMuted"}`}>{t.step}</span>
                              ) : (
                                <span className="h-6 w-6 flex-none" aria-hidden />
                              )}
                              {t.label}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </nav>
            </>
          )}

          <section className="min-w-0 rounded-3xl bg-brand-panel p-5 md:p-8">
            <h2 className="mb-6 font-display text-3xl uppercase leading-none md:text-4xl">{active.title}</h2>
            {activeTab === "upload" && <UploadTab password={password} />}
            {activeTab === "recap" && <RecapTab password={password} />}
            {activeTab === "media" && <MediaTab password={password} role={isUploader ? "uploader" : "admin"} />}
            {activeTab === "events" && <EventsTab password={password} />}
            {activeTab === "messages" && <MessagesTab password={password} />}
            {activeTab === "settings" && <SettingsTab password={password} />}
          </section>
        </div>
      </div>
    </main>
  );
}
