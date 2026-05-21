"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LabelList,
  LineChart,
  Line,
  CartesianGrid,
  Legend,
} from "recharts";

type Data = {
  lastUpdated?: string;
  seasons: string[];
  players: string[];
  standings: any[];
  weekly: any[];
  stats: any[];
  eventStats?: any[];
};

type Tab = "dashboard" | "standings" | "weeks" | "players" | "compare";
type EventFilter = "All" | "Blind" | "Swap";
type SortDirection = "asc" | "desc";

function clean(value: any) {
  return String(value ?? "").trim();
}

function norm(value: any) {
  return clean(value).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function getAny(row: any, keys: string[]) {
  if (!row) return "";
  const lookup = new Map<string, string>();
  Object.keys(row).forEach((key) => lookup.set(norm(key), key));
  for (const key of keys) {
    const actual = lookup.get(norm(key));
    if (actual && row[actual] !== undefined && row[actual] !== "") return row[actual];
  }
  return "";
}

function getSeason(row: any, fallback = "") {
  return clean(getAny(row, ["Season", "season", "SEASON"]) || fallback);
}

function getPlayer(row: any) {
  const direct = getAny(row, ["Player", "playerName", "Row Labels", "Player Name", "PLAYER NAME", "Name"]);
  if (direct) return clean(direct);
  const first = clean(getAny(row, ["First", "First Name", "playerFirstName"]));
  const last = clean(getAny(row, ["Last", "Last Name", "playerLastName"]));
  return `${first} ${last}`.trim();
}

function getWeek(row: any) {
  const raw = clean(getAny(row, ["Week", "week", "WEEK"]));
  if (!raw) return "";
  if (/^\d+$/.test(raw)) return `Week ${raw}`;
  return raw.replace(/week\s*/i, "Week ").replace(/\s+/g, " ").trim();
}

function getType(row: any) {
  const raw = clean(getAny(row, ["Type", "type", "TYPE", "Event", "Format"]));
  const lowered = raw.toLowerCase();
  if (lowered.includes("blind")) return "Blind";
  if (lowered.includes("swap")) return "Swap";
  return raw;
}

function numberVal(value: any) {
  const n = Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function getStatValue(row: any, keys: string[]) {
  for (const key of keys) {
    const val = getAny(row, [key]);
    if (val !== undefined && val !== "") return val;
  }
  return "";
}

function getStatNumber(row: any, keys: string[]) {
  return numberVal(getStatValue(row, keys));
}

function formatValue(value: any, decimals = 2) {
  if (value === "" || value === null || value === undefined) return "-";
  const n = numberVal(value);
  if (!Number.isFinite(n)) return String(value);
  if (String(value).includes("%")) return `${n.toFixed(2)}%`;
  if (Math.abs(n) >= 100 || Number.isInteger(n)) return String(Math.round(n));
  return n.toFixed(decimals);
}

function weekSort(a: string, b: string) {
  const an = Number(a.replace(/[^0-9]/g, ""));
  const bn = Number(b.replace(/[^0-9]/g, ""));
  return an - bn;
}

function seasonParts(season: string) {
  const match = clean(season).match(/(Spring|Summer|Fall|Winter)\s*(\d{2,4})/i);
  const order: Record<string, number> = { spring: 1, summer: 2, fall: 3, winter: 4 };
  if (!match) return { year: 9999, order: 99 };
  return { year: Number(match[2].slice(-2)), order: order[match[1].toLowerCase()] ?? 99 };
}

function seasonSort(a: string, b: string) {
  const ap = seasonParts(a);
  const bp = seasonParts(b);
  if (ap.year !== bp.year) return ap.year - bp.year;
  if (ap.order !== bp.order) return ap.order - bp.order;
  return a.localeCompare(b);
}

function pointValue(row: any) {
  return numberVal(getAny(row, ["Overall", "Total", "Total Points", "Points", "Overall Points"]));
}

function weeklyScore(row: any, week: string) {
  const weekNumber = clean(week).replace(/[^0-9]/g, "");
  return numberVal(getAny(row, [week, `Week ${weekNumber}`, `Wk ${weekNumber}`, `W${weekNumber}`]));
}

const statColumns = [
  { label: "Total Rounds", keys: ["Total Rounds"], decimals: 0 },
  { label: "Total Pts", keys: ["Total Pts"], decimals: 0 },
  { label: "Average PPR", keys: ["Average PPR", "PPR"], decimals: 2 },
  { label: "Opp Avg PPR", keys: ["Opponents Avg PPR", "OPPR", "Opponent PPR"], decimals: 2 },
  { label: "Average DPR", keys: ["Average DPR", "DPR"], decimals: 2 },
  { label: "Opp Pts", keys: ["Opponents Pts", "Opp Pts"], decimals: 0 },
  { label: "Avg Bags In", keys: ["Avg Bags In"], decimals: 2 },
  { label: "Total Bags In", keys: ["Total Bags In"], decimals: 0 },
  { label: "Avg Bags In/Rd", keys: ["Avg Bags In per Rd"], decimals: 2 },
  { label: "Bags On %", keys: ["Bags On %"], decimals: 2 },
  { label: "Bags Off %", keys: ["Bags Off %"], decimals: 2 },
  { label: "Total Bags", keys: ["Total Bags Thrown"], decimals: 0 },
  { label: "Avg 4-Bagger %", keys: ["Avg 4-Bagger %"], decimals: 2 },
  { label: "Total 4-Baggers", keys: ["Total 4-Baggers", "4 Baggers"], decimals: 0 },
  { label: "1st in Stats", keys: ["1st in Stats"], decimals: 0 },
  { label: "Avg Rounds/Swap", keys: ["Avg Rounds/Swap Game"], decimals: 2 },
];

const eventStatColumns = [
  { label: "Rank", keys: ["Rank", "Ranking", "RANK"], decimals: 0 },
  { label: "PPR", keys: ["PPR", "Average PPR"], decimals: 2 },
  { label: "Rounds", keys: ["Rounds", "Total Rounds"], decimals: 0 },
  { label: "Points", keys: ["Points", "Total Pts", "Total Points"], decimals: 0 },
  { label: "OPPR", keys: ["OPPR", "Opponents Avg PPR", "Opponent PPR"], decimals: 2 },
  { label: "Opp Pts", keys: ["Opp Pts", "Opponents Pts"], decimals: 0 },
  { label: "DPR", keys: ["DPR", "Average DPR"], decimals: 2 },
  { label: "4 Baggers", keys: ["4 Baggers", "Total 4-Baggers"], decimals: 0 },
];

function isStandingRow(row: any) {
  return row?.rowKind === "standing" || !!getAny(row, ["Team", "+/-", "Wins", "Losses"]);
}

function isStatRow(row: any) {
  return row?.rowKind === "stat" || !isStandingRow(row);
}

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

  useEffect(() => {
    fetch("/api/data")
      .then((res) => res.json())
      .then((loaded) => {
        const sortedSeasons = [...(loaded.seasons || [])].sort(seasonSort);
        setData({ ...loaded, seasons: sortedSeasons });
        setSeason(sortedSeasons[sortedSeasons.length - 1] || "");
        setProfileSeason("All Seasons");
      });
  }, []);

  const seasons = data?.seasons || [];
  const players = data?.players || [];
  const selectedProfilePlayer = player !== "All Players" ? player : "";

  const seasonRows = useMemo(() => (data?.standings || []).filter((row) => getSeason(row) === season), [data, season]);

  const dashboardWeeks = useMemo(() => {
    const fromOverall = new Set<string>();
    for (const row of seasonRows) {
      Object.keys(row).forEach((key) => {
        if (/^week\s*\d+/i.test(key)) fromOverall.add(key.replace(/week\s*/i, "Week ").trim());
      });
    }
    return ["All Weeks", ...Array.from(fromOverall).sort(weekSort)];
  }, [seasonRows]);

  const dashboardStandings = useMemo(() => {
    return seasonRows
      .filter((row) => player === "All Players" || getPlayer(row) === player)
      .map((row) => ({
        name: getPlayer(row),
        points: dashboardWeek === "All Weeks" ? pointValue(row) : weeklyScore(row, dashboardWeek),
        raw: row,
      }))
      .filter((row) => row.name && row.points !== 0)
      .sort((a, b) => b.points - a.points);
  }, [seasonRows, player, dashboardWeek]);

  const seasonStats = useMemo(() => {
    const rows = (data?.stats || [])
      .filter((row) => getSeason(row) === season)
      .filter((row) => player === "All Players" || getPlayer(row) === player)
      .filter((row) => getPlayer(row));
    const selectedColumn = statColumns.find((col) => col.label === sortKey);
    return rows.sort((a, b) => {
      if (!selectedColumn) return getPlayer(a).localeCompare(getPlayer(b));
      const av = getStatNumber(a, selectedColumn.keys);
      const bv = getStatNumber(b, selectedColumn.keys);
      if (av === bv) return getPlayer(a).localeCompare(getPlayer(b));
      return sortDirection === "asc" ? av - bv : bv - av;
    });
  }, [data, season, player, sortKey, sortDirection]);

  const weekStandingRows = useMemo(() => {
    return (data?.weekly || [])
      .filter(isStandingRow)
      .filter((row) => getSeason(row) === season)
      .filter((row) => getType(row) === type);
  }, [data, season, type]);

  const weeks = useMemo(() => Array.from(new Set(weekStandingRows.map(getWeek).filter(Boolean))).sort(weekSort), [weekStandingRows]);

  useEffect(() => {
    if (!week || !weeks.includes(week)) setWeek(weeks[0] || "");
  }, [weeks, week]);

  const visibleWeekStandings = weekStandingRows.filter((row) => getWeek(row) === week);

  const eventStats = useMemo(() => {
    const rows = data?.eventStats?.length ? data.eventStats : (data?.weekly || []).filter(isStatRow);
    return rows.filter((row) => getSeason(row) === season);
  }, [data, season]);

  const visibleEventStats = eventStats.filter((row) => getWeek(row) === week && getType(row) === type);

  const playerSeasonRows = useMemo(() => {
    if (!selectedProfilePlayer) return [];
    return (data?.stats || [])
      .filter((row) => getPlayer(row) === selectedProfilePlayer)
      .filter((row) => profileSeason === "All Seasons" || getSeason(row) === profileSeason)
      .sort((a, b) => seasonSort(getSeason(a), getSeason(b)));
  }, [data, selectedProfilePlayer, profileSeason]);

  const playerSeasonStats = profileSeason === "All Seasons" ? null : playerSeasonRows[0] || null;

  const playerWeeklyRows = useMemo(() => {
    if (!selectedProfilePlayer) return [];
    const rows = data?.weekly || [];
    return rows
      .filter((row) => getPlayer(row) === selectedProfilePlayer)
      .filter((row) => profileSeason === "All Seasons" || getSeason(row) === profileSeason)
      .filter((row) => profileWeek === "All Weeks" || getWeek(row) === profileWeek)
      .filter((row) => profileType === "All" || getType(row) === profileType)
      .sort((a, b) => {
        const seasonCompare = seasonSort(getSeason(a), getSeason(b));
        if (seasonCompare !== 0) return seasonCompare;
        const weekCompare = weekSort(getWeek(a), getWeek(b));
        if (weekCompare !== 0) return weekCompare;
        if (isStandingRow(a) !== isStandingRow(b)) return isStandingRow(a) ? -1 : 1;
        return getType(a).localeCompare(getType(b));
      });
  }, [data, selectedProfilePlayer, profileSeason, profileWeek, profileType]);

  const playerWeeks = useMemo(() => {
    if (!selectedProfilePlayer) return [];
    return Array.from(new Set((data?.weekly || [])
      .filter((row) => getPlayer(row) === selectedProfilePlayer)
      .filter((row) => profileSeason === "All Seasons" || getSeason(row) === profileSeason)
      .map(getWeek)
      .filter(Boolean))).sort(weekSort);
  }, [data, selectedProfilePlayer, profileSeason]);

  const groupedPlayerWeeks = useMemo(() => {
    const groups: Record<string, Record<string, any[]>> = {};
    for (const row of playerWeeklyRows) {
      const key = `${getSeason(row)} - ${getWeek(row)}`;
      const typeKey = getType(row) || "Other";
      if (!groups[key]) groups[key] = {};
      if (!groups[key][typeKey]) groups[key][typeKey] = [];
      groups[key][typeKey].push(row);
    }
    return Object.entries(groups);
  }, [playerWeeklyRows]);

  const playerHistory = useMemo(() => {
    if (!selectedProfilePlayer) return [];
    return (data?.stats || [])
      .filter((row) => getPlayer(row) === selectedProfilePlayer)
      .map((row) => {
        const standingRows = (data?.standings || []).filter((s) => getSeason(s) === getSeason(row)).sort((a, b) => pointValue(b) - pointValue(a));
        const finish = standingRows.findIndex((s) => getPlayer(s) === selectedProfilePlayer) + 1;
        return {
          season: getSeason(row),
          finish: finish || "-",
          ppr: getStatNumber(row, ["Average PPR", "PPR"]),
          dpr: getStatNumber(row, ["Average DPR", "DPR"]),
          oppr: getStatNumber(row, ["Opponents Avg PPR", "OPPR"]),
          points: getStatNumber(row, ["Total Pts", "Points"]),
          rounds: getStatNumber(row, ["Total Rounds", "Rounds"]),
          fourBaggers: getStatNumber(row, ["Total 4-Baggers", "4 Baggers"]),
          row,
        };
      })
      .sort((a, b) => seasonSort(a.season, b.season));
  }, [data, selectedProfilePlayer]);

  const statA = (data?.stats || []).find((row) => getPlayer(row) === compareA && getSeason(row) === season);
  const statB = (data?.stats || []).find((row) => getPlayer(row) === compareB && getSeason(row) === season);

  if (!data) return <main className="min-h-screen bg-black p-6 text-white">Loading League Stats...</main>;

  const navItems: { id: Tab; label: string }[] = [
    { id: "dashboard", label: "Dashboard" },
    { id: "standings", label: "Standings" },
    { id: "weeks", label: "Weeks" },
    { id: "players", label: "Players" },
    { id: "compare", label: "Compare" },
  ];

  return (
    <main className="min-h-screen bg-[#070707] pb-24 text-white">
      <header className="border-b border-[#2a2a2a] bg-gradient-to-r from-black via-[#151515] to-[#f04a22]/20">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <img src="/ec-logo.png" alt="Empire Cornhole" className="h-16 w-20 rounded-xl bg-white object-contain p-1" />
            <div>
              <h1 className="text-3xl font-black tracking-tight">League Stats</h1>
              <p className="text-sm text-neutral-300">Empire Cornhole standings, weekly results, and player stats.</p>
            </div>
          </div>
          <div className="hidden gap-2 md:flex">
            {navItems.map((item) => (
              <button key={item.id} onClick={() => setTab(item.id)} className={`rounded-full px-4 py-2 text-sm font-bold ${tab === item.id ? "bg-[#f04a22] text-white" : "bg-neutral-900 text-neutral-300 hover:bg-neutral-800"}`}>{item.label}</button>
            ))}
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl p-4">
        <div className="rounded-2xl border border-neutral-800 bg-[#141414] p-4 shadow-xl">
          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            <Select label="Season" value={season} onChange={(v) => { setSeason(v); setDashboardWeek("All Weeks"); }} options={seasons} />
            <Select label="Player" value={player} onChange={(v) => setPlayer(v)} options={["All Players", ...players]} />
            <Select label="Dashboard Week" value={dashboardWeek} onChange={setDashboardWeek} options={dashboardWeeks} />
            <div className="text-sm text-neutral-400">Last updated: {data.lastUpdated ? new Date(data.lastUpdated).toLocaleString() : "No upload date found"}</div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl space-y-6 p-4">
        {tab === "dashboard" && (
          <>
            <Card title={dashboardWeek === "All Weeks" ? "Top Standings" : `Top Standings - ${dashboardWeek}`}>
              <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
                <div className="h-96">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dashboardStandings.slice(0, 12)} margin={{ top: 20, right: 10, left: 0, bottom: 85 }}>
                      <XAxis dataKey="name" interval={0} angle={-30} textAnchor="end" height={90} />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="points" fill="#f04a22"><LabelList dataKey="points" position="top" fill="#fff" /></Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2">
                  {dashboardStandings.slice(0, 12).map((row, index) => (
                    <div key={`${row.name}-${index}`} className="flex items-center justify-between rounded-lg bg-[#202020] px-3 py-2">
                      <span className="font-bold">{index + 1}. {row.name}</span>
                      <span className="font-black text-[#f04a22]">{formatValue(row.points, 0)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
            <Card title={player === "All Players" ? "Season Stats" : `${player} Season Stats`}>
              {player === "All Players" ? <StatsTable rows={seasonStats} sortKey={sortKey} sortDirection={sortDirection} onSort={(key) => { if (sortKey === key) setSortDirection(sortDirection === "asc" ? "desc" : "asc"); else { setSortKey(key); setSortDirection("desc"); } }} /> : <PlayerStatsSummary row={seasonStats[0]} />}
            </Card>
          </>
        )}

        {tab === "standings" && <Card title="Season Standings"><StandingsTable rows={dashboardStandings} /></Card>}

        {tab === "weeks" && (
          <Card title="Weekly Results">
            <div className="mb-4 flex flex-wrap gap-3">
              <select className="rounded-lg bg-[#242424] p-2" value={type} onChange={(e) => { setType(e.target.value as "Blind" | "Swap"); setWeek(""); }}><option>Blind</option><option>Swap</option></select>
              <select className="rounded-lg bg-[#242424] p-2" value={week} onChange={(e) => setWeek(e.target.value)}>{weeks.map((w) => <option key={w}>{w}</option>)}</select>
            </div>
            <h3 className="mb-2 text-lg font-black text-[#f04a22]">Standings</h3>
            <WeeklyStandingsTable rows={visibleWeekStandings} eventStats={visibleEventStats} />
            <h3 className="mb-2 mt-6 text-lg font-black text-[#f04a22]">Event Totals / Averages</h3>
            <EventSummary rows={visibleEventStats} />
          </Card>
        )}

        {tab === "players" && (
          <Card title={selectedProfilePlayer ? `${selectedProfilePlayer} Profile` : "Player Profile"}>
            {!selectedProfilePlayer ? <p className="text-neutral-400">Use the Player dropdown above to select a player.</p> : (
              <div className="space-y-6">
                <div className="flex flex-wrap gap-3">
                  <select className="rounded-lg bg-[#242424] p-2" value={profileSeason} onChange={(e) => { setProfileSeason(e.target.value); setProfileWeek("All Weeks"); }}><option>All Seasons</option>{seasons.map((s) => <option key={s}>{s}</option>)}</select>
                  <select className="rounded-lg bg-[#242424] p-2" value={profileWeek} onChange={(e) => setProfileWeek(e.target.value)}><option>All Weeks</option>{playerWeeks.map((w) => <option key={w}>{w}</option>)}</select>
                  <select className="rounded-lg bg-[#242424] p-2" value={profileType} onChange={(e) => setProfileType(e.target.value as EventFilter)}><option>All</option><option>Blind</option><option>Swap</option></select>
                </div>
                {profileSeason !== "All Seasons" ? <PlayerStatsSummary row={playerSeasonStats} /> : <PlayerStatsSummary row={playerSeasonRows[playerSeasonRows.length - 1]} />}
                <h3 className="text-lg font-black text-[#f04a22]">Season Finishes</h3>
                <SeasonHistoryTable rows={playerHistory} />
                <h3 className="text-lg font-black text-[#f04a22]">Progress Over Time</h3>
                <div className="h-72 rounded-xl border border-neutral-800 bg-[#151515] p-4">
                  <ResponsiveContainer width="100%" height="100%"><LineChart data={playerHistory}><CartesianGrid strokeDasharray="3 3" stroke="#333" /><XAxis dataKey="season" /><YAxis /><Tooltip /><Legend /><Line type="monotone" dataKey="ppr" name="PPR" stroke="#f04a22" strokeWidth={3} /><Line type="monotone" dataKey="dpr" name="DPR" stroke="#ffffff" strokeWidth={3} /></LineChart></ResponsiveContainer>
                </div>
                <h3 className="text-lg font-black text-[#f04a22]">Weekly Breakdown</h3>
                {groupedPlayerWeeks.length === 0 ? <p className="text-neutral-400">No weekly records found for this selection.</p> : groupedPlayerWeeks.map(([label, byType]) => (
                  <div key={label} className="rounded-xl border border-neutral-800 bg-[#1c1c1c] p-4">
                    <h4 className="mb-3 text-xl font-black">{label}</h4>
                    {Object.entries(byType).map(([eventType, rows]) => {
                      const standings = rows.filter(isStandingRow);
                      const stats = rows.filter(isStatRow);
                      return <div key={eventType} className="mb-5"><div className="mb-2 inline-block rounded-full bg-[#f04a22] px-3 py-1 text-xs font-black uppercase">{eventType}</div><WeeklyStandingsTable rows={standings} eventStats={stats} compact /><EventSummary rows={stats} /></div>;
                    })}
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {tab === "compare" && <Card title="Compare Players"><div className="mb-4 flex flex-wrap gap-3"><select className="rounded-lg bg-[#242424] p-2" value={compareA} onChange={(e) => setCompareA(e.target.value)}><option value="">Player A</option>{players.map((p) => <option key={p}>{p}</option>)}</select><select className="rounded-lg bg-[#242424] p-2" value={compareB} onChange={(e) => setCompareB(e.target.value)}><option value="">Player B</option>{players.map((p) => <option key={p}>{p}</option>)}</select></div><CompareTable a={statA} b={statB} /></Card>}
      </section>

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-neutral-800 bg-black/95 p-2 md:hidden"><div className="grid grid-cols-5 gap-1">{navItems.map((item) => <button key={item.id} onClick={() => setTab(item.id)} className={`rounded-lg px-2 py-3 text-xs font-bold ${tab === item.id ? "bg-[#f04a22]" : "bg-[#1d1d1d]"}`}>{item.label}</button>)}</div></nav>
    </main>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return <div><label className="text-xs font-bold uppercase text-[#f04a22]">{label}</label><select className="block rounded-lg border border-neutral-700 bg-[#242424] p-2 text-white" value={value} onChange={(e) => onChange(e.target.value)}>{options.map((o) => <option key={o}>{o}</option>)}</select></div>;
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-neutral-800 bg-[#141414] p-4 shadow-xl"><h2 className="mb-4 text-xl font-black">{title}</h2>{children}</section>;
}

function StandingsTable({ rows }: { rows: any[] }) {
  return <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-neutral-400"><th className="p-2">#</th><th className="p-2">Player</th><th className="p-2">Points</th></tr></thead><tbody>{rows.map((row, index) => <tr key={`${row.name}-${index}`} className="border-t border-neutral-800"><td className="p-2">{index + 1}</td><td className="p-2 font-bold">{row.name}</td><td className="p-2 text-[#f04a22]">{formatValue(row.points, 0)}</td></tr>)}</tbody></table></div>;
}

function StatsTable({ rows, sortKey, sortDirection, onSort }: { rows: any[]; sortKey: string; sortDirection: SortDirection; onSort: (key: string) => void }) {
  return <><div className="hidden overflow-x-auto md:block"><table className="w-full text-[11px]"><thead><tr className="text-left text-neutral-400"><th className="p-2">Player</th>{statColumns.map((col) => <th key={col.label} className="cursor-pointer whitespace-nowrap p-2 hover:text-[#f04a22]" onClick={() => onSort(col.label)}>{col.label}{sortKey === col.label ? (sortDirection === "asc" ? " ▲" : " ▼") : ""}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={`${getPlayer(row)}-${index}`} className="border-t border-neutral-800"><td className="p-2 font-bold text-white">{getPlayer(row)}</td>{statColumns.map((col) => <td key={col.label} className="whitespace-nowrap p-2 text-neutral-300">{formatValue(getStatValue(row, col.keys), col.decimals)}</td>)}</tr>)}</tbody></table></div><div className="grid gap-3 md:hidden">{rows.map((row) => <div key={getPlayer(row)} className="rounded-xl border border-neutral-800 bg-[#202020] p-4"><div className="mb-2 text-lg font-black text-[#f04a22]">{getPlayer(row)}</div><div className="grid grid-cols-2 gap-2 text-sm">{statColumns.map((col) => <div key={col.label}><div className="text-xs text-neutral-500">{col.label}</div><div className="font-bold">{formatValue(getStatValue(row, col.keys), col.decimals)}</div></div>)}</div></div>)}</div></>;
}

function PlayerStatsSummary({ row }: { row: any }) {
  if (!row) return <p className="text-neutral-400">No season stats found for this player.</p>;
  return <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-5">{statColumns.map((col) => <div key={col.label} className="rounded-xl border border-neutral-800 bg-[#202020] p-4"><div className="text-xs font-bold uppercase text-neutral-400">{col.label}</div><div className="mt-1 text-2xl font-black text-[#f04a22]">{formatValue(getStatValue(row, col.keys), col.decimals)}</div></div>)}</div>;
}

function WeeklyStandingsTable({ rows, eventStats, compact = false }: { rows: any[]; eventStats: any[]; compact?: boolean }) {
  const statFor = (standing: any) => eventStats.find((s) => getPlayer(s) === getPlayer(standing)) || null;
  return <div className="overflow-x-auto"><table className="w-full text-[12px]"><thead><tr className="text-left text-neutral-400"><th className="p-2">Rank</th><th className="p-2">Player</th><th className="p-2">Team</th><th className="p-2">Points</th><th className="p-2">+/-</th>{eventStatColumns.slice(1).map((c) => <th key={c.label} className="p-2">{c.label}</th>)}</tr></thead><tbody>{rows.map((row, index) => { const stat = statFor(row); return <tr key={index} className="border-t border-neutral-800"><td className="p-2">{formatValue(getAny(row, ["Rank", "RANK"]), 0)}</td><td className="p-2 font-bold text-[#f04a22]">{getPlayer(row)}</td><td className="p-2">{clean(getAny(row, ["Team"])) || "-"}</td><td className="p-2">{formatValue(getAny(row, ["Points"]), 0)}</td><td className="p-2">{formatValue(getAny(row, ["+/-", "+ / -"]), 0)}</td>{eventStatColumns.slice(1).map((col) => <td key={col.label} className="p-2">{formatValue(getStatValue(stat, col.keys), col.decimals)}</td>)}</tr>; })}{rows.length === 0 && <tr><td className="p-2 text-neutral-500" colSpan={12}>No rows found.</td></tr>}</tbody></table></div>;
}

function EventSummary({ rows }: { rows: any[] }) {
  const avg = (keys: string[]) => { const vals = rows.map((r) => getStatNumber(r, keys)).filter((n) => n !== 0); return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0; };
  const sum = (keys: string[]) => rows.reduce((acc, r) => acc + getStatNumber(r, keys), 0);
  const items = [
    ["Players", rows.length, 0],
    ["Total Rounds", sum(["Rounds", "Total Rounds"]), 0],
    ["Total Points", sum(["Points", "Total Pts"]), 0],
    ["Avg PPR", avg(["PPR", "Average PPR"]), 2],
    ["Avg OPPR", avg(["OPPR", "Opponent PPR", "Opponents Avg PPR"]), 2],
    ["Avg DPR", avg(["DPR", "Average DPR"]), 2],
    ["Opp Points", sum(["Opp Pts", "Opponents Pts"]), 0],
    ["4 Baggers", sum(["4 Baggers", "Total 4-Baggers"]), 0],
  ] as const;
  return <div className="rounded-xl border border-neutral-800 bg-[#202020] p-4"><div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">{items.map(([label, value, decimals]) => <div key={label} className="rounded-lg bg-[#151515] p-3"><div className="text-xs font-bold uppercase text-neutral-400">{label}</div><div className="text-2xl font-black text-[#f04a22]">{formatValue(value, decimals)}</div></div>)}</div></div>;
}

function SeasonHistoryTable({ rows }: { rows: any[] }) {
  return <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-neutral-400"><th className="p-2">Season</th><th className="p-2">Finish</th><th className="p-2">PPR</th><th className="p-2">DPR</th><th className="p-2">OPPR</th><th className="p-2">Points</th><th className="p-2">Rounds</th><th className="p-2">4 Baggers</th></tr></thead><tbody>{rows.map((row) => <tr key={row.season} className="border-t border-neutral-800"><td className="p-2 font-bold">{row.season}</td><td className="p-2 text-[#f04a22]">{row.finish}</td><td className="p-2">{formatValue(row.ppr, 2)}</td><td className="p-2">{formatValue(row.dpr, 2)}</td><td className="p-2">{formatValue(row.oppr, 2)}</td><td className="p-2">{formatValue(row.points, 0)}</td><td className="p-2">{formatValue(row.rounds, 0)}</td><td className="p-2">{formatValue(row.fourBaggers, 0)}</td></tr>)}</tbody></table></div>;
}

function CompareTable({ a, b }: { a: any; b: any }) {
  return <div className="overflow-x-auto"><table className="w-full text-sm"><tbody>{statColumns.map((col) => <tr key={col.label} className="border-t border-neutral-800"><td className="p-2 text-neutral-400">{col.label}</td><td className="p-2">{formatValue(getStatValue(a, col.keys), col.decimals)}</td><td className="p-2">{formatValue(getStatValue(b, col.keys), col.decimals)}</td></tr>)}</tbody></table></div>;
}
