"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList, LineChart, Line, CartesianGrid, Legend } from "recharts";

type Data = { lastUpdated?: string; seasons: string[]; players: string[]; standings: any[]; weekly: any[]; stats: any[]; eventStats?: any[] };
type Tab = "dashboard" | "standings" | "weeks" | "players" | "compare";
type EventFilter = "All" | "Blind" | "Swap";
type SortDirection = "asc" | "desc";

function clean(value: any) { return String(value ?? "").trim(); }
function getSeason(row: any, fallback = "") { return clean(row.Season || row.season || row.SEASON || fallback); }
function getPlayer(row: any) { return clean(row.Player || row.playerName || row["Row Labels"] || row["Player Name"] || row["PLAYER NAME"] || row.Name || row.name); }
function getWeek(row: any) { const v = clean(row.Week || row.week || row.WEEK); const n = v.match(/\d+/)?.[0]; return n ? `Week ${n}` : v; }
function getType(row: any) { const raw = clean(row.Type || row.type || row.TYPE); if (/blind/i.test(raw)) return "Blind"; if (/swap/i.test(raw)) return "Swap"; return raw; }
function numberVal(value: any) { const n = Number(String(value ?? "").replace(/[^0-9.-]/g, "")); return Number.isFinite(n) ? n : 0; }
function formatValue(value: any, decimals = 2) { if (value === "" || value === null || value === undefined) return "-"; const n = numberVal(value); if (!Number.isFinite(n)) return String(value); if (String(value).includes("%")) return `${n.toFixed(2)}%`; if (Math.abs(n) >= 100 || Number.isInteger(n) || decimals === 0) return String(Math.round(n)); return n.toFixed(decimals); }
function getStatValue(row: any, keys: string[]) { for (const key of keys) if (row?.[key] !== undefined && row?.[key] !== "") return row[key]; return ""; }
function getStatNumber(row: any, keys: string[]) { return numberVal(getStatValue(row, keys)); }
function pointValue(row: any) { return numberVal(row.Points || row.points || row["Overall Points"] || row.Overall || row.Total || row["Total Points"] || row["Total POINTS"]); }
function weekSort(a: string, b: string) { const an = Number(a.replace(/[^0-9]/g, "")); const bn = Number(b.replace(/[^0-9]/g, "")); return an - bn; }
function seasonSortValue(value: string) { const m = clean(value).match(/(Fall|Winter|Spring|Summer)\s*(\d{2,4})/i); if (!m) return 999999; const year = Number(m[2].slice(-2)); const order: Record<string, number> = { spring: 1, summer: 2, fall: 3, winter: 4 }; return year * 10 + (order[m[1].toLowerCase()] || 9); }
function sortSeasons(values: string[]) { return [...values].sort((a, b) => seasonSortValue(a) - seasonSortValue(b)); }

const statColumns = [
  { label: "Total Rounds", keys: ["Total Rounds"], decimals: 0 },
  { label: "Total Pts", keys: ["Total Pts"], decimals: 0 },
  { label: "Average PPR", keys: ["Average PPR"], decimals: 2 },
  { label: "Opp Avg PPR", keys: ["Opponents Avg PPR"], decimals: 2 },
  { label: "Average DPR", keys: ["Average DPR"], decimals: 2 },
  { label: "Opp Pts", keys: ["Opponents Pts"], decimals: 0 },
  { label: "Avg Bags In", keys: ["Avg Bags In"], decimals: 2 },
  { label: "Total Bags In", keys: ["Total Bags In"], decimals: 0 },
  { label: "Avg Bags In/Rd", keys: ["Avg Bags In per Rd"], decimals: 2 },
  { label: "Bags On %", keys: ["Bags On %"], decimals: 2 },
  { label: "Bags Off %", keys: ["Bags Off %"], decimals: 2 },
  { label: "Total Bags", keys: ["Total Bags Thrown"], decimals: 0 },
  { label: "Avg 4-Bagger %", keys: ["Avg 4-Bagger %"], decimals: 2 },
  { label: "Total 4-Baggers", keys: ["Total 4-Baggers"], decimals: 0 },
  { label: "1st in Stats", keys: ["1st in Stats"], decimals: 0 },
  { label: "Avg Rounds/Swap", keys: ["Avg Rounds/Swap Game"], decimals: 2 },
];
const eventStatColumns = [
  { label: "PPR", keys: ["PPR"], decimals: 2 },
  { label: "Rounds", keys: ["Rounds"], decimals: 0 },
  { label: "Points", keys: ["Points"], decimals: 0 },
  { label: "OPPR", keys: ["OPPR"], decimals: 2 },
  { label: "Opp Pts", keys: ["Opp Pts"], decimals: 0 },
  { label: "DPR", keys: ["DPR"], decimals: 2 },
  { label: "4 Baggers", keys: ["4 Baggers"], decimals: 0 },
];

