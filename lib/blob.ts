import { put, head } from "@vercel/blob";
import { LeagueData } from "./types";

const DATA_KEY = "league-data.json";

export function emptyLeagueData(): LeagueData {
  return {
    seasons: [],
    players: [],
    standings: [],
    weekly: [],
    stats: [],
    lastUpdated: new Date().toISOString(),
  };
}

export async function saveLeagueData(data: LeagueData) {
  await put(DATA_KEY, JSON.stringify(data), {
    access: "private",
    contentType: "application/json",
    allowOverwrite: true,
  });
}

export async function loadLeagueData(): Promise<LeagueData | null> {
  try {
    const blob = await head(DATA_KEY);
    if (!blob) return null;

    const res = await fetch(blob.url, {
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}`,
      },
    });

    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export function mergeSeasonData(existing: LeagueData | null, incoming: LeagueData): LeagueData {
  const base = existing ?? emptyLeagueData();
  const incomingSeasons = new Set(incoming.seasons);

  const standings = [
    ...base.standings.filter((row) => !incomingSeasons.has(String(row.Season ?? row.season ?? "").trim())),
    ...incoming.standings,
  ];

  const weekly = [
    ...base.weekly.filter((row) => !incomingSeasons.has(String(row.Season ?? row.season ?? "").trim())),
    ...incoming.weekly,
  ];

  const stats = [
    ...base.stats.filter((row) => !incomingSeasons.has(String(row.Season ?? row.season ?? "").trim())),
    ...incoming.stats,
  ];

  const seasons = Array.from(new Set([...base.seasons, ...incoming.seasons]))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

  const players = Array.from(
    new Set([
      ...base.players,
      ...incoming.players,
      ...standings.map((row) => String(row.Player ?? row.playerName ?? "").trim()),
      ...weekly.map((row) => String(row.Player ?? row.playerName ?? "").trim()),
      ...stats.map((row) => String(row.Player ?? row.playerName ?? "").trim()),
    ].filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));

  return {
    seasons,
    players,
    standings,
    weekly,
    stats,
    lastUpdated: new Date().toISOString(),
  };
}
