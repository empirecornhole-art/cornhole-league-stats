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

function getPlayerName(row: Record<string, any>) {
  const first = clean(row.playerFirstName || row.First || row["First Name"]);
  const last = clean(row.playerLastName || row.Last || row["Last Name"]);
  if (first || last) return `${first} ${last}`.trim();
  return clean(row.Player || row.playerName || row["Row Labels"] || row["PLAYER NAME"] || row["Player Name"] || row.Name || row.name);
}

function parseOverallStandings(workbook: XLSX.WorkBook, season: string) {
  const rows = sheetToArrays(workbook, "Overall");
  const headers = rows[0]?.slice(0, 16).map(clean) || [];

  return rows.slice(1).map((row) => {
    const player = clean(row[0]);
    if (!player || player === "Grand Total") return null;

    const obj: Record<string, any> = { Season: season, Player: player, Overall: row[2] };
    headers.forEach((header, index) => { if (header) obj[header] = row[index]; });
    return obj;
  }).filter(Boolean) as Record<string, any>[];
}

function parseOverallStatsAndAverages(workbook: XLSX.WorkBook, season: string) {
  const rows = sheetToArrays(workbook, "Overall");
  const startCol = 25;
  const endCol = 42;
  const headers = rows[1]?.slice(startCol, endCol).map(clean) || [];

  return rows.slice(2).map((row) => {
    const values = row.slice(startCol, endCol);
    const player = clean(values[0]);
    if (!player || player === "Grand Total") return null;

    const obj: Record<string, any> = { Season: season, Player: player, playerName: player };
    headers.forEach((header, index) => { if (header) obj[header] = values[index]; });
    return obj;
  }).filter(Boolean) as Record<string, any>[];
}

function normalizeType(value: any) {
  const v = clean(value).toLowerCase();
  if (v.includes("swap")) return "Swap";
  if (v.includes("blind")) return "Blind";
  return clean(value);
}

function parseWeeklyRows(workbook: XLSX.WorkBook, season: string) {
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

  // This is the detailed weekly stats source.
  const detailedStats = sheetToObjects(workbook, "Old Stats").map((row) => ({
    ...row,
    RecordKind: "Stats",
    Season: getSeason(row, season),
    Player: getPlayerName(row),
    Week: clean(row.WEEK || row.Week || row.week),
    Type: normalizeType(row.TYPE || row.Type || row.type),
  }));

  return [...swapStandings, ...blindStandings, ...detailedStats].filter(
    (row) => row.Player && row.Week && row.Type
  );
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