function eventStatKey(row: any) { return `${getSeason(row)}|${getWeek(row)}|${getType(row)}|${getPlayer(row).toLowerCase()}`; }
function standingKey(row: any) { return `${getSeason(row)}|${getWeek(row)}|${getType(row)}|${getPlayer(row).toLowerCase()}`; }
function eventRowsForStandings(standings: any[], eventStats: any[]) { const map = new Map(eventStats.map(r => [eventStatKey(r), r])); return standings.map(s => ({ standing: s, stat: map.get(standingKey(s)) || null })); }
function summarizeEventStats(rows: any[]) { const valid = rows.filter(Boolean); const avg = (key: string) => { const vals = valid.map(r => numberVal(r[key])).filter(n => n !== 0); return vals.length ? formatValue(vals.reduce((a,b)=>a+b,0)/vals.length, 2) : "-"; }; const sum = (key: string) => { const t = valid.reduce((a,r)=>a+numberVal(r[key]),0); return t ? formatValue(t, 0) : "-"; }; return { players: valid.length, totalRounds: sum("Rounds"), totalPoints: sum("Points"), avgPPR: avg("PPR"), avgOPPR: avg("OPPR"), avgDPR: avg("DPR"), oppPoints: sum("Opp Pts"), fourBaggers: sum("4 Baggers") }; }

