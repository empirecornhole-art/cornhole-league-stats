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
  eventStats?: any[];
  stats: any[];
};

type Tab = "dashboard" | "standings" | "weeks" | "players" | "compare";
type EventFilter = "All" | "Blind" | "Swap";
type SortDirection = "asc" | "desc";

function clean(value: any) {
  return String(value ?? "").trim();
}

function compact(value: any) {
  return clean(value).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function normalizeText(value: any) {
  return clean(value).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function normalizeName(value: any) {
  return clean(value).toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
}

function getSeason(row: any, fallback = "") {
  return clean(row?.Season || row?.season || row?.SEASON || fallback);
}

function seasonSortValue(season: string) {
  const text = clean(season);
  const yearMatch = text.match(/(\d{2,4})/);
  const rawYear = yearMatch ? Number(yearMatch[1]) : 0;
  const year = rawYear < 100 ? 2000 + rawYear : rawYear;
  const lower = text.toLowerCase();
  const seasonOrder = lower.includes("spring")
    ? 1
    : lower.includes("summer")
    ? 2
    : lower.includes("fall")
    ? 3
    : lower.includes("winter")
    ? 4
    : 9;
  return year * 10 + seasonOrder;
}

function sortSeasons(values: string[]) {
  return [...values].sort((a, b) => seasonSortValue(a) - seasonSortValue(b));
}

function getPlayer(row: any) {
  return clean(
    row?.Player ||
      row?.playerName ||
      row?.["Row Labels"] ||
      row?.["Player Name"] ||
      row?.["PLAYER NAME"] ||
      row?.Name ||
      row?.name
  );
}

function isValidPlayerName(value: any) {
  const name = clean(value);
  const id = compact(name);

  if (!name) return false;
  if (["standings", "overall", "grandtotal", "totalplayers", "ghostplayer", "player"].includes(id)) return false;
  if (/^[^a-zA-Z0-9]+$/.test(name)) return false;

  return true;
}

function getWeek(row: any) {
  const raw = clean(row?.Week || row?.week || row?.WEEK || row?.["Week "]);
  if (!raw) return "";
  const num = raw.match(/\d+/)?.[0];
  return num ? `Week ${num}` : raw;
}

function normalizeWeek(value: any) {
  const text = clean(value);
  return text.match(/\d+/)?.[0] || normalizeText(text);
}

function getType(row: any) {
  const raw = clean(row?.Type || row?.type || row?.TYPE || row?.Event || row?.event);
  const lower = raw.toLowerCase();
  if (lower.includes("blind")) return "Blind";
  if (lower.includes("swap")) return "Swap";
  return raw;
}

function numberVal(value: any) {
  const n = Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function pointValue(row: any) {
  return numberVal(
    row?.Points ||
      row?.points ||
      row?.["Overall Points"] ||
      row?.Overall ||
      row?.Total ||
      row?.["Total Points"] ||
      row?.["Total POINTS"]
  );
}

function getStatValue(row: any, keys: string[]) {
  for (const key of keys) {
    if (row?.[key] !== undefined && row?.[key] !== "") return row[key];
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
  if (Math.abs(n) >= 100 || Number.isInteger(n) || decimals === 0) return String(Math.round(n));
  return n.toFixed(decimals);
}

function weekSort(a: string, b: string) {
  const an = Number(clean(a).replace(/[^0-9]/g, ""));
  const bn = Number(clean(b).replace(/[^0-9]/g, ""));
  return an - bn;
}

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
  { label: "PPR", keys: ["PPR", "ppr"], decimals: 2 },
  { label: "Rounds", keys: ["Rounds", "rounds", "ROUNDS"], decimals: 0 },
  { label: "Points", keys: ["Points", "points", "Total Points", "POINTS"], decimals: 0 },
  { label: "OPPR", keys: ["OPPR", "Opponent PPR", "Opp PPR"], decimals: 2 },
  { label: "Opp Pts", keys: ["Opp Pts", "Opponent Points", "Opp Points"], decimals: 0 },
  { label: "DPR", keys: ["DPR", "dpr"], decimals: 2 },
  { label: "4 Baggers", keys: ["4 Baggers", "Four Baggers", "4-Baggers"], decimals: 0 },
];

function rowMatchesSeason(row: any, season: string) {
  if (!season) return true;
  const rowSeason = getSeason(row);
  return !rowSeason || rowSeason === season;
}

function matchEventStatRows(eventStats: any[], params: { season?: string; week?: string; type?: string; player?: string }) {
  const season = clean(params.season);
  const week = normalizeWeek(params.week);
  const type = normalizeText(params.type);
  const playerName = normalizeName(params.player);

  let rows = eventStats.filter((row) => {
    const seasonOk = !season || rowMatchesSeason(row, season);
    const weekOk = !week || normalizeWeek(getWeek(row)) === week;
    const typeOk = !type || normalizeText(getType(row)) === type;
    const playerOk = !playerName || normalizeName(getPlayer(row)) === playerName;
    return seasonOk && weekOk && typeOk && playerOk;
  });

  // Some older saved rows may not have Type correctly tagged. Fall back to Season + Week + Player.
  if (!rows.length && playerName) {
    rows = eventStats.filter((row) => {
      const seasonOk = !season || rowMatchesSeason(row, season);
      const weekOk = !week || normalizeWeek(getWeek(row)) === week;
      const playerOk = normalizeName(getPlayer(row)) === playerName;
      return seasonOk && weekOk && playerOk;
    });
  }

  // Some older saved rows may not have Week correctly tagged. Fall back to Season + Type + Player.
  if (!rows.length && playerName && type) {
    rows = eventStats.filter((row) => {
      const seasonOk = !season || rowMatchesSeason(row, season);
      const typeOk = normalizeText(getType(row)) === type;
      const playerOk = normalizeName(getPlayer(row)) === playerName;
      return seasonOk && typeOk && playerOk;
    });
  }

  const bestByPlayer = new Map<string, any>();

  for (const row of rows) {
    const key = [normalizeName(getPlayer(row)), normalizeWeek(getWeek(row)), normalizeText(getType(row))].join("|");
    const current = bestByPlayer.get(key);
    const score = eventStatColumns.reduce((total, col) => total + (getStatValue(row, col.keys) !== "" && getStatValue(row, col.keys) !== null && getStatValue(row, col.keys) !== undefined ? 1 : 0), 0);
    const currentScore = current
      ? eventStatColumns.reduce((total, col) => total + (getStatValue(current, col.keys) !== "" && getStatValue(current, col.keys) !== null && getStatValue(current, col.keys) !== undefined ? 1 : 0), 0)
      : -1;

    if (!current || score >= currentScore) bestByPlayer.set(key, row);
  }

  return Array.from(bestByPlayer.values());
}

function summarizeEventStats(rows: any[]) {
  const valuesFor = (keys: string[]) =>
    rows.map((row) => getStatNumber(row, keys)).filter((n) => Number.isFinite(n) && n !== 0);

  const avg = (keys: string[], decimals = 2) => {
    const values = valuesFor(keys);
    if (!values.length) return "-";
    return formatValue(values.reduce((a, b) => a + b, 0) / values.length, decimals);
  };

  const sum = (keys: string[], decimals = 0) => {
    const total = rows.reduce((acc, row) => acc + getStatNumber(row, keys), 0);
    return total ? formatValue(total, decimals) : "-";
  };

  return {
    players: rows.length,
    totalRounds: sum(["Rounds", "rounds", "ROUNDS"], 0),
    totalPoints: sum(["Points", "points", "POINTS", "Total Points"], 0),
    avgPPR: avg(["PPR", "ppr"], 2),
    avgOPPR: avg(["OPPR", "Opponent PPR", "Opp PPR"], 2),
    avgDPR: avg(["DPR", "dpr"], 2),
    oppPoints: sum(["Opp Pts", "Opponent Points", "Opp Points"], 0),
    fourBaggers: sum(["4 Baggers", "Four Baggers", "4-Baggers"], 0),
  };
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
        const cleaned = {
          ...loaded,
          players: (loaded.players || []).filter(isValidPlayerName),
          standings: (loaded.standings || []).filter((row: any) => isValidPlayerName(getPlayer(row))),
          weekly: (loaded.weekly || []).filter((row: any) => isValidPlayerName(getPlayer(row))),
          eventStats: (loaded.eventStats || []).filter((row: any) => isValidPlayerName(getPlayer(row))),
          stats: (loaded.stats || []).filter((row: any) => isValidPlayerName(getPlayer(row))),
        };
        const sortedSeasons = sortSeasons(cleaned.seasons || []);
        setData({ ...cleaned, seasons: sortedSeasons });
        setSeason(sortedSeasons[0] || "");
        setProfileSeason("All Seasons");
      });
  }, []);

  const seasons = data?.seasons || [];
  const players = data?.players || [];
  const selectedPlayer = player !== "All Players" ? player : "";
  const allEventStats = data?.eventStats || [];

  const dashboardWeeks = useMemo(() => {
    const seasonWeekly = (data?.weekly || []).filter((row) => rowMatchesSeason(row, season));
    return ["All Weeks", ...Array.from(new Set(seasonWeekly.map(getWeek).filter(Boolean))).sort(weekSort)];
  }, [data, season]);

  const standings = useMemo(() => {
    const base = (data?.standings || [])
      .filter((row) => rowMatchesSeason(row, season))
      .filter((row) => player === "All Players" || getPlayer(row) === player)
      .map((row) => {
        const weekValue = dashboardWeek === "All Weeks" ? pointValue(row) : numberVal(row[dashboardWeek]);
        return { name: getPlayer(row) || "Unknown", points: weekValue, raw: row };
      })
      .filter((row) => row.name !== "Unknown" && isValidPlayerName(row.name))
      .filter((row) => dashboardWeek === "All Weeks" || row.points !== 0)
      .sort((a, b) => b.points - a.points);
    return base;
  }, [data, season, player, dashboardWeek]);

  const seasonStats = useMemo(() => {
    const rows = (data?.stats || [])
      .filter((row) => rowMatchesSeason(row, season))
      .filter((row) => player === "All Players" || getPlayer(row) === player)
      .filter((row) => isValidPlayerName(getPlayer(row)));

    const selectedColumn = statColumns.find((col) => col.label === sortKey);
    return rows.sort((a, b) => {
      if (!selectedColumn) return getPlayer(a).localeCompare(getPlayer(b));
      const av = getStatNumber(a, selectedColumn.keys);
      const bv = getStatNumber(b, selectedColumn.keys);
      if (av === bv) return getPlayer(a).localeCompare(getPlayer(b));
      return sortDirection === "asc" ? av - bv : bv - av;
    });
  }, [data, season, player, sortKey, sortDirection]);

  const weekRows = useMemo(() => {
    return (data?.weekly || []).filter((row) => rowMatchesSeason(row, season) && getType(row) === type);
  }, [data, season, type]);

  const weeks = useMemo(() => Array.from(new Set(weekRows.map(getWeek).filter(Boolean))).sort(weekSort), [weekRows]);

  useEffect(() => {
    if (!week || !weeks.includes(week)) setWeek(weeks[0] || "");
  }, [weeks, week]);

  const visibleWeekRows = weekRows.filter((row) => (!week || getWeek(row) === week) && (player === "All Players" || getPlayer(row) === player));

  const visibleEventStatsRows = useMemo(() => {
    return matchEventStatRows(allEventStats, { season, week, type }).sort((a, b) => getPlayer(a).localeCompare(getPlayer(b)));
  }, [allEventStats, season, week, type]);

  const playerSeasonFilter = profileSeason === "All Seasons" ? "" : profileSeason;

  const playerSeasonStats = useMemo(() => {
    if (!selectedPlayer) return null;
    return (data?.stats || []).find((row) => getPlayer(row) === selectedPlayer && (!playerSeasonFilter || rowMatchesSeason(row, playerSeasonFilter))) || null;
  }, [data, selectedPlayer, playerSeasonFilter]);

  const playerAllSeasonStats = useMemo(() => {
    if (!selectedPlayer) return [];
    return (data?.stats || [])
      .filter((row) => getPlayer(row) === selectedPlayer)
      .sort((a, b) => seasonSortValue(getSeason(a)) - seasonSortValue(getSeason(b)));
  }, [data, selectedPlayer]);

  const playerWeeks = useMemo(() => {
    if (!selectedPlayer) return [];
    return Array.from(
      new Set(
        (data?.weekly || [])
          .filter((row) => getPlayer(row) === selectedPlayer)
          .filter((row) => !playerSeasonFilter || rowMatchesSeason(row, playerSeasonFilter))
          .map(getWeek)
          .filter(Boolean)
      )
    ).sort(weekSort);
  }, [data, selectedPlayer, playerSeasonFilter]);

  const playerWeeklyRows = useMemo(() => {
    if (!selectedPlayer) return [];
    return (data?.weekly || [])
      .filter((row) => getPlayer(row) === selectedPlayer)
      .filter((row) => !playerSeasonFilter || rowMatchesSeason(row, playerSeasonFilter))
      .filter((row) => profileWeek === "All Weeks" || getWeek(row) === profileWeek)
      .filter((row) => profileType === "All" || getType(row) === profileType)
      .sort((a, b) => {
        const seasonCompare = seasonSortValue(getSeason(a)) - seasonSortValue(getSeason(b));
        if (seasonCompare !== 0) return seasonCompare;
        const weekCompare = weekSort(getWeek(a), getWeek(b));
        if (weekCompare !== 0) return weekCompare;
        return getType(a).localeCompare(getType(b));
      });
  }, [data, selectedPlayer, playerSeasonFilter, profileWeek, profileType]);

  const groupedPlayerWeeks = useMemo(() => {
    const groups: Record<string, Record<string, any[]>> = {};
    for (const row of playerWeeklyRows) {
      const key = `${getSeason(row)} - ${getWeek(row) || "No Week"}`;
      const t = getType(row) || "Other";
      if (!groups[key]) groups[key] = {};
      if (!groups[key][t]) groups[key][t] = [];
      groups[key][t].push(row);
    }
    return Object.entries(groups).sort(([a], [b]) => {
      const seasonA = a.split(" - ")[0];
      const seasonB = b.split(" - ")[0];
      const seasonCompare = seasonSortValue(seasonA) - seasonSortValue(seasonB);
      if (seasonCompare !== 0) return seasonCompare;
      return weekSort(a, b);
    });
  }, [playerWeeklyRows]);

  const progressData = useMemo(() => {
    return playerAllSeasonStats.map((row) => ({
      season: getSeason(row),
      PPR: getStatNumber(row, ["Average PPR"]),
      DPR: getStatNumber(row, ["Average DPR"]),
    }));
  }, [playerAllSeasonStats]);

  const statA = (data?.stats || []).find((row) => getPlayer(row) === compareA && rowMatchesSeason(row, season));
  const statB = (data?.stats || []).find((row) => getPlayer(row) === compareB && rowMatchesSeason(row, season));

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
            <Select label="Dashboard Week" value={dashboardWeek} onChange={(v) => setDashboardWeek(v)} options={dashboardWeeks} />
            <div className="text-sm text-neutral-400">Last updated: {data.lastUpdated ? new Date(data.lastUpdated).toLocaleString() : "No upload date found"}</div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl space-y-6 p-4">
        {tab === "dashboard" && (
          <>
            <Card title={dashboardWeek === "All Weeks" ? "Top Standings" : `Top Standings - ${dashboardWeek}`}>
              <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={standings.slice(0, 12)} margin={{ top: 20, right: 20, left: 0, bottom: 80 }}>
                      <XAxis dataKey="name" interval={0} angle={-25} textAnchor="end" height={90} />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="points" fill="#f04a22"><LabelList dataKey="points" position="top" fill="#fff" /></Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <RankedList rows={standings.slice(0, 12)} />
              </div>
            </Card>
            <Card title={player === "All Players" ? "Season Stats" : `${player} Season Stats`}>
              {player === "All Players" ? <StatsTable rows={seasonStats} sortKey={sortKey} sortDirection={sortDirection} onSort={(key) => { if (sortKey === key) setSortDirection(sortDirection === "asc" ? "desc" : "asc"); else { setSortKey(key); setSortDirection("desc"); } }} /> : <PlayerStatsSummary row={seasonStats[0]} />}
            </Card>
          </>
        )}

        {tab === "standings" && <Card title="Season Standings"><Table rows={standings} /></Card>}

        {tab === "weeks" && (
          <Card title="Weekly Results">
            <div className="mb-4 flex flex-wrap gap-3">
              <select className="rounded-lg bg-[#242424] p-2" value={type} onChange={(e) => { setType(e.target.value as "Blind" | "Swap"); setWeek(""); }}><option>Blind</option><option>Swap</option></select>
              <select className="rounded-lg bg-[#242424] p-2" value={week} onChange={(e) => setWeek(e.target.value)}>{weeks.map((w) => <option key={w}>{w}</option>)}</select>
            </div>
            <h3 className="mb-2 text-lg font-black text-[#f04a22]">Standings</h3>
            <WeeklyStandingsTable rows={visibleWeekRows} eventStats={allEventStats} />
            <EventSummary rows={visibleEventStatsRows} />
          </Card>
        )}

        {tab === "players" && (
          <Card title={selectedPlayer ? `${selectedPlayer} Profile` : "Player Profile"}>
            {!selectedPlayer ? <p className="text-neutral-400">Use the Player dropdown above to select a player.</p> : (
              <div className="space-y-6">
                <div className="flex flex-wrap gap-3">
                  <select className="rounded-lg bg-[#242424] p-2" value={profileSeason} onChange={(e) => { setProfileSeason(e.target.value); setProfileWeek("All Weeks"); }}><option>All Seasons</option>{seasons.map((s) => <option key={s}>{s}</option>)}</select>
                  <select className="rounded-lg bg-[#242424] p-2" value={profileWeek} onChange={(e) => setProfileWeek(e.target.value)}><option>All Weeks</option>{playerWeeks.map((w) => <option key={w}>{w}</option>)}</select>
                  <select className="rounded-lg bg-[#242424] p-2" value={profileType} onChange={(e) => setProfileType(e.target.value as EventFilter)}><option>All</option><option>Blind</option><option>Swap</option></select>
                </div>

                {profileSeason === "All Seasons" ? (
                  <>
                    <h3 className="text-lg font-black text-[#f04a22]">Season Finishes</h3>
                    <SeasonHistoryTable rows={playerAllSeasonStats} standings={data.standings || []} />
                    <h3 className="text-lg font-black text-[#f04a22]">Progress Over Time</h3>
                    <div className="h-80 rounded-xl border border-neutral-800 bg-[#141414] p-3">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={progressData} margin={{ top: 20, right: 20, left: 0, bottom: 30 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                          <XAxis dataKey="season" />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Line type="monotone" dataKey="DPR" stroke="#ffffff" strokeWidth={3} dot />
                          <Line type="monotone" dataKey="PPR" stroke="#f04a22" strokeWidth={3} dot />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </>
                ) : <PlayerStatsSummary row={playerSeasonStats} />}

                <h3 className="text-lg font-black text-[#f04a22]">Weekly Breakdown</h3>
                {groupedPlayerWeeks.length === 0 ? <p className="text-neutral-400">No weekly records found for this selection.</p> : groupedPlayerWeeks.map(([weekLabel, byType]) => (
                  <div key={weekLabel} className="rounded-xl border border-neutral-800 bg-[#1c1c1c] p-4">
                    <h4 className="mb-3 text-xl font-black">{weekLabel}</h4>
                    {Object.entries(byType).map(([eventType, rows]) => (
                      <div key={eventType} className="mb-6">
                        <div className="mb-2 inline-block rounded-full bg-[#f04a22] px-3 py-1 text-xs font-black uppercase">{eventType}</div>
                        <WeeklyStandingsTable rows={rows} eventStats={allEventStats} />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {tab === "compare" && (
          <Card title="Compare Players">
            <div className="mb-4 flex flex-wrap gap-3">
              <select className="rounded-lg bg-[#242424] p-2" value={compareA} onChange={(e) => setCompareA(e.target.value)}><option value="">Player A</option>{players.map((p) => <option key={p}>{p}</option>)}</select>
              <select className="rounded-lg bg-[#242424] p-2" value={compareB} onChange={(e) => setCompareB(e.target.value)}><option value="">Player B</option>{players.map((p) => <option key={p}>{p}</option>)}</select>
            </div>
            <CompareTable statA={statA} statB={statB} />
          </Card>
        )}
      </section>

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-neutral-800 bg-black/95 p-2 md:hidden">
        <div className="grid grid-cols-5 gap-1">{navItems.map((item) => <button key={item.id} onClick={() => setTab(item.id)} className={`rounded-lg px-2 py-3 text-xs font-bold ${tab === item.id ? "bg-[#f04a22]" : "bg-[#1d1d1d]"}`}>{item.label}</button>)}</div>
      </nav>
    </main>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return <div><label className="text-xs font-bold uppercase text-[#f04a22]">{label}</label><select className="block rounded-lg border border-neutral-700 bg-[#242424] p-2 text-white" value={value} onChange={(e) => onChange(e.target.value)}>{options.map((o) => <option key={o}>{o}</option>)}</select></div>;
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-neutral-800 bg-[#141414] p-4 shadow-xl"><h2 className="mb-4 text-xl font-black">{title}</h2>{children}</section>;
}

function RankedList({ rows }: { rows: any[] }) {
  return <div className="space-y-2">{rows.map((row, index) => <div key={row.name} className="flex items-center justify-between rounded-lg bg-[#202020] px-3 py-2"><span className="font-bold">{index + 1}. {row.name}</span><span className="font-black text-[#f04a22]">{formatValue(row.points, 0)}</span></div>)}</div>;
}

function Table({ rows }: { rows: any[] }) {
  return <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-neutral-400"><th className="p-2">#</th><th className="p-2">Player</th><th className="p-2">Points</th></tr></thead><tbody>{rows.map((row, index) => <tr key={`${row.name}-${index}`} className="border-t border-neutral-800"><td className="p-2">{index + 1}</td><td className="p-2 font-bold">{row.name}</td><td className="p-2 text-[#f04a22]">{formatValue(row.points, 0)}</td></tr>)}</tbody></table></div>;
}

function StatsTable({ rows, sortKey, sortDirection, onSort }: { rows: any[]; sortKey: string; sortDirection: SortDirection; onSort: (key: string) => void }) {
  return <><div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[1100px] text-[12px]"><thead><tr className="text-left text-neutral-400"><th className="sticky left-0 z-10 bg-[#141414] p-2">Player</th>{statColumns.map((col) => <th key={col.label} className="cursor-pointer whitespace-nowrap p-2 hover:text-[#f04a22]" onClick={() => onSort(col.label)}>{col.label}{sortKey === col.label ? (sortDirection === "asc" ? " ▲" : " ▼") : ""}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={`${getPlayer(row)}-${index}`} className="border-t border-neutral-800"><td className="sticky left-0 z-10 bg-[#141414] p-2 font-bold text-white">{getPlayer(row)}</td>{statColumns.map((col) => <td key={col.label} className="whitespace-nowrap p-2 text-neutral-300">{formatValue(getStatValue(row, col.keys), col.decimals)}</td>)}</tr>)}</tbody></table></div><div className="grid gap-3 md:hidden">{rows.map((row) => <div key={getPlayer(row)} className="rounded-xl border border-neutral-800 bg-[#202020] p-4"><h3 className="mb-2 font-black text-[#f04a22]">{getPlayer(row)}</h3><div className="grid grid-cols-2 gap-2 text-sm">{statColumns.map((col) => <div key={col.label}><div className="text-xs text-neutral-500">{col.label}</div><div className="font-bold">{formatValue(getStatValue(row, col.keys), col.decimals)}</div></div>)}</div></div>)}</div></>;
}

function PlayerStatsSummary({ row }: { row: any }) {
  if (!row) return <p className="text-neutral-400">No season stats found for this player.</p>;
  return <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-5">{statColumns.map((col) => <div key={col.label} className="rounded-xl border border-neutral-800 bg-[#202020] p-4"><div className="text-xs font-bold uppercase text-neutral-400">{col.label}</div><div className="mt-1 text-2xl font-black text-[#f04a22]">{formatValue(getStatValue(row, col.keys), col.decimals)}</div></div>)}</div>;
}

function WeeklyStandingsTable({ rows, eventStats }: { rows: any[]; eventStats: any[] }) {
  return <div className="overflow-x-auto"><table className="w-full text-[12px]"><thead><tr className="text-left text-neutral-400"><th className="p-2">Rank</th><th className="p-2">Player</th><th className="p-2">Team</th><th className="p-2">Points</th><th className="p-2">+/-</th>{eventStatColumns.map((col) => <th key={col.label} className="p-2">{col.label}</th>)}</tr></thead><tbody>{rows.map((row, index) => { const matched = matchEventStatRows(eventStats, { season: getSeason(row), week: getWeek(row), type: getType(row), player: getPlayer(row) })[0] || {}; return <tr key={index} className="border-t border-neutral-800"><td className="p-2">{clean(row.RANK || row.Rank || row.rank) || "-"}</td><td className="p-2 font-bold text-[#f04a22]">{getPlayer(row)}</td><td className="p-2">{clean(row.TEAM || row.Team || row.team) || "-"}</td><td className="p-2">{formatValue(row.POINTS || row.Points || row.points, 0)}</td><td className="p-2">{clean(row["+/-"] || row["+ / -"] || row["+ /-"]) || "-"}</td>{eventStatColumns.map((col) => <td key={col.label} className="p-2">{formatValue(getStatValue(matched, col.keys), col.decimals)}</td>)}</tr>; })}</tbody></table></div>;
}

function EventStatsTable({ rows }: { rows: any[] }) {
  if (!rows.length) return <p className="mb-4 text-sm text-neutral-500">No stat rows found for this event.</p>;
  return <div className="mb-4 overflow-x-auto"><table className="w-full text-[12px]"><thead><tr className="text-left text-neutral-400"><th className="p-2">Player</th>{eventStatColumns.map((col) => <th key={col.label} className="p-2">{col.label}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index} className="border-t border-neutral-800"><td className="p-2 font-bold text-[#f04a22]">{getPlayer(row)}</td>{eventStatColumns.map((col) => <td key={col.label} className="p-2">{formatValue(getStatValue(row, col.keys), col.decimals)}</td>)}</tr>)}</tbody></table></div>;
}

function EventSummary({ rows }: { rows: any[] }) {
  const s = summarizeEventStats(rows);
  return <div className="mt-4 rounded-xl border border-neutral-800 bg-[#202020] p-4"><h3 className="mb-3 text-lg font-black text-[#f04a22]">Event Totals / Averages</h3><div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4"><MiniStat label="Players" value={s.players} /><MiniStat label="Total Rounds" value={s.totalRounds} /><MiniStat label="Total Points" value={s.totalPoints} /><MiniStat label="Avg PPR" value={s.avgPPR} /><MiniStat label="Avg OPPR" value={s.avgOPPR} /><MiniStat label="Avg DPR" value={s.avgDPR} /><MiniStat label="Opp Points" value={s.oppPoints} /><MiniStat label="4 Baggers" value={s.fourBaggers} /></div></div>;
}

function MiniStat({ label, value }: { label: string; value: any }) {
  return <div className="rounded-lg bg-[#151515] p-3"><div className="text-xs font-bold uppercase text-neutral-400">{label}</div><div className="text-2xl font-black text-[#f04a22]">{value}</div></div>;
}

function SeasonHistoryTable({ rows, standings }: { rows: any[]; standings: any[] }) {
  return <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-neutral-400"><th className="p-2">Season</th><th className="p-2">Finish</th><th className="p-2">PPR</th><th className="p-2">DPR</th><th className="p-2">OPPR</th><th className="p-2">Points</th><th className="p-2">Rounds</th><th className="p-2">4 Baggers</th></tr></thead><tbody>{rows.map((row) => { const season = getSeason(row); const sorted = standings.filter((s) => getSeason(s) === season).map((s) => ({ name: getPlayer(s), points: pointValue(s) })).sort((a, b) => b.points - a.points); const finish = sorted.findIndex((s) => normalizeName(s.name) === normalizeName(getPlayer(row))) + 1; return <tr key={season} className="border-t border-neutral-800"><td className="p-2 font-bold">{season}</td><td className="p-2 text-[#f04a22]">{finish || "-"}</td><td className="p-2">{formatValue(getStatValue(row, ["Average PPR"]), 2)}</td><td className="p-2">{formatValue(getStatValue(row, ["Average DPR"]), 2)}</td><td className="p-2">{formatValue(getStatValue(row, ["Opponents Avg PPR"]), 2)}</td><td className="p-2">{formatValue(getStatValue(row, ["Total Pts"]), 0)}</td><td className="p-2">{formatValue(getStatValue(row, ["Total Rounds"]), 0)}</td><td className="p-2">{formatValue(getStatValue(row, ["Total 4-Baggers"]), 0)}</td></tr>; })}</tbody></table></div>;
}

function CompareTable({ statA, statB }: { statA: any; statB: any }) {
  return <div className="overflow-x-auto"><table className="w-full text-sm"><tbody>{statColumns.map((col) => <tr key={col.label} className="border-t border-neutral-800"><td className="p-2 text-neutral-400">{col.label}</td><td className="p-2">{formatValue(getStatValue(statA, col.keys), col.decimals)}</td><td className="p-2">{formatValue(getStatValue(statB, col.keys), col.decimals)}</td></tr>)}</tbody></table></div>;
}
