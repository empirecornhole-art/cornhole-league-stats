"use client";

import { useState } from "react";

function formatBytes(bytes: number) {
  if (!bytes) return "unknown";
  const mb = bytes / 1024 / 1024;
  return `${mb.toFixed(2)} MB`;
}

export default function UploadTab({ password }: { password: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState(false);

  async function handleUpload() {
    setMessage("");

    if (!password) {
      setMessage("Enter the admin password.");
      return;
    }

    if (!file) {
      setMessage("Choose an Excel workbook first.");
      return;
    }

    setUploading(true);
    setMessage(`Uploading ${file.name} (${formatBytes(file.size)})...`);

    try {
      const formData = new FormData();
      formData.append("password", password);
      formData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const text = await res.text();

      let data: any = {};
      try {
        data = JSON.parse(text);
      } catch {
        data = { error: text };
      }

      if (!res.ok) {
        setMessage(data.error || "Upload failed.");
        return;
      }

      setMessage(
        data.message ||
          `Upload complete. File size: ${
            data.size ? formatBytes(data.size) : formatBytes(file.size)
          }.`
      );
    } catch (err: any) {
      setMessage(err?.message || "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  const [shFiles, setShFiles] = useState<File[]>([]);
  const [shSeason, setShSeason] = useState("Fall 26");
  const [shMessage, setShMessage] = useState("");
  const [shBusy, setShBusy] = useState(false);

  async function handleScoreholioImport() {
    setShMessage("");
    if (!password) return setShMessage("Enter the admin password.");
    if (!shFiles.length) return setShMessage("Choose the Scoreholio export files first.");

    setShBusy(true);
    setShMessage(`Importing ${shFiles.length} file${shFiles.length === 1 ? "" : "s"}...`);
    try {
      const formData = new FormData();
      formData.append("password", password);
      formData.append("season", shSeason);
      shFiles.forEach((f) => formData.append("files", f));

      const res = await fetch("/api/admin/scoreholio-import", { method: "POST", body: formData });
      const data = await res.json().catch(() => ({ error: "Unexpected response from server." }));
      if (!res.ok) return setShMessage(data.error || "Import failed.");

      const lines = [
        `${data.season}: imported ${data.events.length} event${data.events.length === 1 ? "" : "s"}. Weeks in season: ${data.weeksInSeason.join(", ")}. Players: ${data.players}.`,
        ...data.events.map((e: any) => `  Week ${e.week} ${e.type === "Blind" ? "Blind Draw" : "Switch"}: ${e.players} players`),
        ...(data.warnings.length ? ["", "Check:", ...data.warnings.map((w: string) => `  - ${w}`)] : []),
      ];
      setShMessage(lines.join("\n"));
      setShFiles([]);
    } catch (err: any) {
      setShMessage(err?.message || "Import failed.");
    } finally {
      setShBusy(false);
    }
  }

  return (
    <div>
      <h3 className="font-display text-lg uppercase text-brand-orange">Weekly Scoreholio results</h3>
      <p className="mt-2 font-sans text-sm text-brand-textSecondary">
        Upload all four Scoreholio exports for the week at once: the Switch ScoreMagic and RoundRobin-Standings files, and the Blind Draw
        ScoreMagic and Bracket-Standings files. The week, event types, Blind Draw bonuses (3/2/1, both teammates) and each player&apos;s best 9
        weeks are worked out automatically.
      </p>

      <label className="mt-4 block">
        <span className="field-label">Season</span>
        <input
          value={shSeason}
          onChange={(e) => setShSeason(e.target.value)}
          className="mt-2 block w-full rounded-lg border border-white/10 bg-brand-bg px-4 py-3 font-sans text-sm text-brand-text"
        />
      </label>

      <label className="mt-4 block">
        <span className="field-label">Scoreholio export files</span>
        <input
          type="file"
          multiple
          accept=".csv,.xlsx,.xls"
          onChange={(e) => setShFiles(Array.from(e.target.files || []))}
          className="mt-2 block w-full rounded-lg border border-white/10 bg-brand-bg px-4 py-3 font-sans text-sm text-brand-text file:mr-4 file:rounded-full file:border-0 file:bg-brand-orange file:px-4 file:py-2 file:font-sans file:text-xs file:font-bold file:uppercase file:text-brand-bg"
        />
      </label>

      <button type="button" onClick={handleScoreholioImport} disabled={shBusy} className="btn-primary mt-4 disabled:opacity-60">
        {shBusy ? "Importing..." : "Import Results"}
      </button>

      {shMessage && (
        <div className="mt-5 whitespace-pre-wrap rounded-lg border border-white/10 bg-brand-bg p-4 font-sans text-sm text-brand-textSecondary">
          {shMessage}
        </div>
      )}

      <hr className="my-10 border-white/10" />

      <h3 className="font-display text-lg uppercase text-brand-textSecondary">Legacy workbook (seasons before Fall &apos;26)</h3>
      <p className="mt-2 font-sans text-sm text-brand-textSecondary">
        Upload the latest master Excel workbook. This updates the public stats pages.
      </p>

      <label className="mt-6 block">
        <span className="field-label">
          Excel workbook
        </span>
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={(e) => {
            const selectedFile = e.target.files?.[0] || null;
            setFile(selectedFile);

            if (selectedFile) {
              setMessage(`Selected ${selectedFile.name} (${formatBytes(selectedFile.size)})`);
            } else {
              setMessage("");
            }
          }}
          className="mt-2 block w-full rounded-lg border border-white/10 bg-brand-bg px-4 py-3 font-sans text-sm text-brand-text file:mr-4 file:rounded-full file:border-0 file:bg-brand-orange file:px-4 file:py-2 file:font-sans file:text-xs file:font-bold file:uppercase file:text-brand-bg"
        />
      </label>

      <button
        type="button"
        onClick={handleUpload}
        disabled={uploading}
        className="btn-primary mt-6 disabled:opacity-60"
      >
        {uploading ? "Uploading..." : "Upload Workbook"}
      </button>

      {message && (
        <div className="mt-5 whitespace-pre-wrap rounded-lg border border-white/10 bg-brand-bg p-4 font-sans text-sm text-brand-textSecondary">
          {message}
        </div>
      )}
    </div>
  );
}
