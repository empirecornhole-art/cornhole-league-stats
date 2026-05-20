'use client';
import { useEffect, useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

type Data = { lastUpdated?: string; seasons: string[]; players: string[]; overall: any[]; swap: any[]; blind: any[]; stats: any[]; leaderboard: any[] };

function getSeason(row: any, fallback: string) { return String(row.Season || row.season || fallback || '').trim(); }
function getPlayer(row: any) {
  const direct = row.Player || row.Name || row['Player Name'] || row.player || row.name;
  if (direct) return String(direct).trim();
  return [row.First || row['First Name'], row.Last || row['Last Name']].filter(Boolean).join(' ').trim();
}
function getWeek(row: any) { return String(row.Week || row.week || '').trim(); }
function numberVal(v: any) { const n = Number(String(v ?? '').replace(/[^0-9.-]/g,'')); return Number.isFinite(n) ? n : 0; }
function pointValue(row: any) { return numberVal(row.Points ?? row.points ?? row['Overall Points'] ?? row.Overall ?? row.Total ?? row['Total Points']); }

export default function LeagueClient() {
  const [data, setData] = useState<Data | null>(null);
  const [season, setSeason] = useState('');
  const [player, setPlayer] = useState('All Players');
  const [type, setType] = useState<'Blind'|'Swap'>('Blind');
  const [week, setWeek] = useState('');
  const [compareA, setCompareA] = useState('');
  const [compareB, setCompareB] = useState('');

  useEffect(() => { fetch('/api/data').then(r=>r.json()).then(d=>{ setData(d); setSeason(d.seasons?.[0] || ''); }); }, []);
  const seasons = data?.seasons || [];
  const players = data?.players || [];
  const weekRows = type === 'Blind' ? (data?.blind || []) : (data?.swap || []);
  const weeks = useMemo(() => Array.from(new Set(weekRows.filter(r => !season || getSeason(r, season) === season).map(getWeek).filter(Boolean))).sort(), [weekRows, season]);
  useEffect(() => { if (!week && weeks[0]) setWeek(weeks[0]); }, [weeks, week]);

  const standings = useMemo(() => {
    const rows = (data?.overall?.length ? data.overall : data?.leaderboard || []).filter(r => !season || getSeason(r, season) === season || !r.Season);
    const filtered = player === 'All Players' ? rows : rows.filter(r => getPlayer(r) === player);
    return filtered.map(r => ({ name: getPlayer(r) || r.Name || 'Unknown', points: pointValue(r), raw: r })).sort((a,b)=>b.points-a.points);
  }, [data, season, player]);

  const visibleWeekRows = weekRows.filter(r => (!season || getSeason(r, season) === season || !r.Season) && (!week || getWeek(r) === week) && (player === 'All Players' || getPlayer(r) === player));
  const statA = (data?.stats || []).find(r => getPlayer(r) === compareA && (!season || getSeason(r, season) === season || !r.Season));
  const statB = (data?.stats || []).find(r => getPlayer(r) === compareB && (!season || getSeason(r, season) === season || !r.Season));
  const compareKeys = Array.from(new Set([...(statA ? Object.keys(statA) : []), ...(statB ? Object.keys(statB) : [])])).filter(k => !['Season'].includes(k));

  if (!data) return <main className="mx-auto max-w-7xl p-4">Loading...</main>;

  return <main className="mx-auto max-w-7xl space-y-8 p-4">
    <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-end">
        <div><label className="text-xs text-neutral-400">Season</label><select className="block rounded bg-neutral-800 p-2" value={season} onChange={e=>setSeason(e.target.value)}>{seasons.map(s=><option key={s}>{s}</option>)}</select></div>
        <div><label className="text-xs text-neutral-400">Player</label><select className="block rounded bg-neutral-800 p-2" value={player} onChange={e=>setPlayer(e.target.value)}><option>All Players</option>{players.map(p=><option key={p}>{p}</option>)}</select></div>
        <div className="text-sm text-neutral-400">Last updated: {data.lastUpdated ? new Date(data.lastUpdated).toLocaleString() : 'No workbook uploaded yet'}</div>
      </div>
    </section>

    <section className="grid gap-4 md:grid-cols-3">
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4"><div className="text-neutral-400">Players</div><div className="text-3xl font-bold">{players.length}</div></div>
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4"><div className="text-neutral-400">Seasons</div><div className="text-3xl font-bold">{seasons.length}</div></div>
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4"><div className="text-neutral-400">Top Score</div><div className="text-3xl font-bold">{standings[0]?.points || 0}</div></div>
    </section>

    <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
      <h2 className="mb-4 text-xl font-bold">Standings</h2>
      <div className="h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={standings.slice(0,12)}><XAxis dataKey="name" hide/><YAxis/><Tooltip/><Bar dataKey="points" /></BarChart></ResponsiveContainer></div>
      <div className="mt-4 overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-neutral-400"><th className="p-2">#</th><th className="p-2">Player</th><th className="p-2">Points</th></tr></thead><tbody>{standings.map((r,i)=><tr key={i} className="border-t border-neutral-800"><td className="p-2">{i+1}</td><td className="p-2">{r.name}</td><td className="p-2">{r.points}</td></tr>)}</tbody></table></div>
    </section>

    <section id="players" className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
      <h2 className="mb-4 text-xl font-bold">Players</h2>
      <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">{players.map(p=><div key={p} className="rounded-lg bg-neutral-800 p-3">{p}</div>)}</div>
    </section>

    <section id="weeks" className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
      <h2 className="mb-4 text-xl font-bold">Weeks</h2>
      <div className="mb-4 flex gap-3"><select className="rounded bg-neutral-800 p-2" value={type} onChange={e=>{setType(e.target.value as any); setWeek('');}}><option>Blind</option><option>Swap</option></select><select className="rounded bg-neutral-800 p-2" value={week} onChange={e=>setWeek(e.target.value)}>{weeks.map(w=><option key={w}>{w}</option>)}</select></div>
      <div className="overflow-x-auto"><table className="w-full text-sm"><tbody>{visibleWeekRows.map((r,i)=><tr key={i} className="border-t border-neutral-800"><td className="p-2">{getPlayer(r)}</td>{Object.entries(r).slice(0,8).map(([k,v])=><td key={k} className="p-2"><span className="text-neutral-500">{k}: </span>{String(v)}</td>)}</tr>)}</tbody></table></div>
    </section>

    <section id="compare" className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
      <h2 className="mb-4 text-xl font-bold">Compare Players</h2>
      <div className="mb-4 flex gap-3"><select className="rounded bg-neutral-800 p-2" value={compareA} onChange={e=>setCompareA(e.target.value)}><option value="">Player A</option>{players.map(p=><option key={p}>{p}</option>)}</select><select className="rounded bg-neutral-800 p-2" value={compareB} onChange={e=>setCompareB(e.target.value)}><option value="">Player B</option>{players.map(p=><option key={p}>{p}</option>)}</select></div>
      <div className="overflow-x-auto"><table className="w-full text-sm"><tbody>{compareKeys.map(k=><tr key={k} className="border-t border-neutral-800"><td className="p-2 text-neutral-400">{k}</td><td className="p-2">{String(statA?.[k] ?? '-')}</td><td className="p-2">{String(statB?.[k] ?? '-')}</td></tr>)}</tbody></table></div>
    </section>
  </main>;
}
