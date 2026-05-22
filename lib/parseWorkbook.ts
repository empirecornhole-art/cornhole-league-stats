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

function sheetToObjects(workbook: XLSX.WorkBook, sheetName: string): Record<string, any>[] {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json(sheet, { defval: "", raw: true }) as Record<string, any>[];
}

function sheetToArrays(workbook: XLSX.WorkBook, sheetName: string): any[][] {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: true }) as any[][];
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

function getValue(row: Record<string, any>, keys: string[]) {
  for (const key of keys) {
    if (row?.[key] !== undefined && row?.[key] !== "" && row?.[key] !== null) return row[key];
  }

  const wanted = keys.map(compact);
  const found = Object.keys(row || {}).find((key) => wanted.includes(compact(key)));
  return found ? row[found] : "";
}

function getPlayerName(row: Record<string, any>) {
  const first = clean(row.playerFirstName || row["Player First Name"] || row["First Name"] || row.First || row.firstName);
  const last = clean(row.playerLastName || row["Player Last Name"] || row["Last Name"] || row.Last || row.lastName);
  if (first || last) return `${first} ${last}`.trim();

  return clean(
    row.Player ||
      row.playerName ||
      row["PLAYER NAME"] ||
      row["Player Name"] ||
      row.Name ||
      row.name ||
      row["Row Labels"]
  );
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
  ].includes(id);
}

function parseOverallStandings(workbook: XLSX.WorkBook, season: string) {
  const rows = sheetToArrays(workbook, "Overall");
  const headers = rows[0]?.slice(0, 16).map(clean) || [];

  return rows
    .slice(1)
    .map((row, index) => {
      const player = clean(row[0]);
      if (!isValidPlayerName(player)) return null;

      const obj: Record<string, any> = {
        Season: season,
        Player: player,
        Rank: index + 1,
        Overall: row[2],
        Points: row[2],
      };

      headers.forEach((header, columnIndex) => {
        if (header) obj[header] = row[columnIndex];
      });

      return obj;
    })
    .filter(Boolean) as Record<string, any>[];
}

