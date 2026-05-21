import * as XLSX from "xlsx";
import { LeagueData } from "./types";

function clean(value: any): string {
  return String(value ?? "").trim();
}

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values.map(clean).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b)
  );
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

function seasonFromFileName(fileName?: string) {
  const base = clean(fileName || "Season").replace(/\.[^.]+$/, "");
  const spaced = base
    .replace(/[_-]+/g, " ")
    .replace(/(Spring|Summer|Fall|Winter)\s*(\d{2,4})/i, (_m, term, year) => `${term} ${String(year).slice(-2)}`)
    .replace(/\s+/g, " ")
    .trim();

  return spaced || "Season";
}

function getSeason(row: Record<string, any>, fallback: string) {
  const sheetSeason = clean(row.Season || row.season || row.SEASON);
  return sheetSeason || fallback;
}

function getPlayerName(row: Record<string, any>) {
  const first = clean(row.playerFirstName || row.First || row["First Name"]);
  const last = clean(row.playerLastName || row.Last || row["Last Name"]);
  if (first || last) return `${first} ${last}`.trim();

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

function getWeek(row: Record<string, any>) {
  return clean(row.Week || row.week || row.WEEK);
}

function getType(row: Record<string, any>) {
  return clean(row.Type || row.type || row.TYPE);
}

function parseOverallStandings(workbook: XLSX.WorkBook, season: string) {
  const rows = sheetToArrays(workbook, "Overall");
  if (!rows.length) return [];

  const headers = rows[0]?.slice(0, 24).map(clean) || [];

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
  if (rows.length < 3) return [];

  const startCol = 25;
  const endCol = 42;
  const headers = rows[1]?.slice(startCol, endCol).map(clean) || [];

  return rows
    .slice(2)
    .map((row) => {
      const values = row.slice(startCol, endCol);
      const player = clean(values[0]);

      if (!player || player === "Grand Total") return null;

      const obj: Record<string, any> = {
        Season: season,
        Player: player,
        playerName: player,
      };

      headers.forEach((header, index) => {
        if (header) obj[header] = values[index];
      });

      return obj;
    })
    .filter(Boolean) as Record<string, any>[];
}

function parseWeeklyStandings(workbook: XLSX.WorkBook, season: string) {
  const swap = sheetToObjects(workbook, "Swap").map((row) => ({
    ...row,
    Season: getSeason(row, season),
    Player: getPlayerName(row),
    Week: getWeek(row),
    Type: "Swap",
    rowKind: "standing",
  }));

  const blind = sheetToObjects(workbook, "Blind").map((row) => ({
    ...row,
    Season: getSeason(row, season),
    Player: getPlayerName(row),
    Week: getWeek(row),
    Type: "Blind",
    rowKind: "standing",
  }));

  return [...swap, ...blind].filter((row) => row.Player && row.Week);
}

function parseEventStats(workbook: XLSX.WorkBook, season: string) {
  return sheetToObjects(workbook, "Stats")
    .map((row) => ({
      ...row,
      Season: getSeason(row, season),
      Player: getPlayerName(row),
      Week: getWeek(row),
      Type: getType(row),
      rowKind: "eventStat",
    }))
    .filter((row) => row.Player && row.Week && row.Type);
}

export async function parseWorkbook(
  buffer: ArrayBuffer,
  fileName?: string
): Promise<LeagueData> {
  const workbook = XLSX.read(buffer, { type: "array" });
  const season = seasonFromFileName(fileName);

  const standings = parseOverallStandings(workbook, season);
  const stats = parseOverallStatsAndAverages(workbook, season);
  const weeklyStandings = parseWeeklyStandings(workbook, season);
  const eventStats = parseEventStats(workbook, season);
  const weekly = [...weeklyStandings, ...eventStats];

  const players = uniqueSorted([
    ...standings.map(getPlayerName),
    ...stats.map(getPlayerName),
    ...weekly.map(getPlayerName),
  ]);

  return {
    seasons: [season],
    players,
    standings,
    weekly,
    stats,
    lastUpdated: new Date().toISOString(),
  };
}
