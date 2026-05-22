import * as XLSX from "xlsx";
import { LeagueData, AnyRow } from "./types";

function clean(value: any) {
  return String(value ?? "").trim();
}

function compact(value: any) {
  return clean(value).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function num(value: any): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(String(value).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function validPlayerName(value: any) {
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

function seasonFromFilename(filename?: string) {
  const base = clean(filename || "Season").replace(/\.[^.]+$/, "");
  const match = base.match(/(spring|summer|fall|winter)[\s_-]*(\d{2,4})/i);
  if (!match) return base;
  const label = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
  const year = match[2].slice(-2);
  return `${label} ${year}`;
}

function get(row: AnyRow, keys: string[]) {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== "") return row[key];
  }
  const wanted = keys.map(compact);
  const found = Object.keys(row).find((key) => wanted.includes(compact(key)));
  return found ? row[found] : "";
}

function fullName(row: AnyRow) {
  const direct = clean(get(row, ["Name", "PLAYER NAME", "Player", "playerName", "Player Name"]));
  if (direct) return direct;
  return [get(row, ["playerFirstName", "First", "First Name"]), get(row, ["playerLastName", "Last", "Last Name"])]
    .map(clean)
    .filter(Boolean)
    .join(" ")
    .trim();
}

function weekNumber(value: any) {
  const match = clean(value).match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function normalizeType(value: any, fallback: string) {
  const v = clean(value) || fallback;
  const id = compact(v);
  if (id.includes("blind")) return "Blind";
  if (id.includes("swap")) return "Swap";
  return v;
}

function rowsFromSheet(wb: XLSX.WorkBook, sheetName: string) {
  const ws = wb.Sheets[sheetName];
  if (!ws) return [] as AnyRow[];
  return XLSX.utils.sheet_to_json<AnyRow>(ws, { defval: "", raw: true });
}

function arrayFromSheet(wb: XLSX.WorkBook, sheetName: string) {
  const ws = wb.Sheets[sheetName];
  if (!ws) return [] as any[][];
  return XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: "", raw: true });
}

