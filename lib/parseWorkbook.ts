import * as XLSX from "xlsx";

export type LeagueData = {
  seasons: string[];
  players: string[];
  standings: Record<string, any>[];
  weekly: Record<string, any>[];
  stats: Record<string, any>[];
};

function sheetToRows(workbook: XLSX.WorkBook, sheetName: string): Record<string, any>[] {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json(sheet, { defval: "" }) as Record<string, any>[];
}

export async function parseWorkbook(buffer: ArrayBuffer): Promise<LeagueData> {
  const workbook = XLSX.read(buffer, { type: "array" });

  const overall = sheetToRows(workbook, "Overall");
  const swap = sheetToRows(workbook, "Swap");
  const blind = sheetToRows(workbook, "Blind");
  const stats = sheetToRows(workbook, "Stats");
  const lb = sheetToRows(workbook, "LB");

  const allRows = [...overall, ...swap, ...blind, ...stats, ...lb];

  const seasons = Array.from(
    new Set(
      allRows
        .map((row) => row.Season || row.season)
        .filter(Boolean)
        .map(String)
    )
  ).sort();

  const players = Array.from(
    new Set(
      [
        ...stats.map((row) =>
          [row.First, row.Last].filter(Boolean).join(" ").trim()
        ),
        ...swap.map((row) => row.Player || row.Name || row["Player Name"]),
        ...blind.map((row) => row.Player || row.Name || row["Player Name"]),
        ...overall.map((row) => row.Player || row.Name || row["Player Name"]),
      ]
        .filter(Boolean)
        .map(String)
    )
  ).sort();

  const weekly = [
    ...swap.map((row) => ({ ...row, Type: "Swap" })),
    ...blind.map((row) => ({ ...row, Type: "Blind" })),
  ];

  return {
    seasons,
    players,
    standings: overall,
    weekly,
    stats,
  };
}
