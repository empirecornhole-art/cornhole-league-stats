export type LeagueRow = Record<string, any>;

export type LeagueData = {
  seasons: string[];
  players: string[];
  standings: LeagueRow[];
  weekly: LeagueRow[];
  stats: LeagueRow[];
  eventStats: LeagueRow[];
  lastUpdated?: string;
};
