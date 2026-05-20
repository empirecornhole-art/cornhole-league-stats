import * as XLSX from 'xlsx';
import { LeagueData } from './types';

function rowsFromSheet(workbook: XLSX.WorkBook, sheetName: string): Record<string, any>[] {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json(sheet, { defval: '' }) as Record<string, any>[];
}

function clean(v: any): string {
  return String(v ?? '').trim();
}

function findSeason(row: Record<string, any>, fallback = 'Spring 26') {
  return clean(row.Season || row.season || fallback) || fallback;
}

function playerName(row: Record<string, any>): string {
  const direct = clean(row.Player || row.Name || row.player || row.name || row['Player Name']);
  if (direct) return direct;
  const first = clean(row.First || row['First Name'] || row.FirstName);
  const last = clean(row.Last || row['Last Name'] || row.LastName);
  return [first, last].filter(Boolean).join(' ');
}

export function parseWorkbook(buffer: Buffer): LeagueData {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const overall = rowsFromSheet(workbook, 'Overall');
  const swap = rowsFromSheet(workbook, 'Swap');
  const blind = rowsFromSheet(workbook, 'Blind');
  const stats = rowsFromSheet(workbook, 'Stats');
  const leaderboard = rowsFromSheet(workbook, 'LB');

  const allRows = [...overall, ...swap, ...blind, ...stats, ...leaderboard];
  const seasons = Array.from(new Set(allRows.map(r => findSeason(r)).filter(Boolean))).sort();
  const playerSet = new Set<string>();
  allRows.forEach(r => { const n = playerName(r); if (n) playerSet.add(n); });

  return {
    lastUpdated: new Date().toISOString(),
    seasons: seasons.length ? seasons : ['Spring 26'],
    players: Array.from(playerSet).sort(),
    overall,
    swap,
    blind,
    stats,
    leaderboard
  };
}
