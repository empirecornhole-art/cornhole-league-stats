import * as XLSX from "xlsx";

export type LeagueData = {
  seasons: string[];
  players: string[];
  standings: Record<string, any>[];
  weekly: Record<string, any>[];
  stats: Record<string, any>[];
  lastUpdated?: string;
};

function sheetToRows(
  workbook: XLSX.WorkBook,
  sheetName: string
): Record<string, any>[] {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];

  return XLSX.utils.sheet_to_json(sheet, {
    defval: "",
  }) as Record<string, any>[];
}

function clean(value: any): string {
  return String(value ?? "").trim();
}

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) =>
    a.localeCompare(b)
  );
}

function fullName(row: Record<string, any>) {
  const first = clean(row.playerFirstName);
  const last = clean(row.playerLastName);

  if (first || last) return `${first} ${last}`.trim();

  return clean(
    row["PLAYER NAME"] ||
      row["Player Name"] ||
      row["playerName"] ||
      row["Name"] ||
      row["PLAYER"] ||
      row["Player"]
  );
}

function getSeason(row: Record<string, any>) {
  return clean(row.Season || row.season || row.SEASON || "Spring 26");
}

function getWeek(row: Record<string, any>) {
  return clean(row.Week || row.week || row.WEEK || row["Week "] || "");
}

export async function parseWorkbook(
  buffer: ArrayBuffer
): Promise<LeagueData> {
  const workbook = XLSX.read(buffer, { type: "array" });

  const overall = sheetToRows(workbook, "Overall");
  const swap = sheetToRows(workbook, "Swap");
  const blind = sheetToRows(workbook, "Blind");
  const stats = sheetToRows(workbook, "Stats");
  const lb = sheetToRows(workbook, "LB");
  const oldStats = sheetToRows(workbook, "Old Stats");

  const weekly = [
    ...swap.map((row) => ({
      ...row,
      Type: "Swap",
      type: "Swap",
      Week: clean(row.Week || row.week || row.WEEK),
      Season: getSeason(row),
      Player: clean(row["PLAYER NAME"] || row.Player || row.Name),
    })),
    ...blind.map((row) => ({
      ...row,
      Type: "Blind",
      type: "Blind",
      Week: clean(row.Week || row.week || row.WEEK),
      Season: getSeason(row),
      Player: clean(row["PLAYER NAME"] || row.Player || row.Name),
    })),
  ];

  const normalizedStats = stats.map((row) => ({
    ...row,
    Season: getSeason(row),
    Week: getWeek(row),
    Player: fullName(row),
    playerName: fullName(row),
  }));

  const normalizedOldStats = oldStats.map((row) => ({
    ...row,
    Season: getSeason(row),
    Week: getWeek(row),
    Player: fullName(row),
    playerName: fullName(row),
    Type: clean(row.TYPE || row.Type || row.type),
  }));

  const normalizedStandings = overall.map((row) => ({
    ...row,
    Season: getSeason(row),
    Player: clean(
      row.Standings ||
        row.Player ||
        row.Name ||
        row["PLAYER NAME"] ||
        row["Player Name"]
    ),
  }));

  const seasons = uniqueSorted([
    ...normalizedStandings.map((row) => clean(row.Season)),
    ...weekly.map((row) => clean(row.Season)),
    ...normalizedStats.map((row) => clean(row.Season)),
    ...normalizedOldStats.map((row) => clean(row.Season)),
  ]);

  const players = uniqueSorted([
    ...weekly.map((row) => clean(row.Player)),
    ...normalizedStats.map((row) => clean(row.Player)),
    ...normalizedOldStats.map((row) => clean(row.Player)),
    ...normalizedStandings.map((row) => clean(row.Player)),
  ]);

  return {
    seasons,
    players,
    standings: normalizedStandings,
    weekly: [...weekly, ...normalizedOldStats],
    stats: normalizedStats,
    lastUpdated: new Date().toISOString(),
  };
}
