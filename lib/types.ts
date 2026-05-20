export type LeagueData = {
  lastUpdated?: string;
  seasons: string[];
  players: string[];
  overall: Record<string, any>[];
  swap: Record<string, any>[];
  blind: Record<string, any>[];
  stats: Record<string, any>[];
  leaderboard: Record<string, any>[];
};
