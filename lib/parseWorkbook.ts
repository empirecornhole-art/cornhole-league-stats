import * as XLSX from "xlsx";
import { LeagueData } from "./types";

function clean(value: any): string {
  return String(value ?? "").trim();
}

function compact(value: any): string {
  return clean(value).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => seasonSort(a, b));
}

function sheetToObjects(workbook: XLSX.WorkBook, sheetName: string): Record<string, any>[] {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json(sheet, { defval: "" }) as Record<string, any>[];
}

function sheetToArrays(workbook: XLSX.WorkBook, sheetName: string): any[][] {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as any[][];
}

function seasonFromFileName(fileName?: string) {
  const base = clean(fileName || "Spring26").replace(/\.[^.]+$/, "");
  const match = base.match(/(fall|winter|spring|summer)[\s_-]*(\d{2,4})/i);
  if (!match) return base.replace(/[_-]+/g, " ").trim();
  const word = match[1][0].toUpperCase() + match[1].slice(1).toLowerCase();
  const year = match[2].slice(-2);
  return `${word} ${year}`;
}

const seasonOrder: Record<string, number> = { fall: 1, winter: 2, spring: 3, summer: 4 };
export function seasonSort(a: string, b: string) {
  const pa = parseSeason(a);
  const pb = parseSeason(b);
  if (pa.year !== pb.year) return pa.year - pb.year;
  return pa.order - pb.order;
}

function parseSeason(value: string) {
  const s = clean(value).toLowerCase();
  const yearMatch = s.match(/(\d{2,4})/);
  const year = yearMatch ? Number(yearMatch[1].slice(-2)) : 999;
  const word = Object.keys(seasonOrder).find((k) => s.includes(k)) || "summer";
  return { year, order: seasonOrder[word] || 99 };
}

function weekLabel(value: any) {
  const text = clean(value);
  if (!text) return "";
  const match = text.match(/\d+/);
  return match ? `Week ${Number(match[0])}` : text;
}

function typeLabel(value: any, fallback = "") {
  const text = clean(value || fallback).toLowerCase();
  if (text.includes("blind")) return "Blind";
  if (text.includes("swap")) return "Swap";
  return clean(value || fallback);
}

function getPlayerName(row: Record<string, any>) {
  const first = clean(row.playerFirstName || row["Player First Name"] || row["First Name"] || row.First || row.firstName);
  const last = clean(row.playerLastName || row["Player Last Name"] || row["Last Name"] || row.Last || row.lastName);
  if (first || last) return `${first} ${last}`.trim();

  const full = clean(
    row.Player ||
      row.playerName ||
      row["PLAYER NAME"] ||
      row["Player Name"] ||
      row.Name ||
      row.name ||
      row["Row Labels"]
  );
  return full;
}

function getValue(row: Record<string, any>, keys: string[]) {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== "") return row[key];
  }
  const wanted = keys.map(compact);
  const found = Object.keys(row).find((k) => wanted.includes(compact(k)));
  return found ? row[found] : "";
}

function normalizeStatRow(row: Record<string, any>, season: string): Record<string, any> | null {
  const player = getPlayerName(row);
  if (!player) return null;

  const week = weekLabel(getValue(row, ["Week", "WEEK", "week"]));
  const type = typeLabel(getValue(row, ["Type", "TYPE", "type", "Event", "event", "League Type", "Game Type"]));

  return {
    ...row,
    Season: season,
    Player: player,
    playerName: player,
    Week: week,
    Type: type,
    PPR: getValue(row, ["PPR", "Avg PPR", "Average PPR"]),
    Rounds: getValue(row, ["Rounds", "Total Rounds"]),
    Points: getValue(row, ["Points", "Total Pts", "Total Points"]),
    OPPR: getValue(row, ["OPPR", "Opp PPR", "Opponent PPR", "Opponents Avg PPR"]),
    "Opp Pts": getValue(row, ["Opp Pts", "Opponent Points", "Opponents Pts"]),
    DPR: getValue(row, ["DPR", "Average DPR"]),
    "4 Baggers": getValue(row, ["4 Baggers", "Total 4-Baggers", "Four Baggers"]),
  };
}

