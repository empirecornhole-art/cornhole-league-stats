"use client";

import { useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
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
  weekScores?: any[];
};

type Tab = "dashboard" | "standings" | "weeks" | "stats" | "players" | "scenarios" | "compare";
type EventFilter = "All" | "Blind" | "Swap";
type SortDirection = "asc" | "desc";

function clean(value: any) {
  return String(value ?? "").trim();
}

function compact(value: any) {
  return clean(value).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isValidPlayerName(value: any) {
  const name = clean(value);
  const id = compact(name);

  if (!name) return false;
  if (/^\d+$/.test(name)) return false;

  return ![
    "standings",
    "overall",
    "grandtotal",
    "totalplayers",
    "ghostplayer",
    "player",
    "players",
    "playername",
    "name",
  ].includes(id);
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
  if (value === null || value === undefined || value === "") return 0;
  const n = Number(String(value).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function getValue(row: any, keys: string[]) {
  for (const key of keys) {
    if (row?.[key] !== undefined && row?.[key] !== "" && row?.[key] !== null) return row[key];
  }

  const wanted = keys.map(compact);
  const found = Object.keys(row || {}).find((key) => wanted.includes(compact(key)));
  return found ? row[found] : "";
}

function getStatValue(row: any, keys: string[]) {
  return getValue(row || {}, keys);
}

function pointValue(row: any) {
  return numberVal(
    getValue(row, [
      "Overall",
      "Standing Points",
      "standing_points",
      "Points",
      "Total Points",
      "Total Pts",
    ])
  );
}

function formatValue(value: any, decimals = 2) {
  if (value === "" || value === null || value === undefined) return "-";
  const n = numberVal(value);
  if (!Number.isFinite(n)) return String(value);
  if (String(value).includes("%")) return `${n.toFixed(2)}%`;
  if (Number.isInteger(n) || decimals === 0) return String(Math.round(n));
  return n.toFixed(decimals).replace(/\.00$/, "");
}

function weekSort(a: string, b: string) {
  const an = Number(clean(a).replace(/[^0-9]/g, ""));
  const bn = Number(clean(b).replace(/[^0-9]/g, ""));
  return an - bn;
}

const seasonOrder: Record<string, number> = {
  spring: 1,
  summer: 2,
  fall: 3,
  winter: 4,
};

function seasonSort(a: string, b: string) {
  const parse = (season: string) => {
    const value = clean(season).toLowerCase();
    const yearMatch = value.match(/(\d{2,4})/);
    const year = yearMatch ? Number(yearMatch[1].slice(-2)) : 0;
    const label = Object.keys(seasonOrder).find((word) => value.includes(word)) || "spring";
    return { year, order: seasonOrder[label] || 99 };
  };

  const av = parse(a);
  const bv = parse(b);
  if (av.year !== bv.year) return av.year - bv.year;
  return av.order - bv.order;
}

const statColumns = [
  { label: "Finish", keys: ["Finish", "Rank"], decimals: 0 },
  { label: "Total Rounds", keys: ["Total Rounds"], decimals: 0 },
  { label: "Total Pts", keys: ["Total Pts", "Total Points"], decimals: 0 },
  { label: "Average PPR", keys: ["Average PPR", "PPR"], decimals: 2 },
  { label: "Opp Avg PPR", keys: ["Opponents Avg PPR", "OPPR", "Opp Avg PPR"], decimals: 2 },
  { label: "Average DPR", keys: ["Average DPR", "DPR"], decimals: 2 },
  { label: "Opp Pts", keys: ["Opponents Pts", "Opp Pts"], decimals: 0 },
  { label: "Avg Bags In", keys: ["Avg Bags In"], decimals: 2 },
  { label: "Total Bags In", keys: ["Total Bags In"], decimals: 0 },
  { label: "Avg Bags In/Rd", keys: ["Avg Bags In per Rd", "Avg Bags In/Rd"], decimals: 2 },
  { label: "Bags On %", keys: ["Bags On %"], decimals: 2 },
  { label: "Bags Off %", keys: ["Bags Off %"], decimals: 2 },
  { label: "Total Bags", keys: ["Total Bags Thrown", "Total Bags"], decimals: 0 },
  { label: "Avg 4-Bagger %", keys: ["Avg 4-Bagger %"], decimals: 2 },
  { label: "Total 4-Baggers", keys: ["Total 4-Baggers", "4 Baggers"], decimals: 0 },
  { label: "1st in Stats", keys: ["1st in Stats"], decimals: 0 },
  { label: "Avg Rounds/Swap", keys: ["Avg Rounds/Swap Game", "Avg Rounds/Swap"], decimals: 2 },
];

const weeklyStatColumns = [
  { label: "PPR", keys: ["PPR"], decimals: 2 },
  { label: "Rounds", keys: ["Rounds"], decimals: 0 },
  { label: "Points", keys: ["Points"], decimals: 0 },
  { label: "OPPR", keys: ["OPPR"], decimals: 2 },
  { label: "Opp Pts", keys: ["Opp Pts"], decimals: 0 },
  { label: "DPR", keys: ["DPR"], decimals: 2 },
  { label: "4 Baggers", keys: ["4 Baggers"], decimals: 0 },
];

function eventIdentity(row: any) {
  return `${compact(getSeason(row))}|${compact(getWeek(row))}|${compact(getType(row))}|${compact(getPlayer(row))}`;
}

function mergeWeeklyRows(weeklyRows: any[], eventStatsRows: any[]) {
  const statMap = new Map<string, any>();
  for (const stat of eventStatsRows || []) {
    if (!isValidPlayerName(getPlayer(stat))) continue;
    statMap.set(eventIdentity(stat), stat);
  }

  return (weeklyRows || [])
    .filter((row) => isValidPlayerName(getPlayer(row)))
    .map((row) => {
      const stat = statMap.get(eventIdentity(row)) || {};
      return {
        ...row,
        PPR: getValue(stat, ["PPR"]),
        Rounds: getValue(stat, ["Rounds"]),
        StatPoints: getValue(stat, ["Points"]),
        OPPR: getValue(stat, ["OPPR"]),
        "Opp Pts": getValue(stat, ["Opp Pts"]),
        DPR: getValue(stat, ["DPR"]),
        "4 Baggers": getValue(stat, ["4 Baggers"]),
      };
    });
}

function summarizeSeasonStats(rows: any[]) {
  const valid = rows.filter((row) => isValidPlayerName(getPlayer(row)));
  const avg = (keys: string[], decimals = 2) => {
    const values = valid.map((row) => numberVal(getStatValue(row, keys))).filter((n) => Number.isFinite(n));
    if (!values.length) return "-";
    return formatValue(values.reduce((a, b) => a + b, 0) / values.length, decimals);
  };
  const sum = (keys: string[], decimals = 0) => {
    const total = valid.reduce((acc, row) => acc + numberVal(getStatValue(row, keys)), 0);
    return total ? formatValue(total, decimals) : "-";
  };

  return [
    { label: "Players", value: valid.length },
    { label: "Total Rounds", value: sum(["Total Rounds"], 0) },
    { label: "Total Points", value: sum(["Total Pts", "Total Points"], 0) },
    { label: "Avg PPR", value: avg(["Average PPR", "PPR"], 2) },
    { label: "Avg OPPR", value: avg(["Opponents Avg PPR", "OPPR"], 2) },
    { label: "Avg DPR", value: avg(["Average DPR", "DPR"], 2) },
    { label: "Total 4-Baggers", value: sum(["Total 4-Baggers", "4 Baggers"], 0) },
    { label: "Avg Bags On %", value: avg(["Bags On %"], 2) },
  ];
}

function summarizeEvent(rows: any[]) {
  const valid = rows.filter((row) => isValidPlayerName(getPlayer(row)));
  const avg = (key: string) => {
    const values = valid.map((row) => numberVal(row[key])).filter((n) => n !== 0);
    if (!values.length) return "-";
    return formatValue(values.reduce((a, b) => a + b, 0) / values.length, 2);
  };
  const sum = (key: string) => {
    const total = valid.reduce((acc, row) => acc + numberVal(row[key]), 0);
    return total ? formatValue(total, 0) : "-";
  };

  return [
    { label: "Players", value: valid.length },
    { label: "Total Rounds", value: sum("Rounds") },
    { label: "Total Points", value: sum("StatPoints") },
    { label: "Avg PPR", value: avg("PPR") },
    { label: "Avg OPPR", value: avg("OPPR") },
    { label: "Avg DPR", value: avg("DPR") },
    { label: "Opp Points", value: sum("Opp Pts") },
    { label: "4 Baggers", value: sum("4 Baggers") },
  ];
}

function sumBestScores(scores: number[], count = 9) {
  return [...scores].sort((a, b) => b - a).slice(0, count).reduce((acc, value) => acc + value, 0);
}

function highestScore(scores: number[]) {
  return scores.length ? Math.max(...scores) : 0;
}

function buildPlayerWeekScores(rows: any[], playerName: string, scenarioWeek: string, projectedValue?: string) {
  const byWeek = new Map<number, number>();

  for (const row of rows) {
    if (getPlayer(row) !== playerName) continue;
    const weekNumber = numberVal(row.WeekNumber || getWeek(row));
    if (!weekNumber) continue;
    byWeek.set(weekNumber, numberVal(row.Score));
  }

  const scenarioWeekNumber = numberVal(scenarioWeek);
  if (scenarioWeekNumber && projectedValue !== undefined && projectedValue !== "") {
    byWeek.set(scenarioWeekNumber, numberVal(projectedValue));
  }

  return Array.from(byWeek.values());
}

function getCurrentRank(standings: { name: string; points: number }[], playerName: string) {
  const index = standings.findIndex((row) => row.name === playerName);
  return index >= 0 ? index + 1 : null;
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
  const [selectedStatsPlayers, setSelectedStatsPlayers] = useState<string[]>([]);
  const [scenarioWeek, setScenarioWeek] = useState("Week 12");
  const [scenarioInputs, setScenarioInputs] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch("/api/data", { cache: "no-store" })
      .then((res) => res.json())
      .then((loaded) => {
        setData(loaded);
        const firstSeason = [...(loaded.seasons || [])].sort(seasonSort)[0] || "";
        setSeason(firstSeason);
      });
  }, []);

  const seasons = useMemo(() => [...(data?.seasons || [])].sort(seasonSort), [data]);
  const players = useMemo(
    () => (data?.players || []).filter(isValidPlayerName).sort((a, b) => a.localeCompare(b)),
    [data]
  );

  const eventStats = data?.eventStats || [];
  const weekScores = data?.weekScores || [];

  const allWeeklyMerged = useMemo(
    () => mergeWeeklyRows(data?.weekly || [], eventStats),
    [data, eventStats]
  );

  const seasonStatsAll = useMemo(
    () => (data?.stats || []).filter((row) => isValidPlayerName(getPlayer(row))),
    [data]
  );

  const selectedSeasonStats = useMemo(
    () => seasonStatsAll.filter((row) => !season || getSeason(row) === season),
    [seasonStatsAll, season]
  );

  const dashboardStandings = useMemo(() => {
    if (dashboardWeek === "All Weeks") {
      return (data?.standings || [])
        .filter((row) => isValidPlayerName(getPlayer(row)))
        .filter((row) => !season || getSeason(row, season) === season)
        .filter((row) => player === "All Players" || getPlayer(row) === player)
        .map((row) => ({ name: getPlayer(row), points: pointValue(row), raw: row }))
        .filter((row) => row.name && row.points > 0)
        .sort((a, b) => b.points - a.points);
    }

    const totals = new Map<string, number>();
    for (const row of allWeeklyMerged) {
      if (getSeason(row) !== season) continue;
      if (getWeek(row) !== dashboardWeek) continue;
      if (player !== "All Players" && getPlayer(row) !== player) continue;
      totals.set(getPlayer(row), (totals.get(getPlayer(row)) || 0) + numberVal(row.Points));
    }

    return Array.from(totals.entries())
      .map(([name, points]) => ({ name, points, raw: {} }))
      .filter((row) => isValidPlayerName(row.name) && row.points > 0)
      .sort((a, b) => b.points - a.points);
  }, [data, season, player, dashboardWeek, allWeeklyMerged]);

  const dashboardWeeks = useMemo(() => {
    const values = Array.from(
      new Set(allWeeklyMerged.filter((row) => getSeason(row) === season).map(getWeek).filter(Boolean))
    ).sort(weekSort);
    return ["All Weeks", ...values];
  }, [allWeeklyMerged, season]);

  const weeksRowsForType = useMemo(
    () =>
      allWeeklyMerged.filter((row) => {
        return getSeason(row) === season && getType(row) === type;
      }),
    [allWeeklyMerged, season, type]
  );

  const weeks = useMemo(
    () => Array.from(new Set(weeksRowsForType.map(getWeek).filter(Boolean))).sort(weekSort),
    [weeksRowsForType]
  );

  useEffect(() => {
    if (!week || !weeks.includes(week)) setWeek(weeks[0] || "");
  }, [weeks, week]);

  const visibleWeekRows = useMemo(
    () =>
      weeksRowsForType
        .filter((row) => getWeek(row) === week)
        .filter((row) => player === "All Players" || getPlayer(row) === player)
        .sort((a, b) => numberVal(a.Rank) - numberVal(b.Rank) || getPlayer(a).localeCompare(getPlayer(b))),
    [weeksRowsForType, week, player]
  );

  const statsTabRows = useMemo(() => {
    const selected = selectedStatsPlayers.length
      ? selectedStatsPlayers
      : player !== "All Players"
      ? [player]
      : [];

    const selectedColumn = statColumns.find((col) => col.label === sortKey);

    return selectedSeasonStats
      .filter((row) => !selected.length || selected.includes(getPlayer(row)))
      .sort((a, b) => {
        if (!selectedColumn) return getPlayer(a).localeCompare(getPlayer(b));
        const av = numberVal(getStatValue(a, selectedColumn.keys));
        const bv = numberVal(getStatValue(b, selectedColumn.keys));
        if (av === bv) return getPlayer(a).localeCompare(getPlayer(b));
        return sortDirection === "asc" ? av - bv : bv - av;
      });
  }, [selectedSeasonStats, selectedStatsPlayers, player, sortKey, sortDirection]);

  const selectedProfilePlayer = player !== "All Players" ? player : "";

  const profileSeasonStats = useMemo(() => {
    if (!selectedProfilePlayer) return [];
    return seasonStatsAll
      .filter((row) => getPlayer(row) === selectedProfilePlayer)
      .filter((row) => profileSeason === "All Seasons" || getSeason(row) === profileSeason)
      .sort((a, b) => seasonSort(getSeason(a), getSeason(b)));
  }, [seasonStatsAll, selectedProfilePlayer, profileSeason]);

  const profileWeeks = useMemo(() => {
    if (!selectedProfilePlayer) return [];
    return Array.from(
      new Set(
        allWeeklyMerged
          .filter((row) => getPlayer(row) === selectedProfilePlayer)
          .filter((row) => profileSeason === "All Seasons" || getSeason(row) === profileSeason)
          .map(getWeek)
          .filter(Boolean)
      )
    ).sort(weekSort);
  }, [allWeeklyMerged, selectedProfilePlayer, profileSeason]);

  const profileWeeklyRows = useMemo(() => {
    if (!selectedProfilePlayer) return [];
    return allWeeklyMerged
      .filter((row) => getPlayer(row) === selectedProfilePlayer)
      .filter((row) => profileSeason === "All Seasons" || getSeason(row) === profileSeason)
      .filter((row) => profileWeek === "All Weeks" || getWeek(row) === profileWeek)
      .filter((row) => profileType === "All" || getType(row) === profileType)
      .sort((a, b) => seasonSort(getSeason(a), getSeason(b)) || weekSort(getWeek(a), getWeek(b)) || getType(a).localeCompare(getType(b)));
  }, [allWeeklyMerged, selectedProfilePlayer, profileSeason, profileWeek, profileType]);

  const groupedProfileWeeks = useMemo(() => {
    const groups: Record<string, any[]> = {};
    for (const row of profileWeeklyRows) {
      const key = `${getSeason(row)} - ${getWeek(row)} - ${getType(row)}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(row);
    }
    return Object.entries(groups);
  }, [profileWeeklyRows]);

  const progressData = profileSeasonStats.map((row) => ({
    season: getSeason(row),
    PPR: numberVal(getStatValue(row, ["Average PPR", "PPR"])),
    DPR: numberVal(getStatValue(row, ["Average DPR", "DPR"])),
  }));


  const scenarioSeasonScores = useMemo(
    () => weekScores.filter((row) => getSeason(row) === season && isValidPlayerName(getPlayer(row))),
    [weekScores, season]
  );

  const scenarioWeeks = useMemo(() => {
    const values = Array.from(new Set(scenarioSeasonScores.map((row) => getWeek(row)).filter(Boolean))).sort(weekSort);
    return values.length ? values : ["Week 12"];
  }, [scenarioSeasonScores]);

  useEffect(() => {
    if (!scenarioWeeks.includes(scenarioWeek)) setScenarioWeek(scenarioWeeks[scenarioWeeks.length - 1] || "Week 12");
  }, [scenarioWeeks, scenarioWeek]);

  const pprByPlayer = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of selectedSeasonStats) map.set(getPlayer(row), numberVal(getStatValue(row, ["Average PPR", "PPR"])));
    return map;
  }, [selectedSeasonStats]);

  const scenarioRows = useMemo(() => {
    return players
      .map((name) => {
        const currentScores = buildPlayerWeekScores(scenarioSeasonScores, name, scenarioWeek);
        const projectedScores = buildPlayerWeekScores(scenarioSeasonScores, name, scenarioWeek, scenarioInputs[name]);
        const currentTotal = sumBestScores(currentScores, 9);
        const projectedTotal = sumBestScores(projectedScores, 9);
        const projectedScore = scenarioInputs[name] ?? "";
        const ppr = pprByPlayer.get(name) || 0;
        const currentRank = getCurrentRank(dashboardStandings, name);

        return {
          name,
          currentRank,
          currentTotal,
          lowestCounted: [...currentScores].sort((a, b) => b - a)[8] ?? 0,
          projectedScore,
          netGain: projectedTotal - currentTotal,
          projectedTotal,
          highestWeek: highestScore(projectedScores),
          ppr,
        };
      })
      .filter((row) => row.currentTotal > 0 || row.projectedScore !== "")
      .sort((a, b) => {
        if (b.projectedTotal !== a.projectedTotal) return b.projectedTotal - a.projectedTotal;
        if (b.highestWeek !== a.highestWeek) return b.highestWeek - a.highestWeek;
        return b.ppr - a.ppr;
      })
      .map((row, index) => ({ ...row, projectedRank: index + 1 }));
  }, [players, scenarioSeasonScores, scenarioWeek, scenarioInputs, pprByPlayer, dashboardStandings]);

  const scenarioSelectedPlayer = player !== "All Players" ? player : scenarioRows[0]?.name || "";
  const selectedScenario = scenarioRows.find((row) => row.name === scenarioSelectedPlayer);

  const statA = seasonStatsAll.find((row) => getPlayer(row) === compareA && getSeason(row) === season);
  const statB = seasonStatsAll.find((row) => getPlayer(row) === compareB && getSeason(row) === season);

  if (!data) {
    return <main className="min-h-screen bg-black p-6 text-white">Loading League Stats...</main>;
  }

  const navItems: { id: Tab; label: string }[] = [
    { id: "dashboard", label: "Dashboard" },
    { id: "standings", label: "Standings" },
    { id: "weeks", label: "Weeks" },
    { id: "stats", label: "Stats" },
    { id: "players", label: "Players" },
    { id: "scenarios", label: "Scenarios" },
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
                className={`rounded-full px-4 py-2 text-sm font-bold ${tab === item.id ? "bg-[#f04a22] text-white" : "bg-neutral-900 text-neutral-300 hover:bg-neutral-800"}`}
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
                  setDashboardWeek("All Weeks");
                }}
              >
                {seasons.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold uppercase text-[#f04a22]">Player</label>
              <select className="block rounded-lg border border-neutral-700 bg-[#242424] p-2 text-white" value={player} onChange={(e) => setPlayer(e.target.value)}>
                <option>All Players</option>
                {players.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold uppercase text-[#f04a22]">Dashboard Week</label>
              <select className="block rounded-lg border border-neutral-700 bg-[#242424] p-2 text-white" value={dashboardWeek} onChange={(e) => setDashboardWeek(e.target.value)}>
                {dashboardWeeks.map((w) => (
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
            <Card title="Top Standings">
              <RankedList rows={dashboardStandings.slice(0, 20)} />
            </Card>

            <Card title={`${season} League Overview`}>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {summarizeSeasonStats(selectedSeasonStats).map((item) => (
                  <MiniStat key={item.label} label={item.label} value={item.value} />
                ))}
              </div>
              <p className="mt-4 text-sm text-neutral-400">Individual player stat tables are now under the Stats tab.</p>
            </Card>
          </>
        )}

        {tab === "standings" && (
          <Card title="Season Standings">
            <StandingsTable rows={dashboardStandings} />
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
                {weeks.map((w) => (
                  <option key={w}>{w}</option>
                ))}
              </select>
            </div>

            <h3 className="mb-2 text-lg font-black text-[#f04a22]">Standings</h3>
            <WeeklyTable rows={visibleWeekRows} />
            <EventSummary rows={visibleWeekRows} />
          </Card>
        )}

        {tab === "stats" && (
          <Card title="Season Stats">
            <div className="mb-4 space-y-3">
              <div>
                <div className="mb-2 text-sm font-bold text-neutral-300">Multi-select players for this tab</div>
                <div className="grid max-h-56 gap-2 overflow-y-auto rounded-xl border border-neutral-800 bg-[#101010] p-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                  {players.map((p) => (
                    <label key={p} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={selectedStatsPlayers.includes(p)}
                        onChange={(e) => {
                          setSelectedStatsPlayers((current) =>
                            e.target.checked ? [...current, p] : current.filter((name) => name !== p)
                          );
                        }}
                      />
                      <span>{p}</span>
                    </label>
                  ))}
                </div>
                {selectedStatsPlayers.length > 0 && (
                  <button className="mt-2 rounded-lg bg-[#242424] px-3 py-2 text-sm font-bold" onClick={() => setSelectedStatsPlayers([])}>
                    Clear multi-select
                  </button>
                )}
              </div>
            </div>

            <StatsTable
              rows={statsTabRows}
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
          </Card>
        )}

        {tab === "players" && (
          <Card title={selectedProfilePlayer ? `${selectedProfilePlayer} Profile` : "Player Profile"}>
            {!selectedProfilePlayer ? (
              <p className="text-neutral-400">Choose a player from the top Player dropdown to view their profile.</p>
            ) : (
              <div className="space-y-6">
                <div className="flex flex-wrap gap-3">
                  <select className="rounded-lg bg-[#242424] p-2" value={profileSeason} onChange={(e) => { setProfileSeason(e.target.value); setProfileWeek("All Weeks"); }}>
                    <option>All Seasons</option>
                    {seasons.map((s) => <option key={s}>{s}</option>)}
                  </select>
                  <select className="rounded-lg bg-[#242424] p-2" value={profileWeek} onChange={(e) => setProfileWeek(e.target.value)}>
                    <option>All Weeks</option>
                    {profileWeeks.map((w) => <option key={w}>{w}</option>)}
                  </select>
                  <select className="rounded-lg bg-[#242424] p-2" value={profileType} onChange={(e) => setProfileType(e.target.value as EventFilter)}>
                    <option>All</option>
                    <option>Blind</option>
                    <option>Swap</option>
                  </select>
                </div>

                <PlayerStatsSummary row={profileSeasonStats[profileSeasonStats.length - 1]} />

                <div>
                  <h3 className="mb-3 text-lg font-black text-[#f04a22]">Season Finishes</h3>
                  <SeasonFinishesTable rows={profileSeasonStats} />
                </div>

                <div>
                  <h3 className="mb-3 text-lg font-black text-[#f04a22]">Progress Over Time</h3>
                  <div className="h-72 rounded-xl border border-neutral-800 p-3">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={progressData}>
                        <XAxis dataKey="season" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="DPR" stroke="#ffffff" strokeWidth={3} />
                        <Line type="monotone" dataKey="PPR" stroke="#f04a22" strokeWidth={3} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div>
                  <h3 className="mb-3 text-lg font-black text-[#f04a22]">Weekly Breakdown</h3>
                  <div className="space-y-4">
                    {groupedProfileWeeks.map(([label, rows]) => (
                      <div key={label} className="rounded-xl border border-neutral-800 bg-[#1c1c1c] p-4">
                        <h4 className="mb-3 text-xl font-black">{label}</h4>
                        <WeeklyTable rows={rows} />
                        <EventSummary rows={rows} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </Card>
        )}

        {tab === "scenarios" && (
          <Card title="Final Week Scenarios">
            <div className="mb-4 rounded-xl border border-neutral-800 bg-[#202020] p-4 text-sm text-neutral-300">
              Enter a projected combined weekly score for the selected week. The calculator keeps each player's best 9 scores and ranks ties by highest single week, then season PPR.
            </div>

            <div className="mb-4 flex flex-wrap gap-3">
              <select className="rounded-lg bg-[#242424] p-2" value={scenarioWeek} onChange={(e) => setScenarioWeek(e.target.value)}>
                {scenarioWeeks.map((w) => <option key={w}>{w}</option>)}
              </select>
              <button className="rounded-lg bg-[#242424] px-3 py-2 text-sm font-bold" onClick={() => setScenarioInputs({})}>
                Clear projected scores
              </button>
            </div>

            {selectedScenario && (
              <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <MiniStat label="Selected Player" value={selectedScenario.name} />
                <MiniStat label="Current Rank" value={selectedScenario.currentRank || "-"} />
                <MiniStat label="Current Points" value={formatValue(selectedScenario.currentTotal, 0)} />
                <MiniStat label="Projected Rank" value={selectedScenario.projectedRank} />
                <MiniStat label="Projected Points" value={formatValue(selectedScenario.projectedTotal, 0)} />
              </div>
            )}

            <ScenarioTable
              rows={scenarioRows}
              inputs={scenarioInputs}
              setInputs={setScenarioInputs}
              selectedPlayer={scenarioSelectedPlayer}
            />
          </Card>
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
            <CompareTable statA={statA} statB={statB} />
          </Card>
        )}
      </section>

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-neutral-800 bg-black/95 p-2 md:hidden">
        <div className="grid grid-cols-7 gap-1">
          {navItems.map((item) => (
            <button key={item.id} onClick={() => setTab(item.id)} className={`rounded-lg px-1 py-3 text-[10px] font-bold ${tab === item.id ? "bg-[#f04a22]" : "bg-[#1d1d1d]"}`}>
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

function MiniStat({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-[#101010] p-4">
      <div className="text-xs font-bold uppercase text-neutral-400">{label}</div>
      <div className="mt-1 text-3xl font-black text-[#f04a22]">{value}</div>
    </div>
  );
}

function RankedList({ rows }: { rows: { name: string; points: number }[] }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map((row, index) => (
        <div key={`${row.name}-${index}`} className="flex items-center justify-between rounded-xl bg-[#202020] px-4 py-3">
          <span className="font-black">{index + 1}. {row.name}</span>
          <span className="text-xl font-black text-[#f04a22]">{formatValue(row.points, 0)}</span>
        </div>
      ))}
    </div>
  );
}

function StandingsTable({ rows }: { rows: { name: string; points: number }[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead><tr className="text-left text-neutral-400"><th className="p-2">#</th><th className="p-2">Player</th><th className="p-2">Points</th></tr></thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row.name}-${index}`} className="border-t border-neutral-800"><td className="p-2">{index + 1}</td><td className="p-2 font-bold text-[#f04a22]">{row.name}</td><td className="p-2">{formatValue(row.points, 0)}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function WeeklyTable({ rows }: { rows: any[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[12px]">
        <thead>
          <tr className="text-left text-neutral-400">
            <th className="p-2">Rank</th><th className="p-2">Player</th><th className="p-2">Team</th><th className="p-2">Finish Pts</th><th className="p-2">+/-</th>
            {weeklyStatColumns.map((col) => <th key={col.label} className="p-2">{col.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${getPlayer(row)}-${getSeason(row)}-${getWeek(row)}-${getType(row)}-${index}`} className="border-t border-neutral-800">
              <td className="p-2">{formatValue(row.Rank, 0)}</td>
              <td className="p-2 font-bold text-[#f04a22]">{getPlayer(row)}</td>
              <td className="p-2">{clean(row.Team) || "-"}</td>
              <td className="p-2">{formatValue(row.Points, 0)}</td>
              <td className="p-2">{formatValue(row["+/-"], 0)}</td>
              {weeklyStatColumns.map((col) => (
                <td key={col.label} className="p-2">{formatValue(getStatValue(row, col.label === "Points" ? ["StatPoints"] : col.keys), col.decimals)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EventSummary({ rows }: { rows: any[] }) {
  return (
    <div className="mt-6 rounded-xl border border-neutral-800 bg-[#202020] p-4">
      <h3 className="mb-3 text-lg font-black text-[#f04a22]">Event Totals / Averages</h3>
      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
        {summarizeEvent(rows).map((item) => <MiniStat key={item.label} label={item.label} value={item.value} />)}
      </div>
    </div>
  );
}

function StatsTable({ rows, sortKey, sortDirection, onSort }: { rows: any[]; sortKey: string; sortDirection: SortDirection; onSort: (key: string) => void }) {
  return (
    <>
      <div className="grid gap-3 md:hidden">
        {rows.map((row, index) => (
          <div key={`${getPlayer(row)}-${index}`} className="rounded-xl border border-neutral-800 bg-[#202020] p-4">
            <div className="mb-3 text-lg font-black text-[#f04a22]">{getPlayer(row)}</div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {statColumns.map((col) => <div key={col.label}><div className="text-xs uppercase text-neutral-500">{col.label}</div><div className="font-bold">{formatValue(getStatValue(row, col.keys), col.decimals)}</div></div>)}
            </div>
          </div>
        ))}
      </div>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[1150px] text-[12px]">
          <thead>
            <tr className="text-left text-neutral-400">
              <th className="sticky left-0 z-10 bg-[#141414] p-2">Player</th>
              {statColumns.map((col) => (
                <th key={col.label} className="cursor-pointer whitespace-nowrap p-2 hover:text-[#f04a22]" onClick={() => onSort(col.label)}>
                  {col.label}{sortKey === col.label ? (sortDirection === "asc" ? " ▲" : " ▼") : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${getPlayer(row)}-${index}`} className="border-t border-neutral-800">
                <td className="sticky left-0 z-10 bg-[#141414] p-2 font-bold text-[#f04a22]">{getPlayer(row)}</td>
                {statColumns.map((col) => <td key={col.label} className="whitespace-nowrap p-2">{formatValue(getStatValue(row, col.keys), col.decimals)}</td>)}
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
      {statColumns.slice(1).map((col) => (
        <MiniStat key={col.label} label={col.label} value={formatValue(getStatValue(row, col.keys), col.decimals)} />
      ))}
    </div>
  );
}

function SeasonFinishesTable({ rows }: { rows: any[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead><tr className="text-left text-neutral-400"><th className="p-2">Season</th><th className="p-2">Finish</th><th className="p-2">PPR</th><th className="p-2">DPR</th><th className="p-2">OPPR</th><th className="p-2">Points</th><th className="p-2">Rounds</th><th className="p-2">4 Baggers</th></tr></thead>
        <tbody>
          {rows.map((row) => (
            <tr key={getSeason(row)} className="border-t border-neutral-800"><td className="p-2 font-bold">{getSeason(row)}</td><td className="p-2 text-[#f04a22]">{formatValue(getStatValue(row, ["Finish"]), 0)}</td><td className="p-2">{formatValue(getStatValue(row, ["Average PPR", "PPR"]), 2)}</td><td className="p-2">{formatValue(getStatValue(row, ["Average DPR", "DPR"]), 2)}</td><td className="p-2">{formatValue(getStatValue(row, ["Opponents Avg PPR", "OPPR"]), 2)}</td><td className="p-2">{formatValue(getStatValue(row, ["Total Pts", "Total Points"]), 0)}</td><td className="p-2">{formatValue(getStatValue(row, ["Total Rounds"]), 0)}</td><td className="p-2">{formatValue(getStatValue(row, ["Total 4-Baggers", "4 Baggers"]), 0)}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}


function ScenarioTable({
  rows,
  inputs,
  setInputs,
  selectedPlayer,
}: {
  rows: any[];
  inputs: Record<string, string>;
  setInputs: any;
  selectedPlayer: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[950px] text-sm">
        <thead>
          <tr className="text-left text-neutral-400">
            <th className="p-2">Projected Rank</th>
            <th className="p-2">Player</th>
            <th className="p-2">Current Rank</th>
            <th className="p-2">Current Points</th>
            <th className="p-2">Lowest Counted</th>
            <th className="p-2">Projected Score</th>
            <th className="p-2">Net Gain</th>
            <th className="p-2">Projected Points</th>
            <th className="p-2">Highest Week</th>
            <th className="p-2">PPR</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.name} className={`border-t border-neutral-800 ${row.name === selectedPlayer ? "bg-[#f04a22]/10" : ""}`}>
              <td className="p-2 font-bold">{row.projectedRank}</td>
              <td className="p-2 font-bold text-[#f04a22]">{row.name}</td>
              <td className="p-2">{row.currentRank || "-"}</td>
              <td className="p-2">{formatValue(row.currentTotal, 0)}</td>
              <td className="p-2">{formatValue(row.lowestCounted, 0)}</td>
              <td className="p-2">
                <input
                  className="w-24 rounded bg-[#242424] p-2 text-white"
                  type="number"
                  min="0"
                  value={inputs[row.name] ?? ""}
                  placeholder="score"
                  onChange={(e) => {
                    const value = e.target.value;
                    setInputs((current) => ({ ...current, [row.name]: value }));
                  }}
                />
              </td>
              <td className="p-2">{formatValue(row.netGain, 0)}</td>
              <td className="p-2 font-bold text-[#f04a22]">{formatValue(row.projectedTotal, 0)}</td>
              <td className="p-2">{formatValue(row.highestWeek, 0)}</td>
              <td className="p-2">{formatValue(row.ppr, 2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CompareTable({ statA, statB }: { statA: any; statB: any }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <tbody>
          {statColumns.map((col) => (
            <tr key={col.label} className="border-t border-neutral-800"><td className="p-2 text-neutral-400">{col.label}</td><td className="p-2">{formatValue(getStatValue(statA, col.keys), col.decimals)}</td><td className="p-2">{formatValue(getStatValue(statB, col.keys), col.decimals)}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