export default function LeagueClient() {
  const [data, setData] = useState<Data | null>(null);
  const [tab, setTab] = useState<Tab>("dashboard");
  const [season, setSeason] = useState("");
  const [player, setPlayer] = useState("All Players");
  const [dashboardWeek, setDashboardWeek] = useState("All Weeks");
  const [type, setType] = useState<"Blind" | "Swap">("Blind");
  const [week, setWeek] = useState("");
  const [profileSeason, setProfileSeason] = useState("All Seasons");
  const [profileWeek, setProfileWeek] = useState("All Weeks");
  const [profileType, setProfileType] = useState<EventFilter>("All");
  const [compareA, setCompareA] = useState("");
  const [compareB, setCompareB] = useState("");
  const [sortKey, setSortKey] = useState("Total Pts");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  useEffect(() => { fetch("/api/data").then(r => r.json()).then(loaded => { const sorted = sortSeasons(loaded.seasons || []); setData({ ...loaded, seasons: sorted }); setSeason(sorted[0] || ""); setProfileSeason("All Seasons"); }); }, []);
  const seasons = data?.seasons || [];
  const players = data?.players || [];
  const eventStats = data?.eventStats || [];

  const selectedPlayer = player !== "All Players" ? player : "";
  const seasonStatsRows = useMemo(() => (data?.stats || []).filter(r => !season || getSeason(r) === season).filter(r => player === "All Players" || getPlayer(r) === player), [data, season, player]);
  const standings = useMemo(() => (data?.standings || []).filter(r => !season || getSeason(r) === season).map(r => ({ name: getPlayer(r), points: pointValue(r), raw: r })).filter(r => r.name).sort((a,b)=>b.points-a.points), [data, season]);
  const dashboardWeeks = useMemo(() => ["All Weeks", ...Array.from(new Set((data?.weekly || []).filter(r => getSeason(r) === season).map(getWeek).filter(Boolean))).sort(weekSort)], [data, season]);
  const dashboardStandings = useMemo(() => { if (dashboardWeek === "All Weeks") return standings; return (data?.weekly || []).filter(r => getSeason(r) === season && getWeek(r) === dashboardWeek).map(r => ({ name: getPlayer(r), points: pointValue(r), raw: r })).filter(r => r.name).sort((a,b)=>b.points-a.points); }, [data, season, dashboardWeek, standings]);
  const sortedSeasonStats = useMemo(() => { const col = statColumns.find(c => c.label === sortKey); return [...seasonStatsRows].sort((a,b)=> { if (!col) return getPlayer(a).localeCompare(getPlayer(b)); const av = getStatNumber(a, col.keys); const bv = getStatNumber(b, col.keys); if (av === bv) return getPlayer(a).localeCompare(getPlayer(b)); return sortDirection === "asc" ? av-bv : bv-av; }); }, [seasonStatsRows, sortKey, sortDirection]);
  const weeks = useMemo(() => Array.from(new Set((data?.weekly || []).filter(r => getSeason(r) === season && getType(r) === type).map(getWeek).filter(Boolean))).sort(weekSort), [data, season, type]);
  useEffect(() => { if (!week || !weeks.includes(week)) setWeek(weeks[0] || ""); }, [weeks, week]);
  const selectedWeekStandings = useMemo(() => (data?.weekly || []).filter(r => getSeason(r) === season && getType(r) === type && getWeek(r) === week).sort((a,b)=>numberVal(a.Rank)-numberVal(b.Rank)), [data, season, type, week]);
  const selectedWeekStats = useMemo(() => eventStats.filter(r => getSeason(r) === season && getType(r) === type && getWeek(r) === week), [eventStats, season, type, week]);
  const selectedWeekCombined = useMemo(() => eventRowsForStandings(selectedWeekStandings, selectedWeekStats), [selectedWeekStandings, selectedWeekStats]);

  const playerSeasonRows = useMemo(() => selectedPlayer ? (data?.stats || []).filter(r => getPlayer(r) === selectedPlayer).sort((a,b)=>seasonSortValue(getSeason(a))-seasonSortValue(getSeason(b))) : [], [data, selectedPlayer]);
  const playerVisibleSeasonRows = useMemo(() => profileSeason === "All Seasons" ? playerSeasonRows : playerSeasonRows.filter(r => getSeason(r) === profileSeason), [playerSeasonRows, profileSeason]);
  const playerSelectedStats = playerVisibleSeasonRows[playerVisibleSeasonRows.length - 1] || null;
  const playerWeeklyStandings = useMemo(() => { if (!selectedPlayer) return []; return (data?.weekly || []).filter(r => getPlayer(r) === selectedPlayer).filter(r => profileSeason === "All Seasons" || getSeason(r) === profileSeason).filter(r => profileWeek === "All Weeks" || getWeek(r) === profileWeek).filter(r => profileType === "All" || getType(r) === profileType).sort((a,b)=>seasonSortValue(getSeason(a))-seasonSortValue(getSeason(b)) || weekSort(getWeek(a), getWeek(b)) || getType(a).localeCompare(getType(b))); }, [data, selectedPlayer, profileSeason, profileWeek, profileType]);
  const playerEventStats = useMemo(() => eventStats.filter(r => getPlayer(r) === selectedPlayer), [eventStats, selectedPlayer]);
  const playerWeeks = useMemo(() => selectedPlayer ? Array.from(new Set((data?.weekly || []).filter(r => getPlayer(r) === selectedPlayer).filter(r => profileSeason === "All Seasons" || getSeason(r) === profileSeason).map(getWeek).filter(Boolean))).sort(weekSort) : [], [data, selectedPlayer, profileSeason]);
  const groupedPlayerWeeks = useMemo(() => { const combined = eventRowsForStandings(playerWeeklyStandings, playerEventStats); const groups: Record<string, Record<string, { standing: any; stat: any }[]>> = {}; for (const row of combined) { const label = `${getSeason(row.standing)} - ${getWeek(row.standing)}`; const eventType = getType(row.standing); if (!groups[label]) groups[label] = {}; if (!groups[label][eventType]) groups[label][eventType] = []; groups[label][eventType].push(row); } return Object.entries(groups); }, [playerWeeklyStandings, playerEventStats]);
  const progressData = useMemo(() => playerSeasonRows.map(r => ({ season: getSeason(r), PPR: getStatNumber(r, ["Average PPR"]), DPR: getStatNumber(r, ["Average DPR"]) })), [playerSeasonRows]);
  const statA = (data?.stats || []).find(r => getPlayer(r) === compareA && getSeason(r) === season);
  const statB = (data?.stats || []).find(r => getPlayer(r) === compareB && getSeason(r) === season);

  if (!data) return <main className="min-h-screen bg-black p-6 text-white">Loading League Stats...</main>;
  const navItems: { id: Tab; label: string }[] = [{id:"dashboard",label:"Dashboard"},{id:"standings",label:"Standings"},{id:"weeks",label:"Weeks"},{id:"players",label:"Players"},{id:"compare",label:"Compare"}];

  return <main className="min-h-screen bg-[#070707] pb-24 text-white">
    <header className="border-b border-[#2a2a2a] bg-gradient-to-r from-black via-[#151515] to-[#f04a22]/20"><div className="mx-auto flex max-w-7xl flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between"><div className="flex items-center gap-4"><img src="/ec-logo.png" alt="Empire Cornhole" className="h-16 w-20 rounded-xl bg-white object-contain p-1"/><div><h1 className="text-3xl font-black tracking-tight">League Stats</h1><p className="text-sm text-neutral-300">Empire Cornhole standings, weekly results, and player stats.</p></div></div><div className="hidden gap-2 md:flex">{navItems.map(i=><button key={i.id} onClick={()=>setTab(i.id)} className={`rounded-full px-4 py-2 text-sm font-bold ${tab===i.id?"bg-[#f04a22] text-white":"bg-neutral-900 text-neutral-300 hover:bg-neutral-800"}`}>{i.label}</button>)}</div></div></header>
    <section className="mx-auto max-w-7xl p-4"><div className="rounded-2xl border border-neutral-800 bg-[#141414] p-4 shadow-xl"><div className="flex flex-col gap-3 md:flex-row md:items-end"><Select label="Season" value={season} onChange={(v)=>{setSeason(v);setDashboardWeek("All Weeks")}} options={seasons}/><Select label="Player" value={player} onChange={setPlayer} options={["All Players", ...players]}/><Select label="Dashboard Week" value={dashboardWeek} onChange={setDashboardWeek} options={dashboardWeeks}/><div className="text-sm text-neutral-400">Last updated: {data.lastUpdated ? new Date(data.lastUpdated).toLocaleString() : "No upload date found"}</div></div></div></section>
    <section className="mx-auto max-w-7xl space-y-6 p-4">
      {tab === "dashboard" && <><TopStandings rows={dashboardStandings} title={dashboardWeek === "All Weeks" ? "Top Standings" : `${dashboardWeek} Top Scores`} /><Card title={player === "All Players" ? `${season} Season Stats` : `${player} Season Stats`}><StatsTable rows={sortedSeasonStats} sortKey={sortKey} sortDirection={sortDirection} onSort={(key)=>{ if(sortKey===key) setSortDirection(sortDirection==="asc"?"desc":"asc"); else {setSortKey(key); setSortDirection("desc");}}}/></Card></>}
      {tab === "standings" && <Card title="Season Standings"><Table rows={standings}/></Card>}
      {tab === "weeks" && <Card title="Weekly Results"><div className="mb-4 flex flex-wrap gap-3"><select className="rounded-lg bg-[#242424] p-2" value={type} onChange={e=>{setType(e.target.value as any); setWeek("");}}><option>Blind</option><option>Swap</option></select><select className="rounded-lg bg-[#242424] p-2" value={week} onChange={e=>setWeek(e.target.value)}>{weeks.map(w=><option key={w}>{w}</option>)}</select></div><CombinedEventTable rows={selectedWeekCombined}/><EventSummary rows={selectedWeekStats}/></Card>}
      {tab === "players" && <Card title={selectedPlayer ? `${selectedPlayer} Profile` : "Player Profile"}>{!selectedPlayer ? <p className="text-neutral-400">Choose a player from the Player dropdown above.</p> : <div className="space-y-6"><div className="flex flex-wrap gap-3"><select className="rounded-lg bg-[#242424] p-2" value={profileSeason} onChange={e=>{setProfileSeason(e.target.value); setProfileWeek("All Weeks");}}><option>All Seasons</option>{seasons.map(s=><option key={s}>{s}</option>)}</select><select className="rounded-lg bg-[#242424] p-2" value={profileWeek} onChange={e=>setProfileWeek(e.target.value)}><option>All Weeks</option>{playerWeeks.map(w=><option key={w}>{w}</option>)}</select><select className="rounded-lg bg-[#242424] p-2" value={profileType} onChange={e=>setProfileType(e.target.value as EventFilter)}><option>All</option><option>Blind</option><option>Swap</option></select></div><PlayerStatsSummary row={playerSelectedStats}/><SeasonHistory rows={playerSeasonRows}/><ProgressChart rows={progressData}/><div className="space-y-4"><h3 className="text-lg font-black text-[#f04a22]">Weekly Breakdown</h3>{groupedPlayerWeeks.length===0?<p className="text-neutral-400">No weekly records found for this selection.</p>:groupedPlayerWeeks.map(([label, byType])=><div key={label} className="rounded-xl border border-neutral-800 bg-[#1c1c1c] p-4"><h4 className="mb-3 text-xl font-black">{label}</h4>{Object.entries(byType).map(([eventType, rows])=><div key={eventType} className="mb-4"><div className="mb-2 inline-block rounded-full bg-[#f04a22] px-3 py-1 text-xs font-black uppercase">{eventType}</div><CombinedEventTable rows={rows}/><EventSummary rows={rows.map(r=>r.stat).filter(Boolean)}/></div>)}</div>)}</div></div>}</Card>}
      {tab === "compare" && <Card title="Compare Players"><div className="mb-4 flex flex-wrap gap-3"><select className="rounded-lg bg-[#242424] p-2" value={compareA} onChange={e=>setCompareA(e.target.value)}><option value="">Player A</option>{players.map(p=><option key={p}>{p}</option>)}</select><select className="rounded-lg bg-[#242424] p-2" value={compareB} onChange={e=>setCompareB(e.target.value)}><option value="">Player B</option>{players.map(p=><option key={p}>{p}</option>)}</select></div><CompareTable a={statA} b={statB}/></Card>}
    </section>
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-neutral-800 bg-black/95 p-2 md:hidden"><div className="grid grid-cols-5 gap-1">{navItems.map(i=><button key={i.id} onClick={()=>setTab(i.id)} className={`rounded-lg px-2 py-3 text-xs font-bold ${tab===i.id?"bg-[#f04a22]":"bg-[#1d1d1d]"}`}>{i.label}</button>)}</div></nav>
  </main>;
}

function Select({label,value,onChange,options}:{label:string;value:string;onChange:(v:string)=>void;options:string[]}){return <div><label className="text-xs font-bold uppercase text-[#f04a22]">{label}</label><select className="block rounded-lg border border-neutral-700 bg-[#242424] p-2 text-white" value={value} onChange={e=>onChange(e.target.value)}>{options.map(o=><option key={o}>{o}</option>)}</select></div>}
function Card({title,children}:{title:string;children:React.ReactNode}){return <section className="rounded-2xl border border-neutral-800 bg-[#141414] p-4 shadow-xl"><h2 className="mb-4 text-xl font-black">{title}</h2>{children}</section>}
function TopStandings({rows,title}:{rows:any[];title:string}){return <Card title={title}><div className="grid gap-6 lg:grid-cols-[2fr_1fr]"><div className="h-96"><ResponsiveContainer width="100%" height="100%"><BarChart data={rows.slice(0,12)} margin={{top:25,right:10,left:0,bottom:80}}><XAxis dataKey="name" interval={0} angle={-35} textAnchor="end" height={90}/><YAxis/><Tooltip/><Bar dataKey="points" fill="#f04a22"><LabelList dataKey="points" position="top" fill="#fff"/></Bar></BarChart></ResponsiveContainer></div><div className="space-y-2">{rows.slice(0,12).map((r,i)=><div key={r.name+i} className="flex items-center justify-between rounded-lg bg-[#202020] px-3 py-2"><span className="font-bold">{i+1}. {r.name}</span><span className="font-black text-[#f04a22]">{formatValue(r.points,0)}</span></div>)}</div></div></Card>}
function Table({rows}:{rows:any[]}){return <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-neutral-400"><th className="p-2">#</th><th className="p-2">Player</th><th className="p-2">Points</th></tr></thead><tbody>{rows.map((r,i)=><tr key={`${r.name}-${i}`} className="border-t border-neutral-800"><td className="p-2">{i+1}</td><td className="p-2 font-bold">{r.name}</td><td className="p-2 text-[#f04a22]">{formatValue(r.points,0)}</td></tr>)}</tbody></table></div>}
function StatsTable({rows,sortKey,sortDirection,onSort}:{rows:any[];sortKey:string;sortDirection:SortDirection;onSort:(k:string)=>void}){return <><div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[1150px] text-[12px]"><thead><tr className="text-left text-neutral-400"><th className="sticky left-0 z-10 bg-[#141414] p-2">Player</th>{statColumns.map(c=><th key={c.label} onClick={()=>onSort(c.label)} className="cursor-pointer whitespace-nowrap p-2 hover:text-[#f04a22]">{c.label}{sortKey===c.label?(sortDirection==="asc"?" ▲":" ▼"):""}</th>)}</tr></thead><tbody>{rows.map((r,i)=><tr key={`${getPlayer(r)}-${i}`} className="border-t border-neutral-800"><td className="sticky left-0 z-10 bg-[#141414] p-2 font-bold">{getPlayer(r)}</td>{statColumns.map(c=><td key={c.label} className="whitespace-nowrap p-2">{formatValue(getStatValue(r,c.keys),c.decimals)}</td>)}</tr>)}</tbody></table></div><div className="space-y-3 md:hidden">{rows.map((r,i)=><div key={i} className="rounded-xl border border-neutral-800 bg-[#202020] p-3"><div className="mb-2 font-black text-[#f04a22]">{getPlayer(r)}</div><div className="grid grid-cols-2 gap-2 text-sm">{statColumns.map(c=><div key={c.label}><div className="text-xs text-neutral-500">{c.label}</div><div className="font-bold">{formatValue(getStatValue(r,c.keys),c.decimals)}</div></div>)}</div></div>)}</div></>}
function PlayerStatsSummary({row}:{row:any}){if(!row)return <p className="text-neutral-400">No season stats found for this player.</p>; return <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-5">{statColumns.map(c=><div key={c.label} className="rounded-xl border border-neutral-800 bg-[#202020] p-4"><div className="text-xs font-bold uppercase text-neutral-400">{c.label}</div><div className="mt-1 text-2xl font-black text-[#f04a22]">{formatValue(getStatValue(row,c.keys),c.decimals)}</div></div>)}</div>}
function SeasonHistory({rows}:{rows:any[]}){return <div><h3 className="mb-3 text-lg font-black text-[#f04a22]">Season Finishes</h3><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-neutral-400"><th className="p-2">Season</th><th className="p-2">Finish</th><th className="p-2">PPR</th><th className="p-2">DPR</th><th className="p-2">OPPR</th><th className="p-2">Points</th><th className="p-2">Rounds</th><th className="p-2">4 Baggers</th></tr></thead><tbody>{rows.map(r=><tr key={getSeason(r)} className="border-t border-neutral-800"><td className="p-2 font-bold">{getSeason(r)}</td><td className="p-2 text-[#f04a22]">{formatValue(getStatValue(r,["1st in Stats"]),0)}</td><td className="p-2">{formatValue(getStatValue(r,["Average PPR"]),2)}</td><td className="p-2">{formatValue(getStatValue(r,["Average DPR"]),2)}</td><td className="p-2">{formatValue(getStatValue(r,["Opponents Avg PPR"]),2)}</td><td className="p-2">{formatValue(getStatValue(r,["Total Pts"]),0)}</td><td className="p-2">{formatValue(getStatValue(r,["Total Rounds"]),0)}</td><td className="p-2">{formatValue(getStatValue(r,["Total 4-Baggers"]),0)}</td></tr>)}</tbody></table></div></div>}
function ProgressChart({rows}:{rows:any[]}){return <div><h3 className="mb-3 text-lg font-black text-[#f04a22]">Progress Over Time</h3><div className="h-72 rounded-xl border border-neutral-800 p-3"><ResponsiveContainer width="100%" height="100%"><LineChart data={rows}><CartesianGrid strokeDasharray="3 3" stroke="#333"/><XAxis dataKey="season"/><YAxis/><Tooltip/><Legend/><Line type="monotone" dataKey="DPR" stroke="#ffffff" strokeWidth={3}/><Line type="monotone" dataKey="PPR" stroke="#f04a22" strokeWidth={3}/></LineChart></ResponsiveContainer></div></div>}
function CombinedEventTable({rows}:{rows:{standing:any;stat:any}[]}){return <div className="overflow-x-auto"><table className="w-full text-[12px]"><thead><tr className="text-left text-neutral-400"><th className="p-2">Rank</th><th className="p-2">Player</th><th className="p-2">Team</th><th className="p-2">Finish Pts</th><th className="p-2">+/-</th>{eventStatColumns.map(c=><th key={c.label} className="p-2">{c.label}</th>)}</tr></thead><tbody>{rows.map(({standing,stat},i)=><tr key={i} className="border-t border-neutral-800"><td className="p-2">{formatValue(standing.Rank,0)}</td><td className="p-2 font-bold text-[#f04a22]">{getPlayer(standing)}</td><td className="p-2">{standing.Team || "-"}</td><td className="p-2">{formatValue(standing.Points,0)}</td><td className="p-2">{standing["+/-"] || standing["+ / -"] || "-"}</td>{eventStatColumns.map(c=><td key={c.label} className="p-2">{stat ? formatValue(getStatValue(stat,c.keys),c.decimals) : "-"}</td>)}</tr>)}</tbody></table></div>}
function EventSummary({rows}:{rows:any[]}){const s=summarizeEventStats(rows); return <div className="mt-4 rounded-xl border border-neutral-800 bg-[#202020] p-4"><h3 className="mb-3 text-lg font-black text-[#f04a22]">Event Totals / Averages</h3><div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4"><MiniStat label="Players" value={s.players}/><MiniStat label="Total Rounds" value={s.totalRounds}/><MiniStat label="Total Points" value={s.totalPoints}/><MiniStat label="Avg PPR" value={s.avgPPR}/><MiniStat label="Avg OPPR" value={s.avgOPPR}/><MiniStat label="Avg DPR" value={s.avgDPR}/><MiniStat label="Opp Points" value={s.oppPoints}/><MiniStat label="4 Baggers" value={s.fourBaggers}/></div></div>}
function MiniStat({label,value}:{label:string;value:any}){return <div className="rounded-lg bg-[#151515] p-3"><div className="text-xs font-bold uppercase text-neutral-400">{label}</div><div className="text-2xl font-black text-[#f04a22]">{value}</div></div>}
function CompareTable({a,b}:{a:any;b:any}){return <div className="overflow-x-auto"><table className="w-full text-sm"><tbody>{statColumns.map(c=><tr key={c.label} className="border-t border-neutral-800"><td className="p-2 text-neutral-400">{c.label}</td><td className="p-2">{formatValue(getStatValue(a,c.keys),c.decimals)}</td><td className="p-2">{formatValue(getStatValue(b,c.keys),c.decimals)}</td></tr>)}</tbody></table></div>}
