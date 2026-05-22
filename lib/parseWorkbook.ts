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
  const word = Object.keys(seasonOrder).find((k) => s.includes(k)) || "spring";
  return { year, order: seasonOrder[word] || 99 };
}

export function seasonSort(a: string, b: string) {
  const pa = parseSeason(a);
  const pb = parseSeason(b);
  if (pa.year !== pb.year) return pa.year - pb.year;
  return pa.order - pb.order;
}

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values.map(clean).filter(Boolean))).sort((a, b) => a.localeCompare(b));
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

function numberVal(value: any) {
  if (value === null || value === undefined || value === "") return "";
  const n = Number(String(value).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : value;
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

function makeName(first: any, last: any, direct?: any) {
  const d = clean(direct);
  if (isValidPlayerName(d)) return d;
  return [clean(first), clean(last)].filter(Boolean).join(" ").trim();
}

function parseOverallStandings(workbook: XLSX.WorkBook, season: string) {
  const rows = sheetToArrays(workbook, "Overall");
  const headerRow = rows[0] || [];
  const weekColumns: { index: number; label: string }[] = [];

  for (let c = 0; c < headerRow.length; c++) {
    const label = weekLabel(headerRow[c]);
    if (/^Week \d+$/i.test(label)) weekColumns.push({ index: c, label });
  }

  const standings: Record<string, any>[] = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r] || [];
    const player = clean(row[0]);
    if (!isValidPlayerName(player)) continue;

    const overall = numberVal(row[2]);
    const obj: Record<string, any> = {
      Season: season,
      Player: player,
      playerName: player,
      Rank: standings.length + 1,
      Overall: overall,
      Points: overall,
    };

    for (const week of weekColumns) {
      obj[week.label] = numberVal(row[week.index]);
    }

    standings.push(obj);
  }

  return standings;
}

function parseOverallStatsAndAverages(workbook: XLSX.WorkBook, season: string) {
  const rows = sheetToArrays(workbook, "Overall");

  let headerRowIndex = -1;
  let startCol = -1;

  for (let r = 0; r < Math.min(rows.length, 10); r++) {
    for (let c = 0; c < (rows[r]?.length || 0); c++) {
      if (["rowlabels", "player", "playername"].includes(compact(rows[r][c]))) {
        const next = compact(rows[r][c + 1]);
        const next2 = compact(rows[r][c + 2]);
        if (next.includes("totalrounds") || next2.includes("totalpts")) {
          headerRowIndex = r;
          startCol = c;
          break;
        }
      }
    }
    if (headerRowIndex >= 0) break;
  }

  if (headerRowIndex < 0 || startCol < 0) {
    headerRowIndex = 1;
    startCol = 25;
  }

  const headers = (rows[headerRowIndex] || []).slice(startCol, startCol + 18).map(clean);
  const output: Record<string, any>[] = [];

  for (let r = headerRowIndex + 1; r < rows.length; r++) {
    const values = (rows[r] || []).slice(startCol, startCol + 18);
    const player = clean(values[0]);
    if (!isValidPlayerName(player)) continue;

    const obj: Record<string, any> = {
      Season: season,
      Player: player,
      playerName: player,
    };

    headers.forEach((header, index) => {
      if (header) obj[header] = numberVal(values[index]);
    });

    output.push(obj);
  }

  return output;
}

function parseWeeklyStandings(workbook: XLSX.WorkBook, season: string) {
  const weekly: Record<string, any>[] = [];

  const parseBlind = () => {
    const rows = sheetToArrays(workbook, "Blind");
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r] || [];
      const player = clean(row[1]);
      const week = weekLabel(row[4]);
      if (!isValidPlayerName(player) || !week) continue;

      weekly.push({
        Season: season,
        Player: player,
        playerName: player,
        Week: week,
        Type: "Blind",
        Rank: numberVal(row[0]),
        Team: clean(row[2]),
        Points: numberVal(row[3]),
        FinishPts: numberVal(row[3]),
        Wins: "",
        Losses: "",
        "+/-": "",
        raw: { source: "Blind", rowNumber: r + 1 },
      });
    }
  };

  const parseSwap = () => {
    const rows = sheetToArrays(workbook, "Swap");
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r] || [];
      const player = clean(row[1]);
      const week = weekLabel(row[8]);
      if (!isValidPlayerName(player) || !week) continue;

      weekly.push({
        Season: season,
        Player: player,
        playerName: player,
        Week: week,
        Type: "Swap",
        Rank: numberVal(row[0]),
        Team: clean(row[2]).startsWith("Team") ? clean(row[2]) : "",
        Points: numberVal(row[2]),
        FinishPts: numberVal(row[2]),
        Wins: numberVal(row[6]),
        Losses: numberVal(row[7]),
        "+/-": numberVal(row[4]),
        raw: {
          source: "Swap",
          rowNumber: r + 1,
          weeklyTotal: numberVal(row[5]),
          winLoss: clean(row[3]),
        },
      });
    }
  };

  parseBlind();
  parseSwap();

  return weekly;
}

