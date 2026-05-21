export type LeagueData = {
  seasons: string[];
  players: string[];
  standings: Record<string, any>[];
  weekly: Record<string, any>[];
  eventStats: Record<string, any>[];
  stats: Record<string, any>[];
  lastUpdated?: string;
};
