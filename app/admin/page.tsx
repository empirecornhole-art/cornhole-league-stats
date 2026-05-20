"use client";

import { useState } from "react";

function formatBytes(bytes: number) {
  if (!bytes) return "unknown";
  const mb = bytes / 1024 / 1024;
  return `${mb.toFixed(2)} MB`;
}

export default function AdminPage() {
  const [password, setPassword] = useState("");
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
    <main
      style={{
        minHeight: "100vh",
        background: "#090909",
        color: "white",
        padding: 24,
      }}
    >
      <section
        style={{
          maxWidth: 700,
          margin: "0 auto",
          background: "#171717",
          border: "1px solid #333",
          borderRadius: 16,
          padding: 24,
        }}
      >
        <h1 style={{ fontSize: 28, fontWeight: 700 }}>Admin Upload</h1>

        <p style={{ color: "#ccc" }}>
          Upload the latest master Excel workbook. This updates the public stats
          pages.
        </p>

        <label style={{ display: "block", marginTop: 24 }}>
          Admin password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{
              display: "block",
              width: "100%",
              marginTop: 8,
              padding: 12,
              background: "#262626",
              color: "white",
              border: "1px solid #333",
              borderRadius: 6,
            }}
          />
        </label>

        <label style={{ display: "block", marginTop: 24 }}>
          Excel workbook
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => {
              const selectedFile = e.target.files?.[0] || null;
              setFile(selectedFile);

              if (selectedFile) {
                setMessage(
                  `Selected ${selectedFile.name} (${formatBytes(
                    selectedFile.size
                  )})`
                );
              } else {
                setMessage("");
              }
            }}
            style={{
              display: "block",
              width: "100%",
              marginTop: 8,
              padding: 12,
              background: "#262626",
              color: "white",
              border: "1px solid #333",
              borderRadius: 6,
            }}
          />
        </label>

        <button
          onClick={handleUpload}
          disabled={uploading}
          style={{
            marginTop: 24,
            padding: "12px 18px",
            background: "white",
            color: "black",
            borderRadius: 6,
            fontWeight: 700,
            opacity: uploading ? 0.6 : 1,
          }}
        >
          {uploading ? "Uploading..." : "Upload Workbook"}
        </button>

        {message && (
          <div
            style={{
              marginTop: 18,
              background: "#262626",
              padding: 14,
              borderRadius: 6,
              whiteSpace: "pre-wrap",
            }}
          >
            {message}
          </div>
        )}
      </section>
    </main>
  );
}
