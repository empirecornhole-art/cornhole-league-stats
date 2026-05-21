import * as XLSX from "xlsx";
import { LeagueData } from "./types";

function clean(value: any): string {
  return String(value ?? "").trim();
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

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort(compareSeasonsOrNames);
}

function compareSeasonsOrNames(a: string, b: string) {
  const sa = seasonSortValue(a);
  const sb = seasonSortValue(b);
  if (sa !== null && sb !== null) return sa - sb;
  return a.localeCompare(b);
}

function seasonSortValue(value: string): number | null {
  const text = clean(value).replace(/[_-]/g, " ");
  const match = text.match(/(Fall|Winter|Spring|Summer)\s*(\d{2,4})/i);
  if (!match) return null;
  const season = match[1].toLowerCase();
  const yearRaw = Number(match[2]);
  const year = yearRaw < 100 ? 2000 + yearRaw : yearRaw;
  const seasonOrder: Record<string, number> = { spring: 1, summer: 2, fall: 3, winter: 4 };
  return year * 10 + (seasonOrder[season] || 9);
}

function seasonFromFilename(filename = "Spring26.xlsx") {
  const base = filename.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ");
  const match = base.match(/(Fall|Winter|Spring|Summer)\s*(\d{2,4})/i);
  if (!match) return base || "Unknown Season";
  const season = match[1][0].toUpperCase() + match[1].slice(1).toLowerCase();
  const year = match[2].slice(-2);
  return `${season} ${year}`;
}

function playerFromRow(row: Record<string, any>) {
  const first = clean(row.playerFirstName || row.PlayerFirstName || row.First || row["First Name"]);
  const last = clean(row.playerLastName || row.PlayerLastName || row.Last || row["Last Name"]);
  if (first || last) return `${first} ${last}`.trim();
  return clean(row.Player || row.playerName || row["Row Labels"] || row["PLAYER NAME"] || row["Player Name"] || row.Name || row.name);
}

function weekFromRow(row: Record<string, any>) {
  const value = clean(row.Week || row.week || row.WEEK);
  if (!value) return "";
  const n = value.match(/\d+/)?.[0];
  return n ? `Week ${n}` : value;
}

function typeFromRow(row: Record<string, any>, fallback = "") {
  const raw = clean(row.Type || row.type || row.TYPE || fallback);
  if (/blind/i.test(raw)) return "Blind";
  if (/swap/i.test(raw)) return "Swap";
  return raw || fallback;
}

function numberVal(value: any) {
  const n = Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function normalizeEventStatRow(row: Record<string, any>, season: string) {
  const player = playerFromRow(row);
  const week = weekFromRow(row);
  const type = typeFromRow(row);
  if (!player || !week || !type) return null;

  return {
    ...row,
    Season: season,
    Player: player,
    Week: week,
    Type: type,
    Rank: row.Rank || row.RANK || row.Ranking || row.rank || "",
    PPR: row.PPR || row.ppr || row["Average PPR"] || "",
    Rounds: row.Rounds || row.rounds || row["Total Rounds"] || "",
    Points: row.Points || row.points || row["Total Pts"] || "",
    OPPR: row.OPPR || row.oppr || row["Opp Avg PPR"] || row["Opponents Avg PPR"] || "",
    "Opp Pts": row["Opp Pts"] || row["Opp Points"] || row["Opponent Points"] || row["Opponents Pts"] || "",
    DPR: row.DPR || row.dpr || row["Average DPR"] || "",
    "4 Baggers": row["4 Baggers"] || row["4-Baggers"] || row["Total 4-Baggers"] || row["totalFourBaggers"] || "",
  };
}

function parseEventStats(workbook: XLSX.WorkBook, season: string) {
  const statsRows = sheetToObjects(workbook, "Stats")
    .map((row) => normalizeEventStatRow(row, season))
    .filter(Boolean) as Record<string, any>[];

  const oldStatsRows = sheetToObjects(workbook, "Old Stats")
    .map((row) => normalizeEventStatRow(row, season))
    .filter(Boolean) as Record<string, any>[];

  return [...statsRows, ...oldStatsRows];
}

function parseOverallStandings(workbook: XLSX.WorkBook, season: string) {
  const rows = sheetToArrays(workbook, "Overall");
  const headers = rows[0]?.slice(0, 24).map(clean) || [];

  return rows
    .slice(1)
    .map((row) => {
      const player = clean(row[0]);
      if (!player || /grand total/i.test(player)) return null;
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
      if (!player || /grand total/i.test(player)) return null;
      const obj: Record<string, any> = { Season: season, Player: player, playerName: player };
      headers.forEach((header, index) => {
        if (header) obj[header] = values[index];
      });
      return obj;
    })
    .filter(Boolean) as Record<string, any>[];
}

function parseWeeklyStandings(workbook: XLSX.WorkBook, season: string) {
  const fromSheet = (sheetName: string, fallbackType: string) =>
    sheetToObjects(workbook, sheetName)
      .map((row) => {
        const player = playerFromRow(row);
        const week = weekFromRow(row);
        if (!player || !week) return null;
        return {
          ...row,
          Season: season,
          Player: player,
          Week: week,
          Type: typeFromRow(row, fallbackType),
          Rank: row.Rank || row.RANK || row.rank || row["Place"] || row["Finish"] || "",
          Points: row.Points || row.points || row["Weekly Points"] || row["Total Points"] || "",
          Team: row.Team || row.TEAM || row.team || "",
          Wins: row.Wins || row.W || row["Wins"] || "",
          Losses: row.Losses || row.L || row["Losses"] || "",
          "+/-": row["+/-"] || row["+ / -"] || row["+"] || row["+ -"] || "",
        };
      })
      .filter(Boolean) as Record<string, any>[];

  return [...fromSheet("Blind", "Blind"), ...fromSheet("Swap", "Swap")];
}

export async function parseWorkbook(buffer: ArrayBuffer, filename?: string): Promise<LeagueData> {
  const workbook = XLSX.read(buffer, { type: "array" });
  const season = seasonFromFilename(filename);

  const standings = parseOverallStandings(workbook, season);
  const stats = parseOverallStatsAndAverages(workbook, season);
  const weekly = parseWeeklyStandings(workbook, season);
  const eventStats = parseEventStats(workbook, season);

  const players = uniqueSorted([
    ...standings.map((r) => clean(r.Player)),
    ...stats.map((r) => clean(r.Player)),
    ...weekly.map((r) => clean(r.Player)),
    ...eventStats.map((r) => clean(r.Player)),
  ]);

  return {
    seasons: [season],
    players,
    standings,
    weekly,
    stats,
    eventStats,
    lastUpdated: new Date().toISOString(),
  };
}
