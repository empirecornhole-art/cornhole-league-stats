"use client";

import { useState } from "react";
import UploadTab from "../../components/admin/UploadTab";
import EventsTab from "../../components/admin/EventsTab";
import SettingsTab from "../../components/admin/SettingsTab";

type Tab = "upload" | "events" | "settings";

const TABS: { id: Tab; label: string }[] = [
  { id: "upload", label: "Upload Season Data" },
  { id: "events", label: "Events" },
  { id: "settings", label: "Site Settings" },
];

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [tab, setTab] = useState<Tab>("upload");

  return (
    <main className="min-h-screen bg-brand-bg px-4 py-10 text-brand-text">
      <section className="mx-auto max-w-4xl rounded-2xl border border-white/10 bg-brand-panel p-6 md:p-8">
        <h1 className="font-display text-3xl uppercase text-brand-text">Admin</h1>
        <p className="mt-2 font-sans text-sm text-brand-textSecondary">
          Manage season data, upcoming events, and site content.
        </p>

        <label className="mt-6 block">
          <span className="field-label">
            Admin password
          </span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-2 block w-full rounded-lg border border-white/10 bg-brand-bg px-4 py-3 font-sans text-sm text-brand-text placeholder:text-brand-textFaint focus:border-brand-orange focus:outline-none"
            placeholder="Enter the admin password"
          />
        </label>

        <div className="mt-6 flex flex-wrap gap-2 border-b border-white/10 pb-4">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-full px-4 py-2 font-sans text-sm font-semibold transition duration-200 ${
                tab === t.id
                  ? "bg-brand-orange text-brand-bg"
                  : "bg-white/5 text-brand-textMuted hover:bg-white/10"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="mt-6">
          {tab === "upload" && <UploadTab password={password} />}
          {tab === "events" && <EventsTab password={password} />}
          {tab === "settings" && <SettingsTab password={password} />}
        </div>
      </section>
    </main>
  );
}
