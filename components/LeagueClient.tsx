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

type Tab = "dashboard" | "standings" | "weeks" | "players" | "compare";

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
  const [tab, setTab] = useState<Tab>("dashboard");
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
      (a, b) => {
        const an = Number(a.replace(/[^0-9]/g, ""));
        const bn = Number(b.replace(/[^0-9]/g, ""));
        return an - bn;
      }
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
                onChange={(e) => setSeason(e.target.value)}
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
            <div className="grid gap-4 md:grid-cols-4">
              <StatCard title="Players" value={players.length} />
              <StatCard title="Seasons" value={seasons.length} />
              <StatCard title="Weekly Rows" value={data.weekly.length} />
              <StatCard title="Top Score" value={standings[0]?.points || 0} />
            </div>

            <Card title="Top Standings">
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={standings.slice(0, 12)}>
                    <XAxis dataKey="name" hide />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="points" fill="#f04a22" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
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

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <tbody>
                  {visibleWeekRows.map((row, index) => (
                    <tr key={index} className="border-t border-neutral-800">
                      <td className="p-2 font-bold text-[#f04a22]">
                        {getPlayer(row)}
                      </td>
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
          </Card>
        )}

        {tab === "players" && (
          <Card title="Players">
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {players.map((p) => (
                <button
                  key={p}
                  onClick={() => {
                    setPlayer(p);
                    setTab("dashboard");
                  }}
                  className="rounded-xl border border-neutral-800 bg-[#202020] p-4 text-left font-bold hover:border-[#f04a22]"
                >
                  {p}
                </button>
              ))}
            </div>
          </Card>
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

function StatCard({ title, value }: { title: string; value: any }) {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-[#141414] p-4">
      <div className="text-sm text-neutral-400">{title}</div>
      <div className="text-4xl font-black text-[#f04a22]">{value}</div>
    </div>
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
              <td className="p-2 text-[#f04a22]">{row.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
