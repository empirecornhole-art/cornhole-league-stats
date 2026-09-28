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

  return (
    <div>
      <p className="font-sans text-sm text-brand-textSecondary">
        Upload the latest master Excel workbook. This updates the public stats pages.
      </p>

      <label className="mt-6 block">
        <span className="font-sans text-xs font-bold uppercase tracking-widest text-brand-textMuted">
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
