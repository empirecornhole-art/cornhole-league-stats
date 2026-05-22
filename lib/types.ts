export type AnyRow = Record<string, any>;

export type LeagueData = {
  lastUpdated?: string;
  seasons: string[];
  players: string[];
  standings: AnyRow[];
  weekly: AnyRow[];
  eventStats: AnyRow[];
  stats: AnyRow[];
  seasonWeekScores?: AnyRow[];
};
