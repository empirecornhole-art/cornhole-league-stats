import * as XLSX from "xlsx";
import { LeagueData } from "./types";

function clean(value: any): string {
  return String(value ?? "").trim();
}

function normalizeKey(value: any): string {
  return clean(value).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort(compareSeasonAware);
}

function sheetToObjects(workbook: XLSX.WorkBook, sheetName: string) {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json(sheet, { defval: "" }) as Record<string, any>[];
}

function sheetToArrays(workbook: XLSX.WorkBook, sheetName: string): any[][] {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as any[][];
}

function seasonFromFilename(fileName?: string) {
  const base = clean(fileName || "Spring26").replace(/\.[^/.]+$/, "");
  const compact = base.replace(/[_-]+/g, " ").trim();
  const match = compact.match(/(Fall|Winter|Spring|Summer)\s*(\d{2,4})/i);
  if (!match) return compact || "Spring 26";
  const name = match[1][0].toUpperCase() + match[1].slice(1).toLowerCase();
  const year = match[2].slice(-2);
  return `${name} ${year}`;
}

function seasonParts(season: string) {
  const match = clean(season).match(/(Fall|Winter|Spring|Summer)\s*(\d{2,4})/i);
  const order: Record<string, number> = { spring: 1, summer: 2, fall: 3, winter: 4 };
  if (!match) return { year: 9999, order: 99 };
  return { year: Number(match[2].slice(-2)), order: order[match[1].toLowerCase()] ?? 99 };
}

function compareSeasonAware(a: string, b: string) {
  const ap = seasonParts(a);
  const bp = seasonParts(b);
  if (ap.year !== bp.year) return ap.year - bp.year;
  if (ap.order !== bp.order) return ap.order - bp.order;
  return a.localeCompare(b);
}

function getAny(row: Record<string, any>, names: string[]) {
  const lookup = new Map<string, string>();
  Object.keys(row).forEach((key) => lookup.set(normalizeKey(key), key));
  for (const name of names) {
    const key = lookup.get(normalizeKey(name));
    if (key && row[key] !== undefined && row[key] !== "") return row[key];
  }
  return "";
}

function getPlayerName(row: Record<string, any>) {
  const direct = getAny(row, [
    "Player",
    "playerName",
    "PLAYER NAME",
    "Player Name",
    "Name",
    "Row Labels",
  ]);
  if (direct) return clean(direct);

  const first = clean(getAny(row, ["First", "First Name", "playerFirstName"]));
  const last = clean(getAny(row, ["Last", "Last Name", "playerLastName"]));
  return `${first} ${last}`.trim();
}

function getWeek(row: Record<string, any>) {
  const raw = clean(getAny(row, ["Week", "WEEK", "week"]));
  if (!raw) return "";
  if (/^\d+$/.test(raw)) return `Week ${raw}`;
  return raw.replace(/week\s*/i, "Week ").replace(/\s+/g, " ").trim();
}

function getType(row: Record<string, any>, fallback = "") {
  const raw = clean(getAny(row, ["Type", "TYPE", "Event", "League Type", "Format"]));
  const combined = `${raw} ${fallback}`.toLowerCase();
  if (combined.includes("blind")) return "Blind";
  if (combined.includes("swap")) return "Swap";
  return raw || fallback;
}

function parseOverallStandings(workbook: XLSX.WorkBook, season: string) {
  const rows = sheetToArrays(workbook, "Overall");
  const headers = rows[0]?.slice(0, 16).map(clean) || [];

  return rows
    .slice(1)
    .map((row) => {
      const player = clean(row[0]);
      if (!player || player === "Grand Total") return null;

      const obj: Record<string, any> = {
        Season: season,
        Player: player,
        Overall: row[2],
      };

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
  const make = (sheet: string, type: "Blind" | "Swap") =>
    sheetToObjects(workbook, sheet)
      .map((row) => ({
        ...row,
        Season: season,
        Player: getPlayerName(row),
        Week: getWeek(row),
        Type: type,
        rowKind: "standing",
      }))
      .filter((row) => row.Player && row.Week);

  return [...make("Blind", "Blind"), ...make("Swap", "Swap")];
}

function parseEventStats(workbook: XLSX.WorkBook, season: string) {
  const stats = sheetToObjects(workbook, "Stats")
    .map((row) => {
      const player = getPlayerName(row);
      const week = getWeek(row);
      const type = getType(row);
      return {
        ...row,
        Season: season,
        Player: player,
        playerName: player,
        Week: week,
        Type: type,
        rowKind: "stat",
      };
    })
    .filter((row) => row.Player && row.Week);

  const oldStats = sheetToObjects(workbook, "Old Stats")
    .map((row) => {
      const player = getPlayerName(row);
      const week = getWeek(row);
      const type = getType(row);
      return {
        ...row,
        Season: season,
        Player: player,
        playerName: player,
        Week: week,
        Type: type,
        rowKind: "stat",
      };
    })
    .filter((row) => row.Player && row.Week);

  return [...stats, ...oldStats];
}

export async function parseWorkbook(buffer: ArrayBuffer, fileName?: string): Promise<LeagueData> {
  const workbook = XLSX.read(buffer, { type: "array" });
  const season = seasonFromFilename(fileName);

  const standings = parseOverallStandings(workbook, season);
  const stats = parseOverallStatsAndAverages(workbook, season);
  const weeklyStandings = parseWeeklyStandings(workbook, season);
  const eventStats = parseEventStats(workbook, season);
  const weekly = [...weeklyStandings, ...eventStats];

  const players = uniqueSorted([
    ...standings.map((row) => clean(row.Player)),
    ...stats.map((row) => clean(row.Player)),
    ...weekly.map((row) => clean(row.Player)),
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
