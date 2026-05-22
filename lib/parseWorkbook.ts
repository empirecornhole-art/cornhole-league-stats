import * as XLSX from "xlsx";
import { LeagueData } from "./types";

function clean(value: any): string {
  return String(value ?? "").trim();
}

function compact(value: any): string {
  return clean(value).toLowerCase().replace(/[^a-z0-9]/g, "");
}

const seasonOrder: Record<string, number> = {
  spring: 1,
  summer: 2,
  fall: 3,
  winter: 4,
};

function parseSeason(value: string) {
  const s = clean(value).toLowerCase();
  const yearMatch = s.match(/(\d{2,4})/);
  const year = yearMatch ? Number(yearMatch[1].slice(-2)) : 999;
  const word = Object.keys(seasonOrder).find((k) => s.includes(k)) || "summer";
  return { year, order: seasonOrder[word] || 99 };
}

export function seasonSort(a: string, b: string) {
  const pa = parseSeason(a);
  const pb = parseSeason(b);
  if (pa.year !== pb.year) return pa.year - pb.year;
  return pa.order - pb.order;
}

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values.map(clean).filter(Boolean))).sort((a, b) => seasonSort(a, b));
}

function arrays(workbook: XLSX.WorkBook, sheetName: string): any[][] {
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

function isValidPlayerName(value: any) {
  const name = clean(value);
  const id = compact(name);
  if (!name) return false;
  if (/^\d+$/.test(name)) return false;
  return ![
    "standings",
    "overall",
    "grandtotal",
    "totalplayers",
    "ghostplayer",
    "player",
    "players",
    "playername",
    "name",
    "rowlabels",
  ].includes(id);
}

function numLike(value: any) {
  if (value === "" || value === null || value === undefined) return "";
  const n = Number(String(value).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : value;
}

function rowObject(headers: string[], values: any[]) {
  const obj: Record<string, any> = {};
  headers.forEach((header, index) => {
    if (header) obj[header] = values[index];
  });
  return obj;
}

function parseOverallStandings(workbook: XLSX.WorkBook, season: string) {
  const rows = arrays(workbook, "Overall");
  const headers = (rows[0] || []).slice(0, 16).map(clean);
  const standings: Record<string, any>[] = [];

  for (const row of rows.slice(1)) {
    const player = clean(row[0]);
    if (!isValidPlayerName(player)) continue;

    const obj: Record<string, any> = {
      Season: season,
      Player: player,
      Rank: standings.length + 1,
      Overall: row[2],
      Points: row[2],
    };

    headers.forEach((header, index) => {
      if (header) obj[header] = row[index];
    });

    standings.push(obj);
  }

  return standings;
}

function parseOverallStatsAndAverages(workbook: XLSX.WorkBook, season: string) {
  const rows = arrays(workbook, "Overall");
  let titleRow = -1;
  let startCol = -1;

  for (let r = 0; r < Math.min(rows.length, 10); r++) {
    for (let c = 0; c < (rows[r]?.length || 0); c++) {
      if (compact(rows[r][c]) === "overallstatsandaverages") {
        titleRow = r;
        startCol = c;
        break;
      }
    }
    if (titleRow >= 0) break;
  }

  if (titleRow < 0 || startCol < 0) {
    titleRow = 0;
    startCol = 25;
  }

  const headerRow = titleRow + 1;
  const headers = (rows[headerRow] || []).slice(startCol, startCol + 18).map(clean);
  const stats: Record<string, any>[] = [];

  for (const row of rows.slice(headerRow + 1)) {
    const values = row.slice(startCol, startCol + 18);
    const player = clean(values[0]);
    if (!isValidPlayerName(player)) continue;

    stats.push({
      Season: season,
      Player: player,
      playerName: player,
      ...rowObject(headers, values),
    });
  }

  return stats;
}

function parseBlind(workbook: XLSX.WorkBook, season: string) {
  const rows = arrays(workbook, "Blind");
  const weekly: Record<string, any>[] = [];

  for (const row of rows.slice(1)) {
    const player = clean(row[1]);
    const week = weekLabel(row[4]);
    if (!isValidPlayerName(player) || !week) continue;

    weekly.push({
      Season: season,
      Player: player,
      playerName: player,
      Week: week,
      Type: "Blind",
      Rank: row[0],
      Team: row[2],
      Points: row[3],
      FinishPts: row[3],
      "+/-": "",
      Wins: "",
      Losses: "",
    });
  }

  return weekly;
}

function parseSwap(workbook: XLSX.WorkBook, season: string) {
  const rows = arrays(workbook, "Swap");
  const weekly: Record<string, any>[] = [];

  for (const row of rows.slice(1)) {
    const player = clean(row[1]);
    const week = weekLabel(row[8]);
    if (!isValidPlayerName(player) || !week) continue;

    weekly.push({
      Season: season,
      Player: player,
      playerName: player,
      Week: week,
      Type: "Swap",
      Rank: row[0],
      Team: "",
      Points: row[2],
      FinishPts: row[2],
      "+/-": row[4],
      Wins: row[6],
      Losses: row[7],
    });
  }

  return weekly;
}

function parseWeeklyStandings(workbook: XLSX.WorkBook, season: string) {
  return [...parseBlind(workbook, season), ...parseSwap(workbook, season)];
}

function parseStatsSheet(workbook: XLSX.WorkBook, season: string) {
  const rows = arrays(workbook, "Stats");
  const stats: Record<string, any>[] = [];

  for (const row of rows.slice(1)) {
    const first = clean(row[2]);
    const last = clean(row[3]);
    const player = clean(row[23]) || [first, last].filter(Boolean).join(" ").trim();
    const week = weekLabel(row[19]);
    const type = typeLabel(row[20]);

    if (!isValidPlayerName(player) || !week || !type) continue;

    stats.push({
      Season: season,
      Player: player,
      playerName: player,
      Week: week,
      Type: type,
      Rank: row[0],
      PPR: numLike(row[7]),
      Rounds: numLike(row[5]),
      Points: numLike(row[6]),
      OPPR: numLike(row[9]),
      "Opp Pts": numLike(row[8]),
      DPR: numLike(row[10]),
      "4 Baggers": numLike(row[11]),
      ptsPerRnd: numLike(row[7]),
      rounds: numLike(row[5]),
      totalPts: numLike(row[6]),
      opponentPtsPerRnd: numLike(row[9]),
      opponentPts: numLike(row[8]),
      diffPerRnd: numLike(row[10]),
      TotalFourBaggers: numLike(row[11]),
      rawRanking: row[0],
      skillLevel: row[4],
    });
  }

  return stats;
}

function parseOldStatsFallback(workbook: XLSX.WorkBook, season: string) {
  const rows = arrays(workbook, "Old Stats");
  const stats: Record<string, any>[] = [];

  for (const row of rows.slice(1)) {
    const player = clean(row[0]);
    const week = weekLabel(row[7]);
    const type = typeLabel(row[8]);
    if (!isValidPlayerName(player) || !week || !type) continue;

    stats.push({
      Season: season,
      Player: player,
      playerName: player,
      Week: week,
      Type: type,
      PPR: numLike(row[1]),
      Rounds: numLike(row[2]),
      Points: numLike(row[3]),
      OPPR: numLike(row[4]),
      "Opp Pts": numLike(row[5]),
      DPR: numLike(row[6]),
      "4 Baggers": numLike(row[9]),
    });
  }

  return stats;
}

function dedupeEventStats(rows: Record<string, any>[]) {
  const score = (row: Record<string, any>) =>
    ["PPR", "Rounds", "Points", "OPPR", "Opp Pts", "DPR", "4 Baggers"].reduce(
      (count, key) => count + (row[key] !== "" && row[key] !== null && row[key] !== undefined ? 1 : 0),
      0
    );

  const best = new Map<string, Record<string, any>>();
  for (const row of rows) {
    const key = `${compact(row.Season)}|${compact(row.Week)}|${compact(row.Type)}|${compact(row.Player)}`;
    const existing = best.get(key);
    if (!existing || score(row) >= score(existing)) best.set(key, row);
  }

  return Array.from(best.values());
}

export async function parseWorkbook(buffer: ArrayBuffer, fileName?: string): Promise<LeagueData> {
  const workbook = XLSX.read(buffer, { type: "array" });
  const season = seasonFromFileName(fileName);

  const standings = parseOverallStandings(workbook, season);
  const stats = parseOverallStatsAndAverages(workbook, season);
  const weekly = parseWeeklyStandings(workbook, season);
  const eventStatsMain = parseStatsSheet(workbook, season);
  const eventStats = dedupeEventStats(eventStatsMain.length ? eventStatsMain : parseOldStatsFallback(workbook, season));

  const players = uniqueSorted(
    [
      ...standings.map((row) => clean(row.Player)),
      ...stats.map((row) => clean(row.Player)),
      ...weekly.map((row) => clean(row.Player)),
      ...eventStats.map((row) => clean(row.Player)),
    ].filter(isValidPlayerName)
  );

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
