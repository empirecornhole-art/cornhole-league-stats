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

function norm(value: any) {
  return clean(value).toLowerCase();
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
  return clean(row.Week || row.week || row.WEEK || row["Week "]);
}

function getType(row: any) {
  return clean(row.Type || row.type || row.TYPE);
}

function getKind(row: any) {
  return clean(row.RecordKind || row.recordKind);
}

function isStatsRow(row: any) {
  return getKind(row) === "Stats";
}

function isStandingRow(row: any) {
  return getKind(row) === "Standing";
}

function samePlayer(a: any, b: any) {
  return norm(getPlayer(a)) === norm(getPlayer(b));
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

function getOverallWeekPoints(row: any, weekLabel: string) {
  const target = norm(weekLabel);

  // Most workbook columns are named exactly like "Week 1", "Week 2", etc.
  if (row?.[weekLabel] !== undefined && row?.[weekLabel] !== "") {
    return numberVal(row[weekLabel]);
  }

  // Fallback: find a column whose header matches the selected week after cleanup.
  const matchedKey = Object.keys(row || {}).find((key) => norm(key) === target);
  if (matchedKey && row[matchedKey] !== undefined && row[matchedKey] !== "") {
    return numberVal(row[matchedKey]);
  }

  // Fallback for headers like "Week 1 Points" or "Week 1 Total".
  const looseKey = Object.keys(row || {}).find((key) => {
    const cleaned = norm(key);
    return cleaned.startsWith(target) || cleaned.includes(`${target} `);
  });

  if (looseKey && row[looseKey] !== undefined && row[looseKey] !== "") {
    return numberVal(row[looseKey]);
  }

  return 0;
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
  if (String(value).includes("%")) return `${n.toFixed(decimals)}%`;
  if (Number.isInteger(n) || decimals === 0) return String(Math.round(n));
  return n.toFixed(decimals);
}

function weekSort(a: string, b: string) {
  return Number(a.replace(/[^0-9]/g, "")) - Number(b.replace(/[^0-9]/g, ""));
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

const weeklyStatColumns = [
  { label: "Rank", keys: ["Rank", "ranking"], decimals: 0 },
  { label: "PPR", keys: ["PPR", "ptsPerRnd"], decimals: 2 },
  { label: "Rounds", keys: ["Rounds", "rounds", "Rds"], decimals: 0 },
  { label: "Points", keys: ["Points", "totalPts", "Pts"], decimals: 0 },
  { label: "OPPR", keys: ["OPPR", "opponentPtsPerRnd"], decimals: 2 },
  { label: "Opp Pts", keys: ["Opp Pts", "opponentPts"], decimals: 0 },
  { label: "DPR", keys: ["DPR", "diffPerRnd"], decimals: 2 },
  { label: "4 Baggers", keys: ["4 Baggers", "TotalFourBaggers", "Total 4-Baggers"], decimals: 0 },
  { label: "4B %", keys: ["4 Bagger %", "fourBaggerPct"], decimals: 2 },
  { label: "Bags In %", keys: ["Bags In %", "bagsInPct"], decimals: 2 },
  { label: "Bags On %", keys: ["Bags On %", "bagsOnPct"], decimals: 2 },
  { label: "Bags Off %", keys: ["Bags Off %", "bagsOffPct"], decimals: 2 },
  { label: "Bags In/Rd", keys: ["Avg Bags In/Rd", "avgBagsInPerRnd"], decimals: 2 },
  { label: "Total Bags", keys: ["Total Bags", "totalBags"], decimals: 0 },
];

export default function LeagueClient() {
  const [data, setData] = useState<Data | null>(null);
  const [tab, setTab] = useState<Tab>("dashboard");
  const [season, setSeason] = useState("");
  const [player, setPlayer] = useState("All Players");
  const [type, setType] = useState<"Blind" | "Swap">("Blind");
  const [week, setWeek] = useState("");
  const [dashboardWeek, setDashboardWeek] = useState("All Weeks");
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

  const standings = useMemo(
    () =>
      (data?.standings || [])
        .filter((row) => !season || getSeason(row, season) === season)
        .filter((row) => player === "All Players" || getPlayer(row) === player)
        .map((row) => ({
          name: getPlayer(row) || "Unknown",
          points: pointValue(row),
          raw: row,
        }))
        .filter((row) => row.name !== "Unknown")
        .sort((a, b) => b.points - a.points),
    [data, season, player]
  );

  const seasonStats = useMemo(() => {
    const rows = (data?.stats || [])
      .filter((row) => !season || getSeason(row, season) === season)
      .filter((row) => player === "All Players" || getPlayer(row) === player)
      .filter((row) => getPlayer(row));

    const col = statColumns.find((c) => c.label === sortKey);

    return rows.sort((a, b) => {
      if (!col) return getPlayer(a).localeCompare(getPlayer(b));
      const av = getStatNumber(a, col.keys);
      const bv = getStatNumber(b, col.keys);
      if (av === bv) return getPlayer(a).localeCompare(getPlayer(b));
      return sortDirection === "asc" ? av - bv : bv - av;
    });
  }, [data, season, player, sortKey, sortDirection]);

  const selectedProfilePlayer = profilePlayer || (player !== "All Players" ? player : "");

  const weekEventRows = useMemo(
    () =>
      (data?.weekly || [])
        .filter((row) => (!season || getSeason(row, season) === season) && getType(row) === type)
        .filter((row) => player === "All Players" || getPlayer(row) === player),
    [data, season, type, player]
  );

  const weeks = useMemo(
    () => Array.from(new Set(weekEventRows.map(getWeek).filter(Boolean))).sort(weekSort),
    [weekEventRows]
  );

  useEffect(() => {
    if (!week || !weeks.includes(week)) setWeek(weeks[0] || "");
  }, [weeks, week]);

  const dashboardWeekOptions = useMemo(() => {
    return Array.from(
      new Set(
        (data?.weekly || [])
          .filter((row) => !season || getSeason(row, season) === season)
          .map(getWeek)
          .filter(Boolean)
      )
    ).sort(weekSort);
  }, [data, season]);

  useEffect(() => {
    if (dashboardWeek !== "All Weeks" && !dashboardWeekOptions.includes(dashboardWeek)) {
      setDashboardWeek("All Weeks");
    }
  }, [dashboardWeek, dashboardWeekOptions]);

  const dashboardWeekStandingRows = useMemo(() => {
    if (dashboardWeek === "All Weeks") return [];

    return (data?.standings || [])
      .filter((row) => !season || getSeason(row, season) === season)
      .filter((row) => player === "All Players" || getPlayer(row) === player)
      .map((row) => ({
        name: getPlayer(row) || "Unknown",
        points: getOverallWeekPoints(row, dashboardWeek),
        raw: row,
      }))
      .filter((row) => row.name !== "Unknown" && row.points > 0)
      .sort((a, b) => b.points - a.points);
  }, [data, season, player, dashboardWeek]);

  const dashboardWeekStats = useMemo(() => {
    if (dashboardWeek === "All Weeks") return [];
    return (data?.weekly || [])
      .filter((row) => isStatsRow(row))
      .filter((row) => !season || getSeason(row, season) === season)
      .filter((row) => getWeek(row) === dashboardWeek)
      .filter((row) => player === "All Players" || getPlayer(row) === player)
      .sort((a, b) => getStatNumber(b, ["PPR", "ptsPerRnd"]) - getStatNumber(a, ["PPR", "ptsPerRnd"]));
  }, [data, season, player, dashboardWeek]);

  const dashboardTopRows = dashboardWeek === "All Weeks" ? standings : dashboardWeekStandingRows;

  const visibleStandingRows = weekEventRows.filter((row) => getWeek(row) === week && isStandingRow(row));
  const visibleStatRows = weekEventRows.filter((row) => getWeek(row) === week && isStatsRow(row));

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
      .filter((row) => !profileSeason || getSeason(row, profileSeason) === profileSeason)
      .filter((row) => profileWeek === "All Weeks" || getWeek(row) === profileWeek)
      .filter((row) => profileType === "All" || getType(row) === profileType)
      .sort(
        (a, b) =>
          weekSort(getWeek(a), getWeek(b)) ||
          getType(a).localeCompare(getType(b)) ||
          getKind(a).localeCompare(getKind(b))
      );
  }, [data, selectedProfilePlayer, profileSeason, profileWeek, profileType]);

  const playerWeeks = useMemo(() => {
    if (!selectedProfilePlayer) return [];
    return Array.from(
      new Set(
        (data?.weekly || [])
          .filter((row) => getPlayer(row) === selectedProfilePlayer)
          .filter((row) => !profileSeason || getSeason(row, profileSeason) === profileSeason)
          .map(getWeek)
          .filter(Boolean)
      )
    ).sort(weekSort);
  }, [data, selectedProfilePlayer, profileSeason]);

  const groupedPlayerWeeks = useMemo(() => {
    const groups: Record<string, Record<string, { standings: any[]; stats: any[] }>> = {};

    for (const row of playerWeeklyRows) {
      const w = getWeek(row) || "No Week";
      const t = getType(row) || "Other";
      if (!groups[w]) groups[w] = {};
      if (!groups[w][t]) groups[w][t] = { standings: [], stats: [] };
      if (isStatsRow(row)) groups[w][t].stats.push(row);
      if (isStandingRow(row)) groups[w][t].standings.push(row);
    }

    return Object.entries(groups).sort(([a], [b]) => weekSort(a, b));
  }, [playerWeeklyRows]);

  const statA = (data?.stats || []).find(
    (row) => getPlayer(row) === compareA && (!season || getSeason(row, season) === season)
  );
  const statB = (data?.stats || []).find(
    (row) => getPlayer(row) === compareB && (!season || getSeason(row, season) === season)
  );

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
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
                className={`rounded-full px-4 py-2 text-sm font-bold ${
                  tab === item.id ? "bg-[#f04a22] text-white" : "bg-neutral-900 text-neutral-300 hover:bg-neutral-800"
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
              <label className="text-xs font-bold uppercase text-[#f04a22]">Season</label>
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
              <label className="text-xs font-bold uppercase text-[#f04a22]">Player</label>
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

            <div>
              <label className="text-xs font-bold uppercase text-[#f04a22]">Dashboard Week</label>
              <select
                className="block rounded-lg border border-neutral-700 bg-[#242424] p-2 text-white"
                value={dashboardWeek}
                onChange={(e) => setDashboardWeek(e.target.value)}
              >
                <option>All Weeks</option>
                {dashboardWeekOptions.map((w) => (
                  <option key={w}>{w}</option>
                ))}
              </select>
            </div>

            <div className="text-sm text-neutral-400">
              Last updated: {data.lastUpdated ? new Date(data.lastUpdated).toLocaleString() : "No upload date found"}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl space-y-6 p-4">
        {tab === "dashboard" && (
          <>
            <Card title={dashboardWeek === "All Weeks" ? "Top Standings" : `Top Weekly Scores - ${dashboardWeek}`}>
              <div className="grid gap-4 lg:grid-cols-[1.55fr_1fr]">
                <div className="h-[430px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dashboardTopRows.slice(0, 10)} margin={{ top: 28, right: 8, left: 0, bottom: 110 }}>
                      <XAxis dataKey="name" interval={0} angle={-35} textAnchor="end" height={115} tick={{ fontSize: 11 }} />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="points" fill="#f04a22">
                        <LabelList dataKey="points" position="top" fill="#fff" fontSize={12} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2">
                  {dashboardTopRows.slice(0, 10).map((row, index) => (
                    <div key={row.name} className="flex items-center justify-between rounded-lg bg-[#202020] px-3 py-2">
                      <span className="font-bold">{index + 1}. {row.name}</span>
                      <span className="font-black text-[#f04a22]">{formatValue(row.points, 0)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            <Card title={dashboardWeek === "All Weeks" ? (player === "All Players" ? "Season Stats" : `${player} Season Stats`) : `Player Event Stats - ${dashboardWeek}`}>
              {dashboardWeek === "All Weeks" ? (
                player === "All Players" ? (
                  <StatsTable
                    rows={seasonStats}
                    sortKey={sortKey}
                    sortDirection={sortDirection}
                    onSort={(key) => {
                      if (sortKey === key) setSortDirection(sortDirection === "asc" ? "desc" : "asc");
                      else {
                        setSortKey(key);
                        setSortDirection("desc");
                      }
                    }}
                  />
                ) : (
                  <PlayerStatsSummary row={seasonStats[0]} />
                )
              ) : (
                <WeeklyStatsTable rows={dashboardWeekStats} />
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
              <select className="rounded-lg bg-[#242424] p-2" value={type} onChange={(e) => { setType(e.target.value as "Blind" | "Swap"); setWeek(""); }}>
                <option>Blind</option>
                <option>Swap</option>
              </select>
              <select className="rounded-lg bg-[#242424] p-2" value={week} onChange={(e) => setWeek(e.target.value)}>
                {weeks.map((w) => <option key={w}>{w}</option>)}
              </select>
            </div>

            <h3 className="mb-2 font-black text-[#f04a22]">Standings with Player Stats</h3>
            <WeeklyCombinedTable standings={visibleStandingRows} stats={visibleStatRows} />

            <h3 className="mb-2 mt-6 font-black text-[#f04a22]">Event Player Stats</h3>
            <WeeklyStatsTable rows={visibleStatRows} />
            <EventSummary rows={visibleStatRows} />
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
                <p className="text-neutral-400">Select a player to view stats, seasons, weeks, and event breakdowns.</p>
              ) : (
                <div className="space-y-6">
                  <div className="flex flex-wrap gap-3">
                    <select className="rounded-lg bg-[#242424] p-2" value={profileSeason} onChange={(e) => { setProfileSeason(e.target.value); setProfileWeek("All Weeks"); }}>
                      {seasons.map((s) => <option key={s}>{s}</option>)}
                    </select>
                    <select className="rounded-lg bg-[#242424] p-2" value={profileWeek} onChange={(e) => setProfileWeek(e.target.value)}>
                      <option>All Weeks</option>
                      {playerWeeks.map((w) => <option key={w}>{w}</option>)}
                    </select>
                    <select className="rounded-lg bg-[#242424] p-2" value={profileType} onChange={(e) => setProfileType(e.target.value as EventFilter)}>
                      <option>All</option>
                      <option>Blind</option>
                      <option>Swap</option>
                    </select>
                  </div>

                  <PlayerStatsSummary row={playerSeasonStats} />

                  <h3 className="text-lg font-black text-[#f04a22]">Weekly Breakdown</h3>
                  {groupedPlayerWeeks.length === 0 ? (
                    <p className="text-neutral-400">No weekly records found for this selection.</p>
                  ) : (
                    groupedPlayerWeeks.map(([weekLabel, byType]) => (
                      <div key={weekLabel} className="rounded-xl border border-neutral-800 bg-[#1c1c1c] p-4">
                        <h4 className="mb-3 text-xl font-black">{weekLabel}</h4>
                        {Object.entries(byType).map(([eventType, group]) => (
                          <div key={eventType} className="mb-5">
                            <div className="mb-2 inline-block rounded-full bg-[#f04a22] px-3 py-1 text-xs font-black uppercase">{eventType}</div>
                            <div className="mb-2 text-sm font-bold text-neutral-300">Finish / Standing</div>
                            <WeeklyCombinedTable standings={group.standings} stats={group.stats} />
                            <EventSummary rows={group.stats} compact />
                          </div>
                        ))}
                      </div>
                    ))
                  )}
                </div>
              )}
            </Card>
          </>
        )}

        {tab === "compare" && (
          <Card title="Compare Players">
            <div className="mb-4 flex flex-wrap gap-3">
              <select className="rounded-lg bg-[#242424] p-2" value={compareA} onChange={(e) => setCompareA(e.target.value)}>
                <option value="">Player A</option>
                {players.map((p) => <option key={p}>{p}</option>)}
              </select>
              <select className="rounded-lg bg-[#242424] p-2" value={compareB} onChange={(e) => setCompareB(e.target.value)}>
                <option value="">Player B</option>
                {players.map((p) => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <tbody>
                  {statColumns.map((col) => (
                    <tr key={col.label} className="border-t border-neutral-800">
                      <td className="p-2 text-neutral-400">{col.label}</td>
                      <td className="p-2">{formatValue(getStatValue(statA, col.keys), col.decimals)}</td>
                      <td className="p-2">{formatValue(getStatValue(statB, col.keys), col.decimals)}</td>
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
            <button key={item.id} onClick={() => setTab(item.id)} className={`rounded-lg px-2 py-3 text-xs font-bold ${tab === item.id ? "bg-[#f04a22]" : "bg-[#1d1d1d]"}`}>
              {item.label}
            </button>
          ))}
        </div>
      </nav>
    </main>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
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
              <td className="p-2 text-[#f04a22]">{formatValue(row.points, 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatsTable({ rows, sortKey, sortDirection, onSort }: { rows: any[]; sortKey: string; sortDirection: SortDirection; onSort: (key: string) => void }) {
  return (
    <>
      <div className="grid gap-3 md:hidden">
        <div className="mb-1 flex items-center gap-2">
          <label className="text-xs font-bold uppercase text-neutral-400">Sort by</label>
          <select
            className="rounded-lg bg-[#242424] p-2 text-sm"
            value={sortKey}
            onChange={(e) => onSort(e.target.value)}
          >
            {statColumns.map((col) => (
              <option key={col.label}>{col.label}</option>
            ))}
          </select>
        </div>

        {rows.map((row, index) => (
          <div key={`${getPlayer(row)}-${index}`} className="rounded-xl border border-neutral-800 bg-[#202020] p-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="text-base font-black text-white">{getPlayer(row)}</div>
              <div className="rounded-full bg-[#f04a22] px-3 py-1 text-xs font-black text-white">
                #{index + 1}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {statColumns.map((col) => (
                <div key={col.label} className="rounded-lg bg-[#151515] p-2">
                  <div className="text-[10px] font-bold uppercase text-neutral-500">{col.label.replace("Average ", "Avg ")}</div>
                  <div className="text-lg font-black text-[#f04a22]">{formatValue(getStatValue(row, col.keys), col.decimals)}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full table-fixed text-[11px]">
          <thead>
            <tr className="text-left text-neutral-400">
              <th className="w-[105px] p-1.5">Player</th>
              {statColumns.map((col) => (
                <th key={col.label} className="cursor-pointer p-1.5 hover:text-[#f04a22]" onClick={() => onSort(col.label)}>
                  {col.label.replace("Average ", "Avg ")}{sortKey === col.label ? (sortDirection === "asc" ? " ▲" : " ▼") : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${getPlayer(row)}-${index}`} className="border-t border-neutral-800">
                <td className="p-1.5 font-bold text-white">{getPlayer(row)}</td>
                {statColumns.map((col) => (
                  <td key={col.label} className="p-1.5 text-neutral-300">{formatValue(getStatValue(row, col.keys), col.decimals)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function PlayerStatsSummary({ row }: { row: any }) {
  if (!row) return <p className="text-neutral-400">No season stats found for this player.</p>;
  return (
    <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-5">
      {statColumns.map((col) => (
        <div key={col.label} className="rounded-xl border border-neutral-800 bg-[#202020] p-4">
          <div className="text-xs font-bold uppercase text-neutral-400">{col.label}</div>
          <div className="mt-1 text-2xl font-black text-[#f04a22]">{formatValue(getStatValue(row, col.keys), col.decimals)}</div>
        </div>
      ))}
    </div>
  );
}

function findMatchingStat(standing: any, stats: any[]) {
  return stats.find((stat) => samePlayer(stat, standing));
}

function WeeklyCombinedTable({ standings, stats }: { standings: any[]; stats: any[] }) {
  return (
    <>
      <div className="grid gap-3 md:hidden">
        {standings.length === 0 ? (
          <p className="text-neutral-500">No standing rows found for this event.</p>
        ) : (
          standings.map((row, index) => {
            const stat = findMatchingStat(row, stats);
            return (
              <div key={index} className="rounded-xl border border-neutral-800 bg-[#202020] p-3">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <div className="text-lg font-black text-[#f04a22]">{getPlayer(row)}</div>
                    <div className="text-xs text-neutral-400">Rank {formatValue(row.Rank ?? row.RANK, 0)} {clean(row.Team ?? row.TEAM) ? `• Team ${clean(row.Team ?? row.TEAM)}` : ""}</div>
                  </div>
                  <div className="rounded-lg bg-[#151515] px-3 py-2 text-right">
                    <div className="text-[10px] uppercase text-neutral-500">Standing Pts</div>
                    <div className="font-black text-white">{formatValue(row.Points ?? row.POINTS, 0)}</div>
                  </div>
                </div>

                <div className="mb-3 grid grid-cols-3 gap-2 text-sm">
                  <MiniStat label="Wins" value={formatValue(row.Wins ?? row.WINS, 0)} />
                  <MiniStat label="Losses" value={formatValue(row.Losses ?? row.LOSSES, 0)} />
                  <MiniStat label="+/-" value={formatValue(row["+ / -"] ?? row["+/-"], 0)} />
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm">
                  {weeklyStatColumns.map((col) => (
                    <MiniStat key={col.label} label={col.label} value={formatValue(getStatValue(stat, col.keys), col.decimals)} />
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="text-left text-neutral-400">
              <th className="p-2">Rank</th>
              <th className="p-2">Player</th>
              <th className="p-2">Team</th>
              <th className="p-2">Standing Pts</th>
              <th className="p-2">Wins</th>
              <th className="p-2">Losses</th>
              <th className="p-2">+/-</th>
              {weeklyStatColumns.map((col) => (
                <th key={col.label} className="p-2">{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {standings.length === 0 ? (
              <tr><td className="p-2 text-neutral-500" colSpan={7 + weeklyStatColumns.length}>No standing rows found for this event.</td></tr>
            ) : (
              standings.map((row, index) => {
                const stat = findMatchingStat(row, stats);
                return (
                  <tr key={index} className="border-t border-neutral-800">
                    <td className="p-2">{formatValue(row.Rank ?? row.RANK, 0)}</td>
                    <td className="p-2 font-bold text-[#f04a22]">{getPlayer(row)}</td>
                    <td className="p-2">{clean(row.Team ?? row.TEAM) || "-"}</td>
                    <td className="p-2">{formatValue(row.Points ?? row.POINTS, 0)}</td>
                    <td className="p-2">{formatValue(row.Wins ?? row.WINS, 0)}</td>
                    <td className="p-2">{formatValue(row.Losses ?? row.LOSSES, 0)}</td>
                    <td className="p-2">{formatValue(row["+ / -"] ?? row["+/-"], 0)}</td>
                    {weeklyStatColumns.map((col) => (
                      <td key={col.label} className="p-2">{formatValue(getStatValue(stat, col.keys), col.decimals)}</td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function WeeklyStatsTable({ rows }: { rows: any[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[12px]">
        <thead>
          <tr className="text-left text-neutral-400">
            <th className="p-2">Player</th>
            {weeklyStatColumns.map((col) => <th key={col.label} className="p-2">{col.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td className="p-2 text-neutral-500" colSpan={weeklyStatColumns.length + 1}>No stat rows found for this event.</td></tr>
          ) : (
            rows.map((row, index) => (
              <tr key={index} className="border-t border-neutral-800">
                <td className="p-2 font-bold text-[#f04a22]">{getPlayer(row)}</td>
                {weeklyStatColumns.map((col) => (
                  <td key={col.label} className="p-2">{formatValue(getStatValue(row, col.keys), col.decimals)}</td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}


function summarizeEventStats(rows: any[]) {
  const numeric = (col: { label: string; keys: string[]; decimals: number }) =>
    rows
      .map((row) => getStatNumber(row, col.keys))
      .filter((value) => Number.isFinite(value) && value !== 0);

  const sumFor = (label: string) => {
    const col = weeklyStatColumns.find((item) => item.label === label);
    if (!col) return "-";
    const values = numeric(col);
    if (!values.length) return "-";
    return formatValue(values.reduce((a, b) => a + b, 0), col.decimals);
  };

  const avgFor = (label: string) => {
    const col = weeklyStatColumns.find((item) => item.label === label);
    if (!col) return "-";
    const values = numeric(col);
    if (!values.length) return "-";
    return formatValue(values.reduce((a, b) => a + b, 0) / values.length, col.decimals);
  };

  return {
    players: rows.length,
    totalRounds: sumFor("Rounds"),
    totalPoints: sumFor("Points"),
    avgPPR: avgFor("PPR"),
    avgOPPR: avgFor("OPPR"),
    avgDPR: avgFor("DPR"),
    totalOppPts: sumFor("Opp Pts"),
    totalFourBaggers: sumFor("4 Baggers"),
  };
}

function EventSummary({ rows, compact = false }: { rows: any[]; compact?: boolean }) {
  const summary = summarizeEventStats(rows);

  if (!rows.length) return null;

  return (
    <div className={`${compact ? "mt-3" : "mt-6"} rounded-xl border border-neutral-800 bg-[#202020] p-4`}>
      <h3 className="mb-3 text-base font-black text-[#f04a22]">
        Event Totals / Averages
      </h3>
      <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-4">
        <MiniStat label="Players" value={summary.players} />
        <MiniStat label="Total Rounds" value={summary.totalRounds} />
        <MiniStat label="Total Points" value={summary.totalPoints} />
        <MiniStat label="Avg PPR" value={summary.avgPPR} />
        <MiniStat label="Avg OPPR" value={summary.avgOPPR} />
        <MiniStat label="Avg DPR" value={summary.avgDPR} />
        <MiniStat label="Opp Points" value={summary.totalOppPts} />
        <MiniStat label="4 Baggers" value={summary.totalFourBaggers} />
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-lg bg-[#151515] p-2">
      <div className="text-[10px] font-bold uppercase text-neutral-500">{label}</div>
      <div className="text-base font-black text-[#f04a22]">{value || "-"}</div>
    </div>
  );
}
