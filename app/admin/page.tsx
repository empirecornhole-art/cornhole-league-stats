"use client";

import { useEffect, useState } from "react";
import UploadTab from "../../components/admin/UploadTab";
import EventsTab from "../../components/admin/EventsTab";
import SettingsTab from "../../components/admin/SettingsTab";
import MessagesTab from "../../components/admin/MessagesTab";
import RecapTab from "../../components/admin/RecapTab";
import MediaTab from "../../components/admin/MediaTab";

type Tab = "upload" | "recap" | "media" | "events" | "messages" | "settings";

const TABS: { id: Tab; label: string }[] = [
  { id: "upload", label: "Upload Season Data" },
  { id: "recap", label: "Week Recap" },
  { id: "media", label: "Photos & Video" },
  { id: "events", label: "Events" },
  { id: "messages", label: "Messages" },
  { id: "settings", label: "Site Settings" },
];

type Role = "admin" | "uploader" | null;

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [tab, setTab] = useState<Tab>("upload");
  const [role, setRole] = useState<Role>(null);

  // Which tabs to show for this password. Display only: the server checks every action itself.
  useEffect(() => {
    if (!password) {
      setRole(null);
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
      } catch {
        setRole(null);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [password]);

  const isUploader = role === "uploader";
  const visibleTabs = isUploader ? TABS.filter((t) => t.id === "media") : TABS;
  const activeTab: Tab = isUploader ? "media" : tab;

  return (
    <main className="min-h-screen bg-brand-bg px-4 py-10 text-brand-text">
      <section className="mx-auto max-w-4xl rounded-2xl border border-white/10 bg-brand-panel p-6 md:p-8">
        <h1 className="font-display text-3xl uppercase text-brand-text">Admin</h1>
        <p className="mt-2 font-sans text-sm text-brand-textSecondary">
          {isUploader
            ? "Photo upload access: add photos and videos for the league."
            : "Manage season data, upcoming events, and site content."}
        </p>

        <label className="mt-6 block">
          <span className="field-label">
            {isUploader ? "Password" : "Admin password"}
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
          {visibleTabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-full px-4 py-2 font-sans text-sm font-semibold transition duration-200 ${
                activeTab === t.id
                  ? "bg-brand-orange text-brand-bg"
                  : "bg-white/5 text-brand-textMuted hover:bg-white/10"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="mt-6">
          {activeTab === "upload" && <UploadTab password={password} />}
          {activeTab === "recap" && <RecapTab password={password} />}
          {activeTab === "media" && <MediaTab password={password} role={isUploader ? "uploader" : "admin"} />}
          {activeTab === "events" && <EventsTab password={password} />}
          {activeTab === "messages" && <MessagesTab password={password} />}
          {activeTab === "settings" && <SettingsTab password={password} />}
        </div>
      </section>
    </main>
  );
}
