import { put, head } from "@vercel/blob";
import { LeagueData } from "./types";

const DATA_KEY = "league-data.json";

const emptyLeagueData: LeagueData = {
  seasons: [],
  players: [],
  standings: [],
  weekly: [],
  eventStats: [],
  stats: [],
  lastUpdated: "",
};

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) =>
    a.localeCompare(b)
  );
}

function removeSeason(data: LeagueData, seasonName: string): LeagueData {
  return {
    ...data,
    seasons: (data.seasons || []).filter((s) => s !== seasonName),
    standings: (data.standings || []).filter((row) => row.Season !== seasonName),
    weekly: (data.weekly || []).filter((row) => row.Season !== seasonName),
    eventStats: (data.eventStats || []).filter((row) => row.Season !== seasonName),
    stats: (data.stats || []).filter((row) => row.Season !== seasonName),
  };
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

    if (!blob) {
      return emptyLeagueData;
    }

    const res = await fetch(blob.url, {
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}`,
      },
    });

    if (!res.ok) {
      return emptyLeagueData;
    }

    const data = await res.json();

    return {
      ...emptyLeagueData,
      ...data,
      seasons: data.seasons || [],
      players: data.players || [],
      standings: data.standings || [],
      weekly: data.weekly || [],
      eventStats: data.eventStats || [],
      stats: data.stats || [],
      lastUpdated: data.lastUpdated || "",
    };
  } catch {
    return emptyLeagueData;
  }
}

export function mergeSeasonData(
  existingData: LeagueData,
  newSeasonData: LeagueData
): LeagueData {
  const seasonName = newSeasonData.seasons?.[0] || "";

  const cleanedExisting = seasonName
    ? removeSeason(existingData || emptyLeagueData, seasonName)
    : existingData || emptyLeagueData;

  return {
    lastUpdated: new Date().toISOString(),

    seasons: uniqueSorted([
      ...(cleanedExisting.seasons || []),
      ...(newSeasonData.seasons || []),
    ]),

    players: uniqueSorted([
      ...(cleanedExisting.players || []),
      ...(newSeasonData.players || []),
    ]),

    standings: [
      ...(cleanedExisting.standings || []),
      ...(newSeasonData.standings || []),
    ],

    weekly: [
      ...(cleanedExisting.weekly || []),
      ...(newSeasonData.weekly || []),
    ],

    eventStats: [
      ...(cleanedExisting.eventStats || []),
      ...(newSeasonData.eventStats || []),
    ],

    stats: [
      ...(cleanedExisting.stats || []),
      ...(newSeasonData.stats || []),
    ],
  };
}
