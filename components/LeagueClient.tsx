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
} from "recharts";

type Data = {
  lastUpdated?: string;
  seasons: string[];
  players: string[];
  standings: any[];
  weekly: any[];
  stats: any[];
};

type Tab = "dashboard" | "standings" | "weeks" | "players" | "compare";
type EventFilter = "All" | "Blind" | "Swap";
type SortDirection = "asc" | "desc";

function clean(value: any) {
  return String(value ?? "").trim();
}

function getSeason(row: any, fallback = "") {
  return clean(row.Season || row.season || row.SEASON || fallback);
}

function getPlayer(row: any) {
  return clean(
    row.Player ||
      row.playerName ||
      row["Row Labels"] ||
      row["Player Name"] ||
      row["PLAYER NAME"] ||
      row.Name ||
      row.name
  );
}

function getWeek(row: any) {
  return clean(row.Week || row.week || row.WEEK);
}

function getType(row: any) {
  return clean(row.Type || row.type || row.TYPE);
}

function numberVal(value: any) {
  const n = Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function pointValue(row: any) {
  return numberVal(
    row.Points ||
      row.points ||
      row["Overall Points"] ||
      row.Overall ||
      row.Total ||
      row["Total Points"] ||
      row["Total POINTS"]
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

  if (Math.abs(n) >= 100 || Number.isInteger(n)) {
    return String(Math.round(n));
  }

  return n.toFixed(decimals);
}

function weekSort(a: string, b: string) {
  const an = Number(a.replace(/[^0-9]/g, ""));
  const bn = Number(b.replace(/[^0-9]/g, ""));
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

const weeklySkipKeys = new Set([
  "Season",
  "Player",
  "playerName",
  "Week",
  "week",
  "WEEK",
  "Type",
  "type",
  "TYPE",
]);

function getVisibleWeeklyEntries(row: any) {
  return Object.entries(row)
    .filter(([key, value]) => {
      if (weeklySkipKeys.has(key)) return false;
      if (value === "" || value === null || value === undefined) return false;
      return true;
    })
    .slice(0, 14);
}

export default function LeagueClient() {
  const [data, setData] = useState<Data | null>(null);
  const [tab, setTab] = useState<Tab>("dashboard");
  const [season, setSeason] = useState("");
  const [player, setPlayer] = useState("All Players");
  const [type, setType] = useState<"Blind" | "Swap">("Blind");
  const [week, setWeek] = useState("");
  const [profilePlayer, setProfilePlayer] = useState("");
  const [profileSeason, setProfileSeason] = useState("");
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
        setData(loaded);
        setSeason(loaded.seasons?.[0] || "");
        setProfileSeason(loaded.seasons?.[0] || "");
      });
  }, []);

  const seasons = data?.seasons || [];
  const players = data?.players || [];

  const standings = useMemo(() => {
    return (data?.standings || [])
      .filter((row) => !season || getSeason(row, season) === season)
      .filter((row) => player === "All Players" || getPlayer(row) === player)
      .map((row) => ({
        name: getPlayer(row) || "Unknown",
        points: pointValue(row),
        raw: row,
      }))
      .filter((row) => row.name !== "Unknown")
      .sort((a, b) => b.points - a.points);
  }, [data, season, player]);

  const seasonStats = useMemo(() => {
    const rows = (data?.stats || [])
      .filter((row) => !season || getSeason(row, season) === season)
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

  const weekRows = useMemo(() => {
    return (data?.weekly || []).filter((row) => {
      return (
        (!season || getSeason(row, season) === season) &&
        (!type || getType(row) === type)
      );
    });
  }, [data, season, type]);

  const weeks = useMemo(() => {
    return Array.from(new Set(weekRows.map(getWeek).filter(Boolean))).sort(
      weekSort
    );
  }, [weekRows]);

  useEffect(() => {
    if (!week || !weeks.includes(week)) setWeek(weeks[0] || "");
  }, [weeks, week]);

  const visibleWeekRows = weekRows.filter((row) => {
    return (
      (!week || getWeek(row) === week) &&
      (player === "All Players" || getPlayer(row) === player)
    );
  });

  const selectedProfilePlayer =
    profilePlayer || (player !== "All Players" ? player : "");

  const playerSeasonStats = useMemo(() => {
    if (!selectedProfilePlayer) return null;

    return (
      (data?.stats || []).find(
        (row) =>
          getPlayer(row) === selectedProfilePlayer &&
          (!profileSeason || getSeason(row, profileSeason) === profileSeason)
      ) || null
    );
  }, [data, selectedProfilePlayer, profileSeason]);

  const playerWeeklyRows = useMemo(() => {
    if (!selectedProfilePlayer) return [];

    return (data?.weekly || [])
      .filter((row) => getPlayer(row) === selectedProfilePlayer)
      .filter(
        (row) => !profileSeason || getSeason(row, profileSeason) === profileSeason
      )
      .filter((row) => profileWeek === "All Weeks" || getWeek(row) === profileWeek)
      .filter((row) => profileType === "All" || getType(row) === profileType)
      .sort((a, b) => {
        const weekCompare = weekSort(getWeek(a), getWeek(b));
        if (weekCompare !== 0) return weekCompare;
        return getType(a).localeCompare(getType(b));
      });
  }, [data, selectedProfilePlayer, profileSeason, profileWeek, profileType]);

  const playerWeeks = useMemo(() => {
    if (!selectedProfilePlayer) return [];

    return Array.from(
      new Set(
        (data?.weekly || [])
          .filter((row) => getPlayer(row) === selectedProfilePlayer)
          .filter(
            (row) =>
              !profileSeason || getSeason(row, profileSeason) === profileSeason
          )
          .map(getWeek)
          .filter(Boolean)
      )
    ).sort(weekSort);
  }, [data, selectedProfilePlayer, profileSeason]);

  const groupedPlayerWeeks = useMemo(() => {
    const groups: Record<string, Record<string, any[]>> = {};

    for (const row of playerWeeklyRows) {
      const w = getWeek(row) || "No Week";
      const t = getType(row) || "Other";
      if (!groups[w]) groups[w] = {};
      if (!groups[w][t]) groups[w][t] = [];
      groups[w][t].push(row);
    }

    return Object.entries(groups).sort(([a], [b]) => weekSort(a, b));
  }, [playerWeeklyRows]);

  const statA = (data?.stats || []).find(
    (row) =>
      getPlayer(row) === compareA &&
      (!season || getSeason(row, season) === season)
  );

  const statB = (data?.stats || []).find(
    (row) =>
      getPlayer(row) === compareB &&
      (!season || getSeason(row, season) === season)
  );

  const compareKeys = statColumns;

  if (!data) {
    return (
      <main className="min-h-screen bg-black p-6 text-white">
        Loading League Stats...
      </main>
    );
  }

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
            <img
              src="/ec-logo.png"
              alt="Empire Cornhole"
              className="h-16 w-20 rounded-xl bg-white object-contain p-1"
            />
            <div>
              <h1 className="text-3xl font-black tracking-tight">
                League Stats
              </h1>
              <p className="text-sm text-neutral-300">
                Empire Cornhole standings, weekly results, and player stats.
              </p>
            </div>
          </div>

          <div className="hidden gap-2 md:flex">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
                className={`rounded-full px-4 py-2 text-sm font-bold ${
                  tab === item.id
                    ? "bg-[#f04a22] text-white"
                    : "bg-neutral-900 text-neutral-300 hover:bg-neutral-800"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl p-4">
        <div className="rounded-2xl border border-neutral-800 bg-[#141414] p-4 shadow-xl">
          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            <div>
              <label className="text-xs font-bold uppercase text-[#f04a22]">
                Season
              </label>
              <select
                className="block rounded-lg border border-neutral-700 bg-[#242424] p-2 text-white"
                value={season}
                onChange={(e) => {
                  setSeason(e.target.value);
                  setProfileSeason(e.target.value);
                }}
              >
                {seasons.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold uppercase text-[#f04a22]">
                Player
              </label>
              <select
                className="block rounded-lg border border-neutral-700 bg-[#242424] p-2 text-white"
                value={player}
                onChange={(e) => setPlayer(e.target.value)}
              >
                <option>All Players</option>
                {players.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </div>

            <div className="text-sm text-neutral-400">
              Last updated:{" "}
              {data.lastUpdated
                ? new Date(data.lastUpdated).toLocaleString()
                : "No upload date found"}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl space-y-6 p-4">
        {tab === "dashboard" && (
          <>
            <Card title="Top Standings">
              <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={standings.slice(0, 12)}>
                      <XAxis dataKey="name" interval={0} angle={-25} textAnchor="end" height={80} />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="points" fill="#f04a22">
                        <LabelList dataKey="points" position="top" fill="#fff" />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="space-y-2">
                  {standings.slice(0, 12).map((row, index) => (
                    <div
                      key={row.name}
                      className="flex items-center justify-between rounded-lg bg-[#202020] px-3 py-2"
                    >
                      <span className="font-bold">
                        {index + 1}. {row.name}
                      </span>
                      <span className="font-black text-[#f04a22]">
                        {formatValue(row.points, 0)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            <Card title={player === "All Players" ? "Season Stats" : `${player} Season Stats`}>
              {player === "All Players" ? (
                <StatsTable
                  rows={seasonStats}
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={(key) => {
                    if (sortKey === key) {
                      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
                    } else {
                      setSortKey(key);
                      setSortDirection("desc");
                    }
                  }}
                />
              ) : (
                <PlayerStatsSummary row={seasonStats[0]} />
              )}
            </Card>
          </>
        )}

        {tab === "standings" && (
          <Card title="Season Standings">
            <Table rows={standings} />
          </Card>
        )}

        {tab === "weeks" && (
          <Card title="Weekly Results">
            <div className="mb-4 flex flex-wrap gap-3">
              <select
                className="rounded-lg bg-[#242424] p-2"
                value={type}
                onChange={(e) => {
                  setType(e.target.value as "Blind" | "Swap");
                  setWeek("");
                }}
              >
                <option>Blind</option>
                <option>Swap</option>
              </select>

              <select
                className="rounded-lg bg-[#242424] p-2"
                value={week}
                onChange={(e) => setWeek(e.target.value)}
              >
                {weeks.map((w) => (
                  <option key={w}>{w}</option>
                ))}
              </select>
            </div>

            <WeeklyRowsTable rows={visibleWeekRows} />
          </Card>
        )}

        {tab === "players" && (
          <>
            <Card title="Players">
              <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {players.map((p) => (
                  <button
                    key={p}
                    onClick={() => setProfilePlayer(p)}
                    className={`rounded-xl border p-4 text-left font-bold ${
                      selectedProfilePlayer === p
                        ? "border-[#f04a22] bg-[#f04a22]/20"
                        : "border-neutral-800 bg-[#202020] hover:border-[#f04a22]"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </Card>

            <Card title={selectedProfilePlayer ? `${selectedProfilePlayer} Profile` : "Player Profile"}>
              {!selectedProfilePlayer ? (
                <p className="text-neutral-400">
                  Select a player to view stats, seasons, weeks, and event breakdowns.
                </p>
              ) : (
                <div className="space-y-6">
                  <div className="flex flex-wrap gap-3">
                    <select
                      className="rounded-lg bg-[#242424] p-2"
                      value={profileSeason}
                      onChange={(e) => {
                        setProfileSeason(e.target.value);
                        setProfileWeek("All Weeks");
                      }}
                    >
                      {seasons.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>

                    <select
                      className="rounded-lg bg-[#242424] p-2"
                      value={profileWeek}
                      onChange={(e) => setProfileWeek(e.target.value)}
                    >
                      <option>All Weeks</option>
                      {playerWeeks.map((w) => (
                        <option key={w}>{w}</option>
                      ))}
                    </select>

                    <select
                      className="rounded-lg bg-[#242424] p-2"
                      value={profileType}
                      onChange={(e) => setProfileType(e.target.value as EventFilter)}
                    >
                      <option>All</option>
                      <option>Blind</option>
                      <option>Swap</option>
                    </select>
                  </div>

                  <PlayerStatsSummary row={playerSeasonStats} />

                  <div className="space-y-4">
                    <h3 className="text-lg font-black text-[#f04a22]">
                      Weekly Breakdown
                    </h3>

                    {groupedPlayerWeeks.length === 0 ? (
                      <p className="text-neutral-400">
                        No weekly records found for this selection.
                      </p>
                    ) : (
                      groupedPlayerWeeks.map(([weekLabel, byType]) => (
                        <div
                          key={weekLabel}
                          className="rounded-xl border border-neutral-800 bg-[#1c1c1c] p-4"
                        >
                          <h4 className="mb-3 text-xl font-black">{weekLabel}</h4>

                          {Object.entries(byType).map(([eventType, rows]) => (
                            <div key={eventType} className="mb-4">
                              <div className="mb-2 inline-block rounded-full bg-[#f04a22] px-3 py-1 text-xs font-black uppercase">
                                {eventType}
                              </div>
                              <WeeklyRowsTable rows={rows} compact />
                            </div>
                          ))}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </Card>
          </>
        )}

        {tab === "compare" && (
          <Card title="Compare Players">
            <div className="mb-4 flex flex-wrap gap-3">
              <select
                className="rounded-lg bg-[#242424] p-2"
                value={compareA}
                onChange={(e) => setCompareA(e.target.value)}
              >
                <option value="">Player A</option>
                {players.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>

              <select
                className="rounded-lg bg-[#242424] p-2"
                value={compareB}
                onChange={(e) => setCompareB(e.target.value)}
              >
                <option value="">Player B</option>
                {players.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <tbody>
                  {compareKeys.map((col) => (
                    <tr key={col.label} className="border-t border-neutral-800">
                      <td className="p-2 text-neutral-400">{col.label}</td>
                      <td className="p-2">
                        {formatValue(getStatValue(statA, col.keys), col.decimals)}
                      </td>
                      <td className="p-2">
                        {formatValue(getStatValue(statB, col.keys), col.decimals)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </section>

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-neutral-800 bg-black/95 p-2 md:hidden">
        <div className="grid grid-cols-5 gap-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`rounded-lg px-2 py-3 text-xs font-bold ${
                tab === item.id ? "bg-[#f04a22]" : "bg-[#1d1d1d]"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </nav>
    </main>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-neutral-800 bg-[#141414] p-4 shadow-xl">
      <h2 className="mb-4 text-xl font-black">{title}</h2>
      {children}
    </section>
  );
}

function Table({ rows }: { rows: any[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-neutral-400">
            <th className="p-2">#</th>
            <th className="p-2">Player</th>
            <th className="p-2">Points</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row.name}-${index}`} className="border-t border-neutral-800">
              <td className="p-2">{index + 1}</td>
              <td className="p-2 font-bold">{row.name}</td>
              <td className="p-2 text-[#f04a22]">
                {formatValue(row.points, 0)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatsTable({
  rows,
  sortKey,
  sortDirection,
  onSort,
}: {
  rows: any[];
  sortKey: string;
  sortDirection: SortDirection;
  onSort: (key: string) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1150px] text-[12px]">
        <thead>
          <tr className="text-left text-neutral-400">
            <th className="sticky left-0 z-10 bg-[#141414] p-2">Player</th>
            {statColumns.map((col) => (
              <th
                key={col.label}
                className="cursor-pointer whitespace-nowrap p-2 hover:text-[#f04a22]"
                onClick={() => onSort(col.label)}
              >
                {col.label}
                {sortKey === col.label ? (sortDirection === "asc" ? " ▲" : " ▼") : ""}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${getPlayer(row)}-${index}`} className="border-t border-neutral-800">
              <td className="sticky left-0 z-10 bg-[#141414] p-2 font-bold text-white">
                {getPlayer(row)}
              </td>
              {statColumns.map((col) => (
                <td key={col.label} className="whitespace-nowrap p-2 text-neutral-300">
                  {formatValue(getStatValue(row, col.keys), col.decimals)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PlayerStatsSummary({ row }: { row: any }) {
  if (!row) {
    return <p className="text-neutral-400">No season stats found for this player.</p>;
  }

  return (
    <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-5">
      {statColumns.map((col) => (
        <div
          key={col.label}
          className="rounded-xl border border-neutral-800 bg-[#202020] p-4"
        >
          <div className="text-xs font-bold uppercase text-neutral-400">
            {col.label}
          </div>
          <div className="mt-1 text-2xl font-black text-[#f04a22]">
            {formatValue(getStatValue(row, col.keys), col.decimals)}
          </div>
        </div>
      ))}
    </div>
  );
}

function WeeklyRowsTable({
  rows,
  compact = false,
}: {
  rows: any[];
  compact?: boolean;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[12px]">
        {!compact && (
          <thead>
            <tr className="text-left text-neutral-400">
              <th className="p-2">Player</th>
              <th className="p-2">Week</th>
              <th className="p-2">Type</th>
              <th className="p-2">Details</th>
            </tr>
          </thead>
        )}
        <tbody>
          {rows.map((row, index) => {
            const entries = getVisibleWeeklyEntries(row);

            return (
              <tr key={index} className="border-t border-neutral-800 align-top">
                <td className="p-2 font-bold text-[#f04a22]">{getPlayer(row)}</td>
                <td className="p-2 whitespace-nowrap">{getWeek(row)}</td>
                <td className="p-2 whitespace-nowrap">{getType(row)}</td>
                <td className="p-2">
                  <div className="flex flex-wrap gap-2">
                    {entries.length === 0 ? (
                      <span className="text-neutral-500">No details</span>
                    ) : (
                      entries.map(([key, value]) => (
                        <span
                          key={key}
                          className="rounded-md bg-[#252525] px-2 py-1"
                        >
                          <span className="text-neutral-500">{key}: </span>
                          {formatValue(value)}
                        </span>
                      ))
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