export async function parseWorkbook(input: ArrayBuffer, filename?: string): Promise<LeagueData> {
  const wb = XLSX.read(input, { type: "array", cellDates: false });
  const season = seasonFromFilename(filename);
  const players = new Set<string>();
  const standings: AnyRow[] = [];
  const seasonWeekScores: AnyRow[] = [];

  const overall = arrayFromSheet(wb, "Overall");
  if (overall.length) {
    const header = overall[0].map(clean);
    const weekCols = header
      .map((h, i) => ({ h, i }))
      .filter(({ h }) => /^week\s*\d+/i.test(h));
    const overallCol = header.findIndex((h) => compact(h) === "overall");

    let rank = 1;
    for (let r = 1; r < overall.length; r++) {
      const row = overall[r] || [];
      const player = clean(row[0]);
      if (!validPlayerName(player)) continue;
      const overallPoints = num(row[overallCol >= 0 ? overallCol : 2]);
      players.add(player);
      const out: AnyRow = {
        Season: season,
        Player: player,
        playerName: player,
        Rank: rank,
        Overall: overallPoints,
        Points: overallPoints,
        standing_points: overallPoints,
      };
      for (const { h, i } of weekCols) {
        const score = num(row[i]) ?? 0;
        out[h] = score;
        seasonWeekScores.push({
          Season: season,
          Player: player,
          playerName: player,
          Week: h,
          week_number: weekNumber(h),
          score,
        });
      }
      standings.push(out);
      rank++;
    }
  }

  const weekly: AnyRow[] = [];
  for (const sheet of ["Blind", "Swap"]) {
    for (const row of rowsFromSheet(wb, sheet)) {
      const player = clean(get(row, ["PLAYER NAME", "Player", "Player Name", "Name"]));
      if (!validPlayerName(player)) continue;
      const week = clean(get(row, ["Week", "WEEK", "Week "]));
      if (!week) continue;
      const points = num(get(row, ["POINTS", "Points", "Finish Pts"]));
      players.add(player);
      weekly.push({
        Season: season,
        Player: player,
        playerName: player,
        Week: week,
        Type: sheet,
        Rank: num(get(row, ["RANK", "Rank", "Finish", "Place"])),
        Team: clean(get(row, ["TEAM", "Team"])),
        Points: points,
        "Finish Pts": points,
        Wins: num(get(row, ["WINS", "Wins"])),
        Losses: num(get(row, ["LOSSES", "Losses"])),
        "+/-": num(get(row, ["+ / -", "+/-", "Plus Minus"])),
        raw: row,
      });
    }
  }

  const eventStats: AnyRow[] = [];
  for (const row of rowsFromSheet(wb, "Stats")) {
    const player = fullName(row);
    if (!validPlayerName(player)) continue;
    const week = clean(get(row, ["Week", "WEEK", "Week "]));
    const type = normalizeType(get(row, ["Type", "TYPE"]), "");
    if (!week || !type) continue;
    players.add(player);
    eventStats.push({
      Season: season,
      Player: player,
      playerName: player,
      Week: week,
      Type: type,
      Rank: num(get(row, ["ranking", "Rank", "RANK"])),
      PPR: num(get(row, ["ptsPerRnd", "PPR", "Average PPR"])),
      Rounds: num(get(row, ["rounds", "Rounds", "Rds"])),
      Points: num(get(row, ["totalPts", "Pts", "Points", "Total Pts"])),
      OPPR: num(get(row, ["opponentPtsPerRnd", "OPPR", "Opp PPR", "Opponent PPR"])),
      "Opp Pts": num(get(row, ["opponentPts", "Opp Pts", "Opponent Points"])),
      DPR: num(get(row, ["diffPerRnd", "DPR", "Average DPR"])),
      "4 Baggers": num(get(row, ["TotalFourBaggers", "Total 4-Baggers", "4 Baggers"])),
      raw: row,
    });
  }

  // Season stat totals are aggregated from the event stats. Standings points come from the Overall sheet.
  const byPlayer = new Map<string, AnyRow>();
  for (const row of eventStats) {
    const player = clean(row.Player);
    const key = compact(player);
    const existing = byPlayer.get(key) || {
      Season: season,
      Player: player,
      playerName: player,
      "Total Rounds": 0,
      "Total Pts": 0,
      "Opponents Pts": 0,
      "Total 4-Baggers": 0,
    };
    existing["Total Rounds"] += num(row.Rounds) || 0;
    existing["Total Pts"] += num(row.Points) || 0;
    existing["Opponents Pts"] += num(row["Opp Pts"]) || 0;
    existing["Total 4-Baggers"] += num(row["4 Baggers"]) || 0;
    byPlayer.set(key, existing);
  }

  const standingByPlayer = new Map(standings.map((s) => [compact(s.Player), s]));
  const stats = Array.from(byPlayer.values()).map((row) => {
    const rounds = num(row["Total Rounds"]) || 0;
    const pts = num(row["Total Pts"]) || 0;
    const opp = num(row["Opponents Pts"]) || 0;
    const standing = standingByPlayer.get(compact(row.Player));
    return {
      ...row,
      Finish: standing?.Rank ?? null,
      standing_points: standing?.standing_points ?? null,
      "Average PPR": rounds ? pts / rounds : null,
      "Opponents Avg PPR": rounds ? opp / rounds : null,
      "Average DPR": rounds ? (pts - opp) / rounds : null,
    };
  });

  return {
    seasons: [season],
    players: Array.from(players).filter(validPlayerName).sort((a, b) => a.localeCompare(b)),
    standings,
    weekly,
    eventStats,
    stats,
    seasonWeekScores,
    lastUpdated: new Date().toISOString(),
  };
}
