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

function sheetToObjects(
  workbook: XLSX.WorkBook,
  sheetName: string
): Record<string, any>[] {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];

  return XLSX.utils.sheet_to_json(sheet, {
    defval: "",
  }) as Record<string, any>[];
}

function sheetToArrays(workbook: XLSX.WorkBook, sheetName: string): any[][] {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];

  return XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
  }) as any[][];
}

function getSeason(row: Record<string, any>, fallback = "Spring 26") {
  return clean(row.Season || row.season || row.SEASON || fallback);
}

function getPlayerName(row: Record<string, any>) {
  const first = clean(row.playerFirstName || row.First || row["First Name"]);
  const last = clean(row.playerLastName || row.Last || row["Last Name"]);

  if (first || last) return `${first} ${last}`.trim();

  return clean(
    row["Row Labels"] ||
      row.Player ||
      row.playerName ||
      row["Player Name"] ||
      row["PLAYER NAME"] ||
      row.Name ||
      row.name
  );
}

function parseOverallStandings(
  workbook: XLSX.WorkBook,
  season: string
): Record<string, any>[] {
  const rows = sheetToArrays(workbook, "Overall");
  if (!rows.length) return [];

  const header = rows[0];

  const standingsHeaders = header.slice(0, 16).map(clean);

  return rows
    .slice(1)
    .map((row) => {
      const player = clean(row[0]);
      if (!player) return null;

      const obj: Record<string, any> = {
        Season: season,
        Player: player,
        Standings: player,
        Overall: row[2],
      };

      standingsHeaders.forEach((headerName, index) => {
        if (headerName) obj[headerName] = row[index];
      });

      return obj;
    })
    .filter(Boolean) as Record<string, any>[];
}

function parseOverallStatsAndAverages(
  workbook: XLSX.WorkBook,
  season: string
): Record<string, any>[] {
  const rows = sheetToArrays(workbook, "Overall");
  if (rows.length < 3) return [];

  // Overall Stats and Averages starts at column Z, index 25.
  // Header row is Excel row 2, zero-based index 1.
  const startCol = 25;
  const endCol = 42;

  const headers = rows[1].slice(startCol, endCol).map(clean);

  return rows
    .slice(2)
    .map((row) => {
      const values = row.slice(startCol, endCol);
      const playerName = clean(values[0]);

      if (!playerName || playerName === "Grand Total") return null;

      const obj: Record<string, any> = {
        Season: season,
        Player: playerName,
        playerName,
      };

      headers.forEach((header, index) => {
        if (header) obj[header] = values[index];
      });

      return obj;
    })
    .filter(Boolean) as Record<string, any>[];
}

function parseWeeklyRows(
  workbook: XLSX.WorkBook,
  season: string
): Record<string, any>[] {
  const swap = sheetToObjects(workbook, "Swap").map((row) => ({
    ...row,
    Season: getSeason(row, season),
    Player: clean(row["PLAYER NAME"] || row.Player || row.Name),
    Week: clean(row.Week || row.week || row.WEEK),
    Type: "Swap",
  }));

  const blind = sheetToObjects(workbook, "Blind").map((row) => ({
    ...row,
    Season: getSeason(row, season),
    Player: clean(row["PLAYER NAME"] || row.Player || row.Name),
    Week: clean(row.Week || row.week || row.WEEK),
    Type: "Blind",
  }));

  const oldStats = sheetToObjects(workbook, "Old Stats").map((row) => ({
    ...row,
    Season: getSeason(row, season),
    Player: clean(row["PLAYER NAME"] || row.Player || row.Name),
    Week: clean(row.WEEK || row.Week || row.week),
    Type: clean(row.TYPE || row.Type || row.type),
  }));

  return [...swap, ...blind, ...oldStats].filter((row) => row.Player);
}

export async function parseWorkbook(buffer: ArrayBuffer): Promise<LeagueData> {
  const workbook = XLSX.read(buffer, { type: "array" });

  const defaultSeason = "Spring 26";

  const standings = parseOverallStandings(workbook, defaultSeason);
  const stats = parseOverallStatsAndAverages(workbook, defaultSeason);
  const weekly = parseWeeklyRows(workbook, defaultSeason);

  const seasons = uniqueSorted([
    ...standings.map((row) => clean(row.Season)),
    ...stats.map((row) => clean(row.Season)),
    ...weekly.map((row) => clean(row.Season)),
  ]);

  const players = uniqueSorted([
    ...standings.map(getPlayerName),
    ...stats.map(getPlayerName),
    ...weekly.map(getPlayerName),
  ]);

  return {
    seasons,
    players,
    standings,
    weekly,
    stats,
    lastUpdated: new Date().toISOString(),
  };
}
