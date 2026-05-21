export type LeagueData = {
  lastUpdated?: string;
  seasons: string[];
  players: string[];
  standings: Record<string, any>[];
  weekly: Record<string, any>[];
  stats: Record<string, any>[];
};
