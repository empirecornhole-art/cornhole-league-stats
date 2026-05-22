import * as XLSX from "xlsx";
import { LeagueData } from "./types";

function clean(value: any): string {
  return String(value ?? "").trim();
}

function compact(value: any): string {
  return clean(value).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function num(value: any): number | string {
  if (value === null || value === undefined || value === "") return "";
  const parsed = Number(String(value).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : "";
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
  return Array.from(new Set(values.map(clean).filter(Boolean))).sort((a, b) =>
    seasonSort(a, b)
  );
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

function headerIndex(headers: any[], names: string[]) {
  const wanted = names.map(compact);
  return headers.findIndex((header) => wanted.includes(compact(header)));
}

function valueAt(row: any[], index: number) {
  return index >= 0 ? row[index] : "";
}

function parseOverallStandings(workbook: XLSX.WorkBook, season: string) {
  const rows = sheetToArrays(workbook, "Overall");
  const headers = rows[0] || [];
  const out: Record<string, any>[] = [];

  for (const row of rows.slice(1)) {
    const player = clean(row[0]);
    if (!isValidPlayerName(player)) continue;

    const obj: Record<string, any> = {
      Season: season,
      Player: player,
      playerName: player,
      Rank: out.length + 1,
      Overall: row[2],
      Points: row[2],
    };

    // Preserve the weekly score columns from the Overall sheet for the Scenarios tab.
    headers.forEach((header, columnIndex) => {
      const label = clean(header);
      if (label) obj[label] = row[columnIndex];
    });

    out.push(obj);
  }

  return out;
}

function parseOverallStatsAndAverages(workbook: XLSX.WorkBook, season: string) {
  const rows = sheetToArrays(workbook, "Overall");

  // In the current workbook, the season stat table begins at column Z with
  // row 2 headers. We still search for the heading so this survives layout tweaks.
  let headerRowIndex = 1;
  let startCol = 25;

  for (let r = 0; r < Math.min(rows.length, 10); r++) {
    for (let c = 0; c < (rows[r]?.length || 0); c++) {
      if (compact(rows[r][c]) === "overallstatsandaverages") {
        headerRowIndex = r + 1;
        startCol = c;
        break;
      }
    }
  }

  const headers = rows[headerRowIndex] || [];
  const out: Record<string, any>[] = [];

  for (const row of rows.slice(headerRowIndex + 1)) {
    const player = clean(row[startCol]);
    if (!isValidPlayerName(player)) continue;

    const obj: Record<string, any> = {
      Season: season,
      Player: player,
      playerName: player,
    };

    for (let c = startCol; c < Math.min(startCol + 18, headers.length); c++) {
      const label = clean(headers[c]);
      if (label) obj[label] = row[c];
    }

    out.push(obj);
  }

  return out;
}

function parseWeeklyStandings(workbook: XLSX.WorkBook, season: string) {
  const out: Record<string, any>[] = [];

  function parseBlind() {
    const rows = sheetToArrays(workbook, "Blind");
    for (const row of rows.slice(1)) {
      const player = clean(row[1]);
      const week = weekLabel(row[4]);
      if (!isValidPlayerName(player) || !week) continue;

      out.push({
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
  }

  function parseSwap() {
    const rows = sheetToArrays(workbook, "Swap");
    for (const row of rows.slice(1)) {
      const player = clean(row[1]);
      const week = weekLabel(row[8]);
      if (!isValidPlayerName(player) || !week) continue;

      out.push({
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
        RawPoints: row[5],
      });
    }
  }

  parseBlind();
  parseSwap();

  return out;
}

function parseEventStats(workbook: XLSX.WorkBook, season: string) {
  const rows = sheetToArrays(workbook, "Stats");
  if (!rows.length) return [];

  const headers = rows[0] || [];
  const idx = {
    ranking: headerIndex(headers, ["ranking", "rank"]),
    first: headerIndex(headers, ["playerFirstName", "first name", "first"]),
    last: headerIndex(headers, ["playerLastName", "last name", "last"]),
    name: headerIndex(headers, ["name", "player name", "player"]),
    rounds: headerIndex(headers, ["rounds", "rds", "total rounds"]),
    totalPts: headerIndex(headers, ["totalPts", "points", "pts", "total points", "total pts"]),
    ppr: headerIndex(headers, ["ptsPerRnd", "ppr", "points per round", "average ppr"]),
    opponentPts: headerIndex(headers, ["opponentPts", "opp pts", "opponent points", "opponents pts"]),
    oppr: headerIndex(headers, ["opponentPtsPerRnd", "oppr", "opp ppr", "opponent ppr", "opponents avg ppr"]),
    dpr: headerIndex(headers, ["diffPerRnd", "dpr", "average dpr"]),
    fourBaggers: headerIndex(headers, ["TotalFourBaggers", "4 baggers", "total 4-baggers", "four baggers"]),
    week: headerIndex(headers, ["Week", "Week ", "week"]),
    type: headerIndex(headers, ["Type", "type"]),
  };

  const out: Record<string, any>[] = [];

  for (const row of rows.slice(1)) {
    const explicitName = clean(valueAt(row, idx.name));
    const first = clean(valueAt(row, idx.first));
    const last = clean(valueAt(row, idx.last));
    const player = explicitName || [first, last].filter(Boolean).join(" ").trim();
    const week = weekLabel(valueAt(row, idx.week));
    const type = typeLabel(valueAt(row, idx.type));

    if (!isValidPlayerName(player) || !week || !type) continue;

    out.push({
      Season: season,
      Player: player,
      playerName: player,
      Week: week,
      Type: type,
      Rank: valueAt(row, idx.ranking),
      PPR: num(valueAt(row, idx.ppr)),
      Rounds: num(valueAt(row, idx.rounds)),
      Points: num(valueAt(row, idx.totalPts)),
      OPPR: num(valueAt(row, idx.oppr)),
      "Opp Pts": num(valueAt(row, idx.opponentPts)),
      DPR: num(valueAt(row, idx.dpr)),
      "4 Baggers": num(valueAt(row, idx.fourBaggers)),
      raw: {
        ranking: valueAt(row, idx.ranking),
        playerFirstName: first,
        playerLastName: last,
        playerName: player,
        rounds: valueAt(row, idx.rounds),
        totalPts: valueAt(row, idx.totalPts),
        ptsPerRnd: valueAt(row, idx.ppr),
        opponentPts: valueAt(row, idx.opponentPts),
        opponentPtsPerRnd: valueAt(row, idx.oppr),
        diffPerRnd: valueAt(row, idx.dpr),
        TotalFourBaggers: valueAt(row, idx.fourBaggers),
        Week: week,
        Type: type,
      },
    });
  }

  return out;
}

export async function parseWorkbook(buffer: ArrayBuffer, fileName?: string): Promise<LeagueData> {
  const workbook = XLSX.read(buffer, { type: "array" });
  const season = seasonFromFileName(fileName);

  const standings = parseOverallStandings(workbook, season);
  const stats = parseOverallStatsAndAverages(workbook, season);
  const weekly = parseWeeklyStandings(workbook, season);
  const eventStats = parseEventStats(workbook, season);

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
