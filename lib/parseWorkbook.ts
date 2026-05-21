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

function getPlayer(row: Record<string, any>) {
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

function seasonFromFileName(fileName?: string) {
  if (!fileName) return "";
  const base = fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
  const match = base.match(/(spring|summer|fall|winter)\s*'?\s*(\d{2,4})/i);
  if (!match) return "";
  const term = match[1][0].toUpperCase() + match[1].slice(1).toLowerCase();
  let year = match[2];
  if (year.length === 4) year = year.slice(2);
  return `${term} ${year}`;
}

function findSeasonInRows(rows: Record<string, any>[]) {
  for (const row of rows) {
    const value = clean(row.Season || row.season || row.SEASON);
    if (value) return value;
  }
  return "";
}

function detectSeason(workbook: XLSX.WorkBook, fileName?: string) {
  const fromFile = seasonFromFileName(fileName);
  if (fromFile) return fromFile;

  const sheets = ["Overall", "Stats", "Swap", "Blind", "LB", "Old Stats"];
  for (const sheet of sheets) {
    const found = findSeasonInRows(sheetToObjects(workbook, sheet));
    if (found) return found;
  }

  return "Unknown Season";
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

  // Current workbook has Overall Stats and Averages starting at column Z.
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
    Season: season,
    Player: clean(row["PLAYER NAME"] || row.Player || row.Name),
    Week: clean(row.Week || row.week || row.WEEK),
    Type: "Swap",
    recordKind: "standing",
  }));

  const blind = sheetToObjects(workbook, "Blind").map((row) => ({
    ...row,
    Season: season,
    Player: clean(row["PLAYER NAME"] || row.Player || row.Name),
    Week: clean(row.Week || row.week || row.WEEK),
    Type: "Blind",
    recordKind: "standing",
  }));

  return [...swap, ...blind].filter((row) => row.Player && row.Week);
}

function parseEventStats(workbook: XLSX.WorkBook, season: string) {
  const statsRows = sheetToObjects(workbook, "Stats");

  return statsRows
    .map((row) => {
      const player = getPlayer(row);
      const week = clean(row.Week || row.week || row.WEEK || row["Week"]);
      const type = clean(row.Type || row.type || row.TYPE || row.Event || row.event);

      return {
        ...row,
        Season: season,
        Player: player,
        playerName: player,
        Week: week,
        Type: type,
        recordKind: "eventStat",
      };
    })
    .filter((row) => row.Player && row.Week && row.Type);
}

export async function parseWorkbook(buffer: ArrayBuffer, fileName?: string): Promise<LeagueData> {
  const workbook = XLSX.read(buffer, { type: "array" });
  const season = detectSeason(workbook, fileName);

  const standings = parseOverallStandings(workbook, season);
  const stats = parseOverallStatsAndAverages(workbook, season);
  const weekly = [...parseWeeklyStandings(workbook, season), ...parseEventStats(workbook, season)];

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
    stats,
    lastUpdated: new Date().toISOString(),
  };
}
