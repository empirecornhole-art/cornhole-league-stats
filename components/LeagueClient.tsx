"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type Data = {
  lastUpdated?: string;
  seasons: string[];
  players: string[];
  standings: any[];
  weekly: any[];
  stats: any[];
};

function clean(value: any) {
  return String(value ?? "").trim();
}

function getSeason(row: any, fallback = "") {
  return clean(row.Season || row.season || fallback);
}

function getPlayer(row: any) {
  return clean(
    row.Player ||
      row.playerName ||
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

export default function LeagueClient() {
  const [data, setData] = useState<Data | null>(null);
  const [season, setSeason] = useState("");
  const [player, setPlayer] = useState("All Players");
  const [type, setType] = useState<"Blind" | "Swap">("Blind");
  const [week, setWeek] = useState("");
  const [compareA, setCompareA] = useState("");
  const [compareB, setCompareB] = useState("");

  useEffect(() => {
    fetch("/api/data")
      .then((res) => res.json())
      .then((loaded) => {
        setData(loaded);
        setSeason(loaded.seasons?.[0] || "");
      });
  }, []);

  const seasons = data?.seasons || [];
  const players = data?.players || [];

  const standings = useMemo(() => {
    const rows = data?.standings || [];

    return rows
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

  const weekRows = useMemo(() => {
    return (data?.weekly || []).filter((row) => {
      const rowSeason = getSeason(row, season);
      const rowType = getType(row);
      return (
        (!season || rowSeason === season) &&
        (!type || rowType === type)
      );
    });
  }, [data, season, type]);

  const weeks = useMemo(() => {
    return Array.from(new Set(weekRows.map(getWeek).filter(Boolean))).sort(
      (a, b) => {
        const an = Number(a.replace(/[^0-9]/g, ""));
        const bn = Number(b.replace(/[^0-9]/g, ""));
        return an - bn;
      }
    );
  }, [weekRows]);

  useEffect(() => {
    if (!week || !weeks.includes(week)) {
      setWeek(weeks[0] || "");
    }
  }, [weeks, week]);

  const visibleWeekRows = weekRows.filter((row) => {
    return (
      (!week || getWeek(row) === week) &&
      (player === "All Players" || getPlayer(row) === player)
    );
  });

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

  const compareKeys = Array.from(
    new Set([
      ...(statA ? Object.keys(statA) : []),
      ...(statB ? Object.keys(statB) : []),
    ])
  ).filter((key) => !["Season", "Player", "playerName"].includes(key));

  if (!data) {
    return <main className="mx-auto max-w-7xl p-4">Loading...</main>;
  }

  return (
    <main className="mx-auto max-w-7xl space-y-8 p-4">
      <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
        <h1 className="text-3xl font-bold">League Stats</h1>
        <p className="mt-1 text-neutral-400">
          Dashboard, weekly results, player stats, and comparisons.
        </p>

        <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-end">
          <div>
            <label className="text-xs text-neutral-400">Season</label>
            <select
              className="block rounded bg-neutral-800 p-2"
              value={season}
              onChange={(e) => setSeason(e.target.value)}
            >
              {seasons.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-neutral-400">Player</label>
            <select
              className="block rounded bg-neutral-800 p-2"
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
              : "No workbook uploaded yet"}
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
          <div className="text-neutral-400">Players</div>
          <div className="text-3xl font-bold">{players.length}</div>
        </div>

        <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
          <div className="text-neutral-400">Seasons</div>
          <div className="text-3xl font-bold">{seasons.length}</div>
        </div>

        <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
          <div className="text-neutral-400">Weekly Rows</div>
          <div className="text-3xl font-bold">{data.weekly.length}</div>
        </div>

        <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
          <div className="text-neutral-400">Top Score</div>
          <div className="text-3xl font-bold">
            {standings[0]?.points || 0}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
        <h2 className="mb-4 text-xl font-bold">Standings</h2>

        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={standings.slice(0, 12)}>
              <XAxis dataKey="name" hide />
              <YAxis />
              <Tooltip />
              <Bar dataKey="points" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-neutral-400">
                <th className="p-2">#</th>
                <th className="p-2">Player</th>
                <th className="p-2">Points</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((row, index) => (
                <tr key={`${row.name}-${index}`} className="border-t border-neutral-800">
                  <td className="p-2">{index + 1}</td>
                  <td className="p-2">{row.name}</td>
                  <td className="p-2">{row.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section id="weeks" className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
        <h2 className="mb-4 text-xl font-bold">Weeks</h2>

        <div className="mb-4 flex flex-wrap gap-3">
          <select
            className="rounded bg-neutral-800 p-2"
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
            className="rounded bg-neutral-800 p-2"
            value={week}
            onChange={(e) => setWeek(e.target.value)}
          >
            {weeks.map((w) => (
              <option key={w}>{w}</option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <tbody>
              {visibleWeekRows.map((row, index) => (
                <tr key={index} className="border-t border-neutral-800">
                  <td className="p-2 font-semibold">{getPlayer(row)}</td>
                  {Object.entries(row)
                    .slice(0, 8)
                    .map(([key, value]) => (
                      <td key={key} className="p-2">
                        <span className="text-neutral-500">{key}: </span>
                        {String(value)}
                      </td>
                    ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section id="compare" className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
        <h2 className="mb-4 text-xl font-bold">Compare Players</h2>

        <div className="mb-4 flex flex-wrap gap-3">
          <select
            className="rounded bg-neutral-800 p-2"
            value={compareA}
            onChange={(e) => setCompareA(e.target.value)}
          >
            <option value="">Player A</option>
            {players.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>

          <select
            className="rounded bg-neutral-800 p-2"
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
              {compareKeys.map((key) => (
                <tr key={key} className="border-t border-neutral-800">
                  <td className="p-2 text-neutral-400">{key}</td>
                  <td className="p-2">{String(statA?.[key] ?? "-")}</td>
                  <td className="p-2">{String(statB?.[key] ?? "-")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