function parseOverallStatsAndAverages(workbook: XLSX.WorkBook, season: string) {
  const rows = sheetToArrays(workbook, "Overall");

  let headerRowIndex = -1;
  let startCol = -1;

  for (let r = 0; r < Math.min(rows.length, 10); r++) {
    for (let c = 0; c < (rows[r]?.length || 0); c++) {
      if (compact(rows[r][c]) === "overallstatsandaverages" || compact(rows[r][c]) === "statsandaverages") {
        headerRowIndex = r + 1;
        startCol = c;
        break;
      }
    }
    if (headerRowIndex >= 0) break;
  }

  if (headerRowIndex < 0 || startCol < 0) {
    headerRowIndex = 1;
    startCol = 25;
  }

  const headers = (rows[headerRowIndex] || []).slice(startCol, startCol + 18).map(clean);

  return rows
    .slice(headerRowIndex + 1)
    .map((row) => {
      const values = row.slice(startCol, startCol + 18);
      const player = clean(values[0]);
      if (!isValidPlayerName(player)) return null;

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
  const parseSheet = (sheetName: "Blind" | "Swap") =>
    sheetToObjects(workbook, sheetName)
      .map((row) => {
        const player = getPlayerName(row);
        const week = weekLabel(getValue(row, ["Week", "WEEK", "week", "Week "]));
        if (!isValidPlayerName(player) || !week) return null;

        const finishPoints = getValue(row, ["POINTS", "Points", "points"]);

        return {
          ...row,
          Season: season,
          Player: player,
          playerName: player,
          Week: week,
          Type: sheetName,
          Rank: getValue(row, ["RANK", "Rank", "rank"]),
          Team: getValue(row, ["TEAM", "Team", "team"]),
          Points: finishPoints,
          FinishPts: finishPoints,
          "+/-": getValue(row, ["+/-", "+ / -", "+/- ", "Plus Minus"]),
          Wins: getValue(row, ["Wins", "WINS"]),
          Losses: getValue(row, ["Losses", "LOSSES"]),
        };
      })
      .filter(Boolean) as Record<string, any>[];

  return [...parseSheet("Blind"), ...parseSheet("Swap")];
}

function statCompleteness(row: Record<string, any>) {
  return ["PPR", "Rounds", "StatPoints", "OPPR", "Opp Pts", "DPR", "4 Baggers"].reduce((count, key) => {
    const v = row[key];
    return count + (v !== "" && v !== null && v !== undefined ? 1 : 0);
  }, 0);
}

function parseEventStats(workbook: XLSX.WorkBook, season: string) {
  const rows: Record<string, any>[] = [];

  for (const row of sheetToObjects(workbook, "Stats")) {
    const player = getPlayerName(row);
    const week = weekLabel(getValue(row, ["Week", "Week ", "WEEK", "week"]));
    const type = typeLabel(getValue(row, ["Type", "TYPE", "type"]));

    if (!isValidPlayerName(player) || !week || !type) continue;

    rows.push({
      ...row,
      Season: season,
      Player: player,
      playerName: player,
      Week: week,
      Type: type,
      Rank: getValue(row, ["ranking", "Rank", "RANK"]),
      PPR: getValue(row, ["ptsPerRnd", "PPR", "Average PPR"]),
      Rounds: getValue(row, ["rounds", "Rounds", "Rds", "Total Rounds"]),
      Points: getValue(row, ["totalPts", "Pts", "Points", "Total Pts", "Total Points"]),
      StatPoints: getValue(row, ["totalPts", "Pts", "Points", "Total Pts", "Total Points"]),
      OPPR: getValue(row, ["opponentPtsPerRnd", "OPPR", "Opp PPR", "Opponent PPR", "Opponents Avg PPR"]),
      "Opp Pts": getValue(row, ["opponentPts", "Opp Pts", "Opponent Points", "Opponents Pts"]),
      DPR: getValue(row, ["diffPerRnd", "DPR", "Average DPR"]),
      "4 Baggers": getValue(row, ["TotalFourBaggers", "4 Baggers", "Total 4-Baggers", "Four Baggers"]),
    });
  }

  for (const row of sheetToObjects(workbook, "Old Stats")) {
    const player = getPlayerName(row);
    const week = weekLabel(getValue(row, ["Week", "WEEK", "week"]));
    const type = typeLabel(getValue(row, ["Type", "TYPE", "type"]));

    if (!isValidPlayerName(player) || !week || !type) continue;

    rows.push({
      ...row,
      Season: season,
      Player: player,
      playerName: player,
      Week: week,
      Type: type,
      Rank: getValue(row, ["ranking", "Rank", "RANK"]),
      PPR: getValue(row, ["PPR", "ptsPerRnd", "Average PPR"]),
      Rounds: getValue(row, ["Rds", "Rounds", "rounds", "Total Rounds"]),
      Points: getValue(row, ["Pts", "Points", "totalPts", "Total Pts", "Total Points"]),
      StatPoints: getValue(row, ["Pts", "Points", "totalPts", "Total Pts", "Total Points"]),
      OPPR: getValue(row, ["OPPR", "opponentPtsPerRnd", "Opp PPR", "Opponent PPR", "Opponents Avg PPR"]),
      "Opp Pts": getValue(row, ["Opp Pts", "opponentPts", "Opponent Points", "Opponents Pts"]),
      DPR: getValue(row, ["DPR", "diffPerRnd", "Average DPR"]),
      "4 Baggers": getValue(row, ["Total 4-Baggers", "TotalFourBaggers", "4 Baggers", "Four Baggers"]),
    });
  }

  const best = new Map<string, Record<string, any>>();
  for (const row of rows) {
    const key = `${compact(row.Season)}|${compact(row.Week)}|${compact(row.Type)}|${compact(row.Player)}`;
    const existing = best.get(key);
    if (!existing || statCompleteness(row) >= statCompleteness(existing)) best.set(key, row);
  }

  return Array.from(best.values());
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
  ].filter(isValidPlayerName));

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