function parseEventStats(workbook: XLSX.WorkBook, season: string) {
  const rows = sheetToArrays(workbook, "Stats");
  if (!rows.length) return [];

  const headers = (rows[0] || []).map(compact);
  const find = (...keys: string[]) => {
    const wanted = keys.map(compact);
    return headers.findIndex((h) => wanted.includes(h));
  };

  const col = {
    rank: find("ranking", "rank"),
    first: find("playerFirstName", "firstName", "first"),
    last: find("playerLastName", "lastName", "last"),
    name: find("Name", "Player Name", "Player"),
    rounds: find("rounds", "rds"),
    points: find("totalPts", "pts", "points", "totalpoints"),
    ppr: find("ptsPerRnd", "ppr", "averageppr"),
    oppPoints: find("opponentPts", "opppoints", "opponentspts"),
    oppr: find("opponentPtsPerRnd", "oppr", "opponentppr"),
    dpr: find("diffPerRnd", "dpr", "averagedpr"),
    fourBaggers: find("TotalFourBaggers", "4baggers", "total4baggers"),
    week: find("Week", "week"),
    type: find("Type", "type"),
  };

  const output: Record<string, any>[] = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r] || [];
    const player = makeName(row[col.first], row[col.last], col.name >= 0 ? row[col.name] : "");
    const week = weekLabel(col.week >= 0 ? row[col.week] : "");
    const type = typeLabel(col.type >= 0 ? row[col.type] : "");

    if (!isValidPlayerName(player) || !week || !type) continue;

    output.push({
      Season: season,
      Player: player,
      playerName: player,
      Week: week,
      Type: type,
      Rank: numberVal(col.rank >= 0 ? row[col.rank] : ""),
      PPR: numberVal(col.ppr >= 0 ? row[col.ppr] : ""),
      Rounds: numberVal(col.rounds >= 0 ? row[col.rounds] : ""),
      Points: numberVal(col.points >= 0 ? row[col.points] : ""),
      OPPR: numberVal(col.oppr >= 0 ? row[col.oppr] : ""),
      "Opp Pts": numberVal(col.oppPoints >= 0 ? row[col.oppPoints] : ""),
      DPR: numberVal(col.dpr >= 0 ? row[col.dpr] : ""),
      "4 Baggers": numberVal(col.fourBaggers >= 0 ? row[col.fourBaggers] : ""),
      raw: { source: "Stats", rowNumber: r + 1 },
    });
  }

  // Some older files include an Old Stats sheet. Add any rows not already in Stats.
  const oldRows = sheetToArrays(workbook, "Old Stats");
  if (oldRows.length) {
    const existingKeys = new Set(output.map((row) => `${compact(row.Week)}|${compact(row.Type)}|${compact(row.Player)}`));
    for (let r = 1; r < oldRows.length; r++) {
      const row = oldRows[r] || [];
      const player = clean(row[0]);
      const week = weekLabel(row[7]);
      const type = typeLabel(row[8]);
      const key = `${compact(week)}|${compact(type)}|${compact(player)}`;
      if (!isValidPlayerName(player) || !week || !type || existingKeys.has(key)) continue;

      output.push({
        Season: season,
        Player: player,
        playerName: player,
        Week: week,
        Type: type,
        Rank: "",
        PPR: numberVal(row[1]),
        Rounds: numberVal(row[2]),
        Points: numberVal(row[3]),
        OPPR: numberVal(row[4]),
        "Opp Pts": numberVal(row[5]),
        DPR: numberVal(row[6]),
        "4 Baggers": numberVal(row[9]),
        raw: { source: "Old Stats", rowNumber: r + 1 },
      });
    }
  }

  return output;
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
