import { NextResponse } from 'next/server';
import { loadLeagueData } from '@/lib/blob';

export async function GET() {
  const data = await loadLeagueData();
  return NextResponse.json(data ?? { seasons: [], players: [], overall: [], swap: [], blind: [], stats: [], leaderboard: [] });
}
