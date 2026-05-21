import { put, head } from "@vercel/blob";
import { LeagueData } from "./types";

const DATA_KEY = "league-data.json";

const emptyLeagueData: LeagueData = {
  seasons: [],
  players: [],
  standings: [],
  weekly: [],
  stats: [],
};

function clean(value: any) {
  return String(value ?? "").trim();
}

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values.map(clean).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b)
  );
}

export async function saveLeagueData(data: LeagueData) {
  await put(DATA_KEY, JSON.stringify(data), {
    access: "private",
    contentType: "application/json",
    allowOverwrite: true,
  });
}

export async function loadLeagueData(): Promise<LeagueData> {
  try {
    const blob = await head(DATA_KEY);

    if (!blob) return emptyLeagueData;

    const res = await fetch(blob.url, {
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}`,
      },
    });

    if (!res.ok) return emptyLeagueData;

    const loaded = await res.json();

    return {
      ...emptyLeagueData,
      ...loaded,
      seasons: loaded.seasons || [],
      players: loaded.players || [],
      standings: loaded.standings || [],
      weekly: loaded.weekly || [],
      stats: loaded.stats || [],
    };
  } catch {
    return emptyLeagueData;
  }
}

export function mergeSeasonData(existing: LeagueData, incoming: LeagueData): LeagueData {
  const incomingSeasons = new Set(incoming.seasons.map(clean));

  const keepDifferentSeason = (row: Record<string, any>) => {
    const rowSeason = clean(row.Season || row.season || row.SEASON);
    return !incomingSeasons.has(rowSeason);
  };

  const standings = [
    ...(existing.standings || []).filter(keepDifferentSeason),
    ...(incoming.standings || []),
  ];

  const weekly = [
    ...(existing.weekly || []).filter(keepDifferentSeason),
    ...(incoming.weekly || []),
  ];

  const stats = [
    ...(existing.stats || []).filter(keepDifferentSeason),
    ...(incoming.stats || []),
  ];

  return {
    lastUpdated: new Date().toISOString(),
    seasons: uniqueSorted([
      ...(existing.seasons || []),
      ...(incoming.seasons || []),
      ...standings.map((row) => row.Season),
      ...weekly.map((row) => row.Season),
      ...stats.map((row) => row.Season),
    ]),
    players: uniqueSorted([
      ...(existing.players || []),
      ...(incoming.players || []),
      ...standings.map((row) => row.Player || row.playerName),
      ...weekly.map((row) => row.Player || row.playerName),
      ...stats.map((row) => row.Player || row.playerName),
    ]),
    standings,
    weekly,
    stats,
  };
}