function parseOverallStandings(workbook: XLSX.WorkBook, season: string) {
  const rows = sheetToArrays(workbook, "Overall");
  const headers = rows[0]?.slice(0, 18).map(clean) || [];

  return rows
    .slice(1)
    .map((row) => {
      const player = clean(row[0]);
      if (!player || player === "Grand Total") return null;
      const obj: Record<string, any> = { Season: season, Player: player, Overall: row[2] };
      headers.forEach((header, index) => {
        if (header) obj[header] = row[index];
      });
      return obj;
    })
    .filter(Boolean) as Record<string, any>[];
}

function parseOverallStatsAndAverages(workbook: XLSX.WorkBook, season: string) {
  const rows = sheetToArrays(workbook, "Overall");
  const startCol = 25;
  const endCol = 42;
  const headers = rows[1]?.slice(startCol, endCol).map(clean) || [];

  return rows
    .slice(2)
    .map((row) => {
      const values = row.slice(startCol, endCol);
      const player = clean(values[0]);
      if (!player || player === "Grand Total") return null;
      const obj: Record<string, any> = { Season: season, Player: player, playerName: player };
      headers.forEach((header, index) => {
        if (header) obj[header] = values[index];
      });
      return obj;
    })
    .filter(Boolean) as Record<string, any>[];
}

function parseWeeklyStandings(workbook: XLSX.WorkBook, season: string) {
  const parseSheet = (sheet: string, type: "Blind" | "Swap") =>
    sheetToObjects(workbook, sheet)
      .map((row) => {
        const player = getPlayerName(row);
        if (!player) return null;
        return {
          ...row,
          Season: season,
          Player: player,
          playerName: player,
          Week: weekLabel(getValue(row, ["Week", "WEEK", "week"])),
          Type: type,
          Rank: getValue(row, ["RANK", "Rank", "rank"]),
          Team: getValue(row, ["TEAM", "Team", "team"]),
          Points: getValue(row, ["POINTS", "Points", "points"]),
          "+/-": getValue(row, ["+/-", "+ / -", "+/- ", "Plus Minus"]),
          Wins: getValue(row, ["Wins", "WINS"]),
          Losses: getValue(row, ["Losses", "LOSSES"]),
        };
      })
      .filter(Boolean) as Record<string, any>[];

  return [...parseSheet("Blind", "Blind"), ...parseSheet("Swap", "Swap")];
}

function parseEventStats(workbook: XLSX.WorkBook, season: string) {
  const sheets = ["Stats", "Old Stats"];
  const rows: Record<string, any>[] = [];
  for (const sheet of sheets) {
    for (const row of sheetToObjects(workbook, sheet)) {
      const normalized = normalizeStatRow(row, season);
      if (normalized) rows.push(normalized);
    }
  }
  return rows;
}

export async function parseWorkbook(buffer: ArrayBuffer, fileName?: string): Promise<LeagueData> {
  const workbook = XLSX.read(buffer, { type: "array" });
  const season = seasonFromFileName(fileName);

  const standings = parseOverallStandings(workbook, season);
  const stats = parseOverallStatsAndAverages(workbook, season);
  const weekly = parseWeeklyStandings(workbook, season);
  const eventStats = parseEventStats(workbook, season);

  const players = uniqueSorted([
    ...standings.map((row) => clean(row.Player)),
    ...stats.map((row) => clean(row.Player)),
    ...weekly.map((row) => clean(row.Player)),
    ...eventStats.map((row) => clean(row.Player)),
  ]);

  return {
    seasons: [season],
    players,
    standings,
    weekly,
    eventStats,
    stats,
    lastUpdated: new Date().toISOString(),
  };
}
