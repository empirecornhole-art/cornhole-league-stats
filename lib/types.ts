export type LeagueRow = Record<string, any>;

export type LeagueData = {
  lastUpdated?: string;
  seasons: string[];
  players: string[];
  standings: LeagueRow[];
  weekly: LeagueRow[];
  stats: LeagueRow[];
};
