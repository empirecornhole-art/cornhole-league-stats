"use client";

import { useEffect, useState } from "react";

type SettingsForm = {
  venue_name: string;
  venue_address: string;
  contact_email: string;
  facebook_url: string;
  instagram_url: string;
  season_label: string;
  current_week: string;
};

const EMPTY_SETTINGS: SettingsForm = {
  venue_name: "",
  venue_address: "",
  contact_email: "",
  facebook_url: "",
  instagram_url: "",
  season_label: "",
  current_week: "",
};

const FIELDS: { key: keyof SettingsForm; label: string; placeholder: string }[] = [
  { key: "venue_name", label: "Venue Name", placeholder: "Pittsfield Firehouse" },
  { key: "venue_address", label: "Venue Address", placeholder: "167 State Route 80, New Berlin, NY" },
  { key: "contact_email", label: "Contact Email", placeholder: "info@empirecornhole.com" },
  { key: "facebook_url", label: "Facebook URL", placeholder: "https://facebook.com/empirecornhole" },
  { key: "instagram_url", label: "Instagram URL", placeholder: "https://instagram.com/empirecornhole" },
  { key: "season_label", label: "Season Label", placeholder: "Summer '26" },
  { key: "current_week", label: "Current Week", placeholder: "13" },
];

export default function SettingsTab({ password }: { password: string }) {
  const [form, setForm] = useState<SettingsForm>(EMPTY_SETTINGS);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [loadedForPassword, setLoadedForPassword] = useState("");

  useEffect(() => {
    if (password && password !== loadedForPassword) {
      loadSettings();
      setLoadedForPassword(password);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [password]);

  async function loadSettings() {
    if (!password) {
      setMessage("Enter the admin password.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("/api/admin/settings", {
        headers: { "x-admin-password": password },
      });
      const data = await res.json();

      if (!res.ok || !data.ok) {
        setMessage(data.error || "Failed to load settings.");
        return;
      }

      setForm({ ...EMPTY_SETTINGS, ...data.settings });
    } catch (err: any) {
      setMessage(err?.message || "Failed to load settings.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!password) {
      setMessage("Enter the admin password.");
      return;
    }

    setSaving(true);
    setMessage("Saving...");

    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": password,
        },
        body: JSON.stringify(form),
      });
      const data = await res.json();

      if (!res.ok || !data.ok) {
        setMessage(data.error || "Failed to save settings.");
        return;
      }

      setForm({ ...EMPTY_SETTINGS, ...data.settings });
      setMessage("Settings saved.");
    } catch (err: any) {
      setMessage(err?.message || "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-sans text-sm text-brand-textSecondary">
          Controls venue, contact, and social info shown across the public site.
        </p>
        <button type="button" onClick={loadSettings} className="btn-secondary" disabled={loading}>
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {message && (
        <div className="mt-4 rounded-lg border border-white/10 bg-brand-bg p-4 font-sans text-sm text-brand-textSecondary">
          {message}
        </div>
      )}

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {FIELDS.map((field) => (
          <label key={field.key} className="block">
            <span className="font-sans text-xs font-bold uppercase tracking-widest text-brand-textMuted">
              {field.label}
            </span>
            <input
              type="text"
              value={form[field.key]}
              onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
              placeholder={field.placeholder}
              className="mt-2 w-full rounded-lg border border-white/10 bg-brand-bg px-4 py-2.5 font-sans text-sm text-brand-text placeholder:text-brand-textFaint focus:border-brand-orange focus:outline-none"
            />
          </label>
        ))}
      </div>

      <button type="button" onClick={handleSave} disabled={saving} className="btn-primary mt-6 disabled:opacity-60">
        {saving ? "Saving..." : "Save Settings"}
      </button>
    </div>
  );
}
