import { put, list } from "@vercel/blob";
import { LeagueData } from "./types";

const DATA_KEY = "league-data.json";

export async function saveLeagueData(data: LeagueData) {
  await put(DATA_KEY, JSON.stringify(data), {
    access: "private",
    contentType: "application/json",
    allowOverwrite: true,
  });
}

export async function loadLeagueData(): Promise<LeagueData | null> {
  const blobs = await list({ prefix: DATA_KEY, limit: 1 });
  const blob = blobs.blobs.find((b) => b.pathname === DATA_KEY);

  if (!blob) return null;

  const url = (blob as any).downloadUrl || blob.url;

  const res = await fetch(url, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Could not load league data. Status: ${res.status}`);
  }

  return await res.json();
}
