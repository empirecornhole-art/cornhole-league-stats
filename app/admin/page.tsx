'use client';
import { useState } from 'react';

export default function AdminPage() {
  const [password, setPassword] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) { setMessage('Choose an Excel workbook first.'); return; }
    setLoading(true); setMessage('Uploading...');
    const form = new FormData();
    form.append('password', password);
    form.append('file', file);
    const res = await fetch('/api/upload', { method: 'POST', body: form });
    const json = await res.json();
    setLoading(false);
    if (!res.ok) setMessage(json.error || 'Upload failed.');
    else setMessage(`Upload complete. Seasons: ${json.summary.seasons}. Players: ${json.summary.players}.`);
  }

  return <main className="mx-auto max-w-2xl p-4">
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6">
      <h1 className="text-2xl font-bold">Admin Upload</h1>
      <p className="mt-2 text-neutral-400">Upload the latest master Excel workbook. This updates the public stats pages.</p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <div><label className="text-sm text-neutral-400">Admin password</label><input className="mt-1 w-full rounded bg-neutral-800 p-3" type="password" value={password} onChange={e=>setPassword(e.target.value)} /></div>
        <div><label className="text-sm text-neutral-400">Excel workbook</label><input className="mt-1 w-full rounded bg-neutral-800 p-3" type="file" accept=".xlsx,.xls" onChange={e=>setFile(e.target.files?.[0] || null)} /></div>
        <button disabled={loading} className="rounded bg-white px-4 py-2 font-semibold text-black disabled:opacity-50">{loading ? 'Uploading...' : 'Upload Workbook'}</button>
      </form>
      {message && <p className="mt-4 rounded bg-neutral-800 p-3">{message}</p>}
    </div>
  </main>;
}
