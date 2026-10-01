"use client";

import { useEffect, useState } from "react";

type EventRow = {
  id: string;
  event_date: string;
  time: string;
  title: string;
  location: string;
  tag: string;
  featured: boolean;
  scoreholio_id: string | null;
};

type EventFormState = {
  event_date: string;
  time: string;
  title: string;
  location: string;
  tag: string;
  featured: boolean;
};

const EMPTY_FORM: EventFormState = {
  event_date: "",
  time: "",
  title: "",
  location: "",
  tag: "Weekly",
  featured: false,
};

export default function EventsTab({ password }: { password: string }) {
  const [events, setEvents] = useState<EventRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<EventFormState>(EMPTY_FORM);
  const [defaultLocation, setDefaultLocation] = useState("");
  const [loadedForPassword, setLoadedForPassword] = useState("");

  useEffect(() => {
    if (password && password !== loadedForPassword) {
      loadEvents();
      loadDefaultLocation();
      setLoadedForPassword(password);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [password]);

  async function loadDefaultLocation() {
    try {
      const res = await fetch("/api/admin/settings", {
        headers: { "x-admin-password": password },
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setDefaultLocation(data.settings?.venue_name || "");
      }
    } catch {
      // Non-critical: default location is a convenience only.
    }
  }

  async function loadEvents() {
    if (!password) {
      setMessage("Enter the admin password.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("/api/admin/events", {
        headers: { "x-admin-password": password },
      });
      const data = await res.json();

      if (!res.ok || !data.ok) {
        setMessage(data.error || "Failed to load events.");
        setEvents(null);
        return;
      }

      setEvents(data.events || []);
    } catch (err: any) {
      setMessage(err?.message || "Failed to load events.");
    } finally {
      setLoading(false);
    }
  }

  function openAddForm() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, location: defaultLocation });
    setShowForm(true);
    setMessage("");
  }

  function openEditForm(event: EventRow) {
    setEditingId(event.id);
    setForm({
      event_date: event.event_date,
      time: event.time,
      title: event.title,
      location: event.location,
      tag: event.tag,
      featured: event.featured,
    });
    setShowForm(true);
    setMessage("");
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  async function handleSave() {
    if (!password) {
      setMessage("Enter the admin password.");
      return;
    }
    if (!form.title.trim() || !form.event_date.trim()) {
      setMessage("Title and date are required.");
      return;
    }

    setMessage(editingId ? "Saving changes..." : "Creating event...");

    try {
      const res = await fetch(
        editingId ? `/api/admin/events/${editingId}` : "/api/admin/events",
        {
          method: editingId ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
            "x-admin-password": password,
          },
          body: JSON.stringify(form),
        }
      );
      const data = await res.json();

      if (!res.ok || !data.ok) {
        setMessage(data.error || "Failed to save event.");
        return;
      }

      setMessage(editingId ? "Event updated." : "Event created.");
      closeForm();
      await loadEvents();
    } catch (err: any) {
      setMessage(err?.message || "Failed to save event.");
    }
  }

  async function handleSync() {
    if (!password) {
      setMessage("Enter the admin password.");
      return;
    }

    setSyncing(true);
    setMessage("Syncing from Scoreholio...");

    try {
      const res = await fetch("/api/admin/scoreholio-sync", {
        method: "POST",
        headers: { "x-admin-password": password },
      });
      const data = await res.json();

      if (!res.ok || !data.ok) {
        setMessage(data.error || "Scoreholio sync failed.");
        return;
      }

      const skipped = data.skipped?.length ? ` Skipped (not ours): ${data.skipped.join(", ")}.` : "";
      setMessage(`Synced ${data.upserted} tournament(s) from Scoreholio, removed ${data.removed}.${skipped}`);
      await loadEvents();
    } catch (err: any) {
      setMessage(err?.message || "Scoreholio sync failed.");
    } finally {
      setSyncing(false);
    }
  }

  async function handleDelete(event: EventRow) {
    if (!password) {
      setMessage("Enter the admin password.");
      return;
    }
    if (!window.confirm(`Delete "${event.title}"? This cannot be undone.`)) {
      return;
    }

    setMessage("Deleting...");

    try {
      const res = await fetch(`/api/admin/events/${event.id}`, {
        method: "DELETE",
        headers: { "x-admin-password": password },
      });
      const data = await res.json();

      if (!res.ok || !data.ok) {
        setMessage(data.error || "Failed to delete event.");
        return;
      }

      setMessage("Event deleted.");
      await loadEvents();
    } catch (err: any) {
      setMessage(err?.message || "Failed to delete event.");
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-sans text-sm text-brand-textSecondary">
          Manage upcoming and past events shown on the public site. Scoreholio events sync daily; edits to
          their date, time, title, or location are overwritten on the next sync (Featured is kept).
        </p>
        <div className="flex gap-2">
          <button type="button" onClick={loadEvents} className="btn-secondary" disabled={loading}>
            {loading ? "Loading..." : "Refresh"}
          </button>
          <button type="button" onClick={handleSync} className="btn-secondary" disabled={syncing}>
            {syncing ? "Syncing..." : "Sync from Scoreholio"}
          </button>
          <button type="button" onClick={openAddForm} className="btn-primary">
            Add Event
          </button>
        </div>
      </div>

      {message && (
        <div className="mt-4 rounded-lg border border-white/10 bg-brand-bg p-4 font-sans text-sm text-brand-textSecondary">
          {message}
        </div>
      )}

      {showForm && (
        <div className="mt-5 rounded-xl border border-white/10 bg-brand-bg p-5">
          <h3 className="font-display text-lg uppercase text-brand-text">
            {editingId ? "Edit Event" : "Add Event"}
          </h3>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="font-sans text-xs font-bold uppercase tracking-widest text-brand-textMuted">
                Date
              </span>
              <input
                type="date"
                value={form.event_date}
                onChange={(e) => setForm({ ...form, event_date: e.target.value })}
                className="mt-2 w-full rounded-lg border border-white/10 bg-brand-panel px-4 py-2.5 font-sans text-sm text-brand-text focus:border-brand-orange focus:outline-none"
              />
            </label>

            <label className="block">
              <span className="font-sans text-xs font-bold uppercase tracking-widest text-brand-textMuted">
                Time
              </span>
              <input
                type="text"
                value={form.time}
                onChange={(e) => setForm({ ...form, time: e.target.value })}
                placeholder="6:30 PM"
                className="mt-2 w-full rounded-lg border border-white/10 bg-brand-panel px-4 py-2.5 font-sans text-sm text-brand-text placeholder:text-brand-textFaint focus:border-brand-orange focus:outline-none"
              />
            </label>

            <label className="block sm:col-span-2">
              <span className="font-sans text-xs font-bold uppercase tracking-widest text-brand-textMuted">
                Title
              </span>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Blind Draw Night — Week 13"
                className="mt-2 w-full rounded-lg border border-white/10 bg-brand-panel px-4 py-2.5 font-sans text-sm text-brand-text placeholder:text-brand-textFaint focus:border-brand-orange focus:outline-none"
              />
            </label>

            <label className="block sm:col-span-2">
              <span className="font-sans text-xs font-bold uppercase tracking-widest text-brand-textMuted">
                Location
              </span>
              <input
                type="text"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="Pittsfield Firehouse"
                className="mt-2 w-full rounded-lg border border-white/10 bg-brand-panel px-4 py-2.5 font-sans text-sm text-brand-text placeholder:text-brand-textFaint focus:border-brand-orange focus:outline-none"
              />
            </label>

            <label className="block">
              <span className="font-sans text-xs font-bold uppercase tracking-widest text-brand-textMuted">
                Tag
              </span>
              <input
                type="text"
                value={form.tag}
                onChange={(e) => setForm({ ...form, tag: e.target.value })}
                placeholder="Weekly"
                className="mt-2 w-full rounded-lg border border-white/10 bg-brand-panel px-4 py-2.5 font-sans text-sm text-brand-text placeholder:text-brand-textFaint focus:border-brand-orange focus:outline-none"
              />
            </label>

            <label className="flex items-center gap-3 sm:mt-7">
              <input
                type="checkbox"
                checked={form.featured}
                onChange={(e) => setForm({ ...form, featured: e.target.checked })}
                className="h-4 w-4 rounded border-white/20 bg-brand-panel accent-brand-orange"
              />
              <span className="font-sans text-sm text-brand-textSecondary">Featured event</span>
            </label>
          </div>

          <div className="mt-5 flex gap-3">
            <button type="button" onClick={handleSave} className="btn-primary">
              Save
            </button>
            <button type="button" onClick={closeForm} className="btn-secondary">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="mt-6 flex flex-col gap-3">
        {events === null && !loading && (
          <p className="font-sans text-sm text-brand-textMuted">
            Enter the password above, then Refresh to load events.
          </p>
        )}
        {events !== null && events.length === 0 && (
          <p className="font-sans text-sm text-brand-textMuted">No events yet.</p>
        )}
        {events?.map((event) => (
          <div
            key={event.id}
            className="flex flex-col gap-3 rounded-xl border border-white/10 bg-brand-bg p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-sans text-xs font-bold uppercase tracking-widest text-brand-orange">
                  {event.event_date}
                </span>
                {event.time && (
                  <span className="font-sans text-xs text-brand-textMuted">{event.time}</span>
                )}
                <span className="rounded-full bg-white/10 px-2.5 py-0.5 font-sans text-xs font-bold uppercase tracking-widest text-brand-textMuted">
                  {event.tag}
                </span>
                {event.scoreholio_id && (
                  <span className="rounded-full border border-white/15 px-2.5 py-0.5 font-sans text-xs font-bold uppercase tracking-widest text-brand-textMuted">
                    Scoreholio
                  </span>
                )}
                {event.featured && (
                  <span className="rounded-full bg-brand-orange px-2.5 py-0.5 font-sans text-xs font-bold uppercase tracking-widest text-brand-bg">
                    Featured
                  </span>
                )}
              </div>
              <h4 className="mt-1 font-display text-base uppercase text-brand-text">{event.title}</h4>
              {event.location && (
                <p className="mt-1 font-sans text-sm text-brand-textSecondary">{event.location}</p>
              )}
            </div>
            <div className="flex gap-2 self-start sm:self-auto">
              <button type="button" onClick={() => openEditForm(event)} className="btn-secondary">
                Edit
              </button>
              <button
                type="button"
                onClick={() => handleDelete(event)}
                className="rounded-full border border-red-500/40 px-4 py-2 font-sans text-xs font-bold uppercase tracking-wide text-red-400 transition duration-200 hover:bg-red-500/10"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
