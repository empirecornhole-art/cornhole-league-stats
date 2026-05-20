import { put, head } from "@vercel/blob";
import { LeagueData } from "./types";

const DATA_KEY = "league-data.json";

export async function saveLeagueData(data: LeagueData) {
  await put(DATA_KEY, JSON.stringify(data), {
    access: "public",
    contentType: "application/json",
    allowOverwrite: true,
  });
}

export async function loadLeagueData(): Promise<LeagueData | null> {
  const blob = await head(DATA_KEY);
  if (!blob) return null;

  const res = await fetch(blob.url, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Could not load league data. Status: ${res.status}`);
  }

  return await res.json();
}
