import * as XLSX from "xlsx";

export type LeagueData = {
  seasons: string[];
  players: string[];
  standings: Record<string, any>[];
  weekly: Record<string, any>[];
  stats: Record<string, any>[];
  lastUpdated?: string;
};

function clean(value: any): string {
  return String(value ?? "").trim();
}

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) =>
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

function getSeason(row: Record<string, any>, fallback = "Spring 26") {
  return clean(row.Season || row.season || row.SEASON || fallback);
}

function normalizeType(value: any) {
  const v = clean(value).toLowerCase();
  if (v.includes("swap")) return "Swap";
  if (v.includes("blind")) return "Blind";
  return clean(value);
}

function getPlayerName(row: Record<string, any>) {
  const first = clean(row.playerFirstName || row.First || row["First Name"]);
  const last = clean(row.playerLastName || row.Last || row["Last Name"]);
  if (first || last) return `${first} ${last}`.trim();
  return clean(
    row.Name ||
      row.name ||
      row.Player ||
      row.playerName ||
      row["PLAYER NAME"] ||
      row["Player Name"] ||
      row["Row Labels"]
  );
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

function parseStandingRows(workbook: XLSX.WorkBook, season: string) {
  const swapStandings = sheetToObjects(workbook, "Swap").map((row) => ({
    ...row,
    RecordKind: "Standing",
    Season: getSeason(row, season),
    Player: clean(row["PLAYER NAME"] || row.Player || row.Name),
    Week: clean(row.Week || row.week || row.WEEK),
    Type: "Swap",
  }));

  const blindStandings = sheetToObjects(workbook, "Blind").map((row) => ({
    ...row,
    RecordKind: "Standing",
    Season: getSeason(row, season),
    Player: clean(row["PLAYER NAME"] || row.Player || row.Name),
    Week: clean(row.Week || row.week || row.WEEK),
    Type: "Blind",
  }));

  return [...swapStandings, ...blindStandings].filter(
    (row) => row.Player && row.Week && row.Type
  );
}

function parseEventStatRows(workbook: XLSX.WorkBook, season: string) {
  const statsRows = sheetToObjects(workbook, "Stats").map((row) => {
    const player = getPlayerName(row);
    const week = clean(row["Week "] || row.Week || row.week || row.WEEK);
    const type = normalizeType(row.Type || row.type || row.TYPE);

    return {
      ...row,
      RecordKind: "Stats",
      Season: getSeason(row, season),
      Player: player,
      playerName: player,
      Week: week,
      Type: type,
      Rank: row.ranking,
      PPR: row.ptsPerRnd,
      Rounds: row.rounds,
      Points: row.totalPts,
      OPPR: row.opponentPtsPerRnd,
      "Opp Pts": row.opponentPts,
      DPR: row.diffPerRnd,
      "4 Baggers": row.TotalFourBaggers,
      "4 Bagger %": row.fourBaggerPct,
      "Bags In %": row.bagsInPct,
      "Bags On %": row.bagsOnPct,
      "Bags Off %": row.bagsOffPct,
      "Avg Bags In/Rd": row.avgBagsInPerRnd,
      "Total Bags": row.totalBags,
      "Bags In": row.bagsIn,
      "Top Finish": row.Top,
      "Swap Avg Rounds": row["Swap Avg Rounds"],
    };
  });

  return statsRows.filter((row) => row.Player && row.Week && row.Type);
}

function parseOldStatRows(workbook: XLSX.WorkBook, season: string) {
  const oldRows = sheetToObjects(workbook, "Old Stats").map((row) => {
    const player = getPlayerName(row);
    const week = clean(row.WEEK || row.Week || row.week);
    const type = normalizeType(row.TYPE || row.Type || row.type);

    return {
      ...row,
      RecordKind: "Stats",
      Season: getSeason(row, season),
      Player: player,
      playerName: player,
      Week: week,
      Type: type,
      PPR: row.PPR,
      Rounds: row.Rds,
      Points: row.Pts,
      OPPR: row.OPPR,
      "Opp Pts": row["Opp Pts"],
      DPR: row.DPR,
      "4 Baggers": row["Total 4-Baggers"],
    };
  });

  return oldRows.filter((row) => row.Player && row.Week && row.Type);
}

function parseWeeklyRows(workbook: XLSX.WorkBook, season: string) {
  return [
    ...parseStandingRows(workbook, season),
    ...parseEventStatRows(workbook, season),
    ...parseOldStatRows(workbook, season),
  ];
}

export async function parseWorkbook(buffer: ArrayBuffer): Promise<LeagueData> {
  const workbook = XLSX.read(buffer, { type: "array" });
  const season = "Spring 26";

  const standings = parseOverallStandings(workbook, season);
  const stats = parseOverallStatsAndAverages(workbook, season);
  const weekly = parseWeeklyRows(workbook, season);

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
