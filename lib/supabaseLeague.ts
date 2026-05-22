import { getSupabaseAdmin } from "./supabaseAdmin";
import { LeagueData } from "./types";

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

function normalizeName(name: string) {
  return compact(name);
}

function isValidPlayerName(value: any) {
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
    "rank",
    "team",
  ].includes(id);
}

function getValue(row: Record<string, any>, keys: string[]) {
  for (const key of keys) {
    if (row?.[key] !== undefined && row?.[key] !== "") return row[key];
  }

  const wanted = keys.map(compact);
  const found = Object.keys(row || {}).find((key) => wanted.includes(compact(key)));
  return found ? row[found] : "";
}

function weekNumber(week: string) {
  const match = clean(week).match(/\d+/);
  return match ? Number(match[0]) : 0;
}

const seasonOrder: Record<string, number> = {
  spring: 1,
  summer: 2,
  fall: 3,
  winter: 4,
};

function parseSeasonName(name: string) {
  const lowered = clean(name).toLowerCase();
  const yearMatch = lowered.match(/(\d{2,4})/);
  const seasonWord = Object.keys(seasonOrder).find((word) => lowered.includes(word)) || "spring";
  const year = yearMatch ? Number(yearMatch[1].slice(-2)) : 0;

  return {
    label: seasonWord.charAt(0).toUpperCase() + seasonWord.slice(1),
    year,
    order: seasonOrder[seasonWord] || 99,
  };
}

function getPlayer(row: Record<string, any>) {
  return clean(
    row.Player ||
      row.playerName ||
      row["Player Name"] ||
      row["PLAYER NAME"] ||
      row.Name ||
      row.name ||
      row.player
  );
}

function eventKey(week: any, type: any) {
  return `${clean(week)}|${clean(type)}`;
}

function dedupeBy<T>(rows: T[], getKey: (row: T) => string) {
  const map = new Map<string, T>();

  for (const row of rows) {
    const key = getKey(row);
    if (!key) continue;
    map.set(key, row);
  }

  return Array.from(map.values());
}

function filledCount(row: Record<string, any>, keys: string[]) {
  return keys.reduce((count, key) => {
    const value = row[key];
    return value !== null && value !== undefined && value !== "" ? count + 1 : count;
  }, 0);
}

function dedupeEventStats(rows: any[]) {
  const important = [
    "ppr",
    "rounds",
    "points",
    "oppr",
    "opponent_points",
    "dpr",
    "four_baggers",
  ];

  const map = new Map<string, any>();

  for (const row of rows) {
    const key = `${row.event_id}|${row.player_id}`;
    const existing = map.get(key);

    if (!existing) {
      map.set(key, row);
      continue;
    }

    const existingScore = filledCount(existing, important);
    const nextScore = filledCount(row, important);

    // Prefer the row with the most complete stat fields. This avoids game-level
    // partial rows overwriting the actual event summary row.
    const winner = nextScore >= existingScore ? row : existing;
    const loser = winner === row ? existing : row;

    map.set(key, {
      ...loser,
      ...winner,
      ppr: winner.ppr ?? loser.ppr,
      rounds: winner.rounds ?? loser.rounds,
      points: winner.points ?? loser.points,
      oppr: winner.oppr ?? loser.oppr,
      opponent_points: winner.opponent_points ?? loser.opponent_points,
      dpr: winner.dpr ?? loser.dpr,
      four_baggers: winner.four_baggers ?? loser.four_baggers,
      raw: { ...(loser.raw || {}), ...(winner.raw || {}) },
    });
  }

  return Array.from(map.values());
}

function findStandingForPlayer(parsed: LeagueData, playerName: string) {
  const target = normalizeName(playerName);
  return (parsed.standings || []).find((row) => normalizeName(getPlayer(row)) === target) || null;
}

function standingPointsForPlayer(parsed: LeagueData, playerName: string) {
  const standing = findStandingForPlayer(parsed, playerName) || {};

  return num(
    getValue(standing, [
      "Overall",
      "Standing Points",
      "Standings Points",
      "League Points",
      "Total",
      "Points",
      "Total Points",
    ])
  );
}

function seasonStatsPayload(parsed: LeagueData, seasonId: string, playerMap: Map<string, string>) {
  return (parsed.stats || [])
    .map((row) => {
      const playerName = getPlayer(row);
      const playerId = playerMap.get(normalizeName(playerName));

      if (!isValidPlayerName(playerName) || !playerId) return null;

      const standing = findStandingForPlayer(parsed, playerName);

      return {
        season_id: seasonId,
        player_id: playerId,
        player_name: playerName,
        finish: num(getValue(standing || {}, ["Rank", "RANK", "Finish", "Place"])),
        standing_points: standingPointsForPlayer(parsed, playerName),
        total_rounds: num(getValue(row, ["Total Rounds"])),
        total_points: num(getValue(row, ["Total Pts", "Total Points", "Points"])),
        average_ppr: num(getValue(row, ["Average PPR", "PPR"])),
        opponent_average_ppr: num(getValue(row, ["Opponents Avg PPR", "OPPR", "Opp Avg PPR"])),
        average_dpr: num(getValue(row, ["Average DPR", "DPR"])),
        opponent_points: num(getValue(row, ["Opponents Pts", "Opp Pts", "Opponent Points"])),
        avg_bags_in: num(getValue(row, ["Avg Bags In"])),
        total_bags_in: num(getValue(row, ["Total Bags In"])),
        avg_bags_in_per_round: num(getValue(row, ["Avg Bags In per Rd", "Avg Bags In/Rd"])),
        bags_on_percent: num(getValue(row, ["Bags On %"])),
        bags_off_percent: num(getValue(row, ["Bags Off %"])),
        total_bags_thrown: num(getValue(row, ["Total Bags Thrown", "Total Bags"])),
        avg_four_bagger_percent: num(getValue(row, ["Avg 4-Bagger %"])),
        total_four_baggers: num(getValue(row, ["Total 4-Baggers", "4 Baggers"])),
        first_in_stats: num(getValue(row, ["1st in Stats"])),
        avg_rounds_per_swap_game: num(getValue(row, ["Avg Rounds/Swap Game", "Avg Rounds/Swap"])),
        raw: row,
      };
    })
    .filter(Boolean);
}

function resultPayload(rows: Record<string, any>[], eventMap: Map<string, string>, playerMap: Map<string, string>) {
  return rows
    .map((row) => {
      const playerName = getPlayer(row);
      const playerId = playerMap.get(normalizeName(playerName));
      const eventId = eventMap.get(eventKey(row.Week, row.Type));

      if (!isValidPlayerName(playerName) || !playerId || !eventId) return null;

      return {
        event_id: eventId,
        player_id: playerId,
        player_name: playerName,
        rank: num(getValue(row, ["Rank", "RANK", "Finish", "Place"])),
        team: clean(getValue(row, ["Team", "TEAM"])) || null,
        finish_points: num(getValue(row, ["Finish Pts", "Weekly Points", "Points", "POINTS"])),
        wins: num(getValue(row, ["Wins", "WINS"])),
        losses: num(getValue(row, ["Losses", "LOSSES"])),
        plus_minus: num(getValue(row, ["+/-", "+ / -", "Plus Minus"])),
        raw: row,
      };
    })
    .filter(Boolean);
}

function eventStatsPayload(rows: Record<string, any>[], eventMap: Map<string, string>, playerMap: Map<string, string>) {
  return rows
    .map((row) => {
      const playerName = getPlayer(row);
      const playerId = playerMap.get(normalizeName(playerName));
      const eventId = eventMap.get(eventKey(row.Week, row.Type));

      if (!isValidPlayerName(playerName) || !playerId || !eventId) return null;

      return {
        event_id: eventId,
        player_id: playerId,
        player_name: playerName,
        rank: num(getValue(row, ["Rank", "RANK"])),
        ppr: num(getValue(row, ["PPR", "Average PPR", "ptsPerRnd", "Pts Per Rnd", "Points Per Round"])),
        rounds: num(getValue(row, ["Rounds", "Total Rounds", "roundsPlayed", "rounds"])),
        points: num(getValue(row, ["Points", "Total Pts", "Total Points", "totalPoints", "points"])),
        oppr: num(getValue(row, ["OPPR", "Opp PPR", "Opponent PPR", "Opponents Avg PPR", "opponentPtsPerRnd"])),
        opponent_points: num(getValue(row, ["Opp Pts", "Opponent Points", "Opponents Pts", "opponentPoints"])),
        dpr: num(getValue(row, ["DPR", "Average DPR", "diffPerRnd"])),
        four_baggers: num(getValue(row, ["4 Baggers", "Total 4-Baggers", "Four Baggers", "TotalFourBaggers", "fourBaggers"])),
        raw: row,
      };
    })
    .filter(Boolean);
}

function weekScorePayload(parsed: LeagueData, seasonId: string, playerMap: Map<string, string>) {
  const rows = ((parsed as any).weekScores || []) as Record<string, any>[];

  return rows
    .map((row) => {
      const playerName = getPlayer(row);
      const playerId = playerMap.get(normalizeName(playerName));
      const week = clean(row.Week || row.week || row.week_label || row.weekLabel);
      const weekNum = weekNumber(week || String(row.week_number || row.weekNumber || ""));
      const score = num(getValue(row, ["Score", "score", "Points", "points", "Total"]));

      if (!isValidPlayerName(playerName) || !playerId || !weekNum) return null;

      return {
        season_id: seasonId,
        player_id: playerId,
        player_name: playerName,
        week_number: weekNum,
        week_label: week || `Week ${weekNum}`,
        score,
        raw: row,
      };
    })
    .filter(Boolean);
}

export async function importLeagueDataToSupabase(parsed: LeagueData) {
  const supabase = getSupabaseAdmin();
  const seasonName = parsed.seasons?.[0];

  if (!seasonName) {
    throw new Error("Could not determine the season from the workbook filename.");
  }

  const seasonMeta = parseSeasonName(seasonName);

  const { data: existingSeason, error: existingSeasonError } = await supabase
    .from("seasons")
    .select("id")
    .eq("name", seasonName)
    .maybeSingle();

  if (existingSeasonError) throw existingSeasonError;

  if (existingSeason?.id) {
    const { error: deleteError } = await supabase
      .from("seasons")
      .delete()
      .eq("id", existingSeason.id);

    if (deleteError) throw deleteError;
  }

  const { data: season, error: seasonError } = await supabase
    .from("seasons")
    .insert({
      name: seasonName,
      season_label: seasonMeta.label,
      season_year: seasonMeta.year,
      season_order: seasonMeta.order,
    })
    .select("id")
    .single();

  if (seasonError) throw seasonError;

  const playerNames = Array.from(
    new Set((parsed.players || []).map(clean).filter(isValidPlayerName))
  ).sort((a, b) => a.localeCompare(b));

  const playerRows = dedupeBy(
    playerNames.map((name) => ({ name, normalized_name: normalizeName(name) })),
    (row) => row.normalized_name
  );

  if (playerRows.length) {
    const { error: playerError } = await supabase
      .from("players")
      .upsert(playerRows, { onConflict: "normalized_name" });

    if (playerError) throw playerError;
  }

  const { data: dbPlayers, error: dbPlayersError } = await supabase
    .from("players")
    .select("id,name,normalized_name")
    .in("normalized_name", playerRows.map((row) => row.normalized_name));

  if (dbPlayersError) throw dbPlayersError;

  const playerMap = new Map((dbPlayers || []).map((p) => [p.normalized_name, p.id]));

  const eventKeys = new Map<string, { week: string; event_type: string; week_number: number }>();

  for (const row of [...(parsed.weekly || []), ...(parsed.eventStats || [])]) {
    const week = clean(row.Week);
    const eventType = clean(row.Type);
    if (!week || !eventType) continue;

    eventKeys.set(eventKey(week, eventType), {
      week,
      event_type: eventType,
      week_number: weekNumber(week),
    });
  }

  const eventRows = Array.from(eventKeys.values()).map((event) => ({
    season_id: season.id,
    week: event.week,
    week_number: event.week_number,
    event_type: event.event_type,
  }));

  if (eventRows.length) {
    const { error: eventError } = await supabase
      .from("events")
      .upsert(eventRows, { onConflict: "season_id,week,event_type" });

    if (eventError) throw eventError;
  }

  const { data: dbEvents, error: dbEventsError } = await supabase
    .from("events")
    .select("id,week,event_type")
    .eq("season_id", season.id);

  if (dbEventsError) throw dbEventsError;

  const eventMap = new Map((dbEvents || []).map((e) => [eventKey(e.week, e.event_type), e.id]));

  const seasonRows = dedupeBy(
    seasonStatsPayload(parsed, season.id, playerMap),
    (row: any) => `${row.season_id}|${row.player_id}`
  );

  if (seasonRows.length) {
    const { error } = await supabase
      .from("season_stats")
      .upsert(seasonRows, { onConflict: "season_id,player_id" });
    if (error) throw error;
  }

  const resultRows = dedupeBy(
    resultPayload(parsed.weekly || [], eventMap, playerMap),
    (row: any) => `${row.event_id}|${row.player_id}`
  );

  if (resultRows.length) {
    const { error } = await supabase
      .from("event_results")
      .upsert(resultRows, { onConflict: "event_id,player_id" });
    if (error) throw error;
  }

  const statRows = dedupeEventStats(
    eventStatsPayload(parsed.eventStats || [], eventMap, playerMap)
  );

  if (statRows.length) {
    const { error } = await supabase
      .from("event_stats")
      .upsert(statRows, { onConflict: "event_id,player_id" });
    if (error) throw error;
  }

  const weekScoreRows = dedupeBy(
    weekScorePayload(parsed, season.id, playerMap),
    (row: any) => `${row.season_id}|${row.player_id}|${row.week_number}`
  );

  if (weekScoreRows.length) {
    const { error } = await supabase
      .from("season_week_scores")
      .upsert(weekScoreRows, { onConflict: "season_id,player_id,week_number" });
    if (error) throw error;
  }

  return {
    season: seasonName,
    players: playerRows.length,
    events: eventRows.length,
    seasonStats: seasonRows.length,
    eventResults: resultRows.length,
    eventStats: statRows.length,
    weekScores: weekScoreRows.length,
  };
}

export async function readLeagueDataFromSupabase(): Promise<LeagueData> {
  const supabase = getSupabaseAdmin();

  const { data: seasons, error: seasonsError } = await supabase
    .from("seasons")
    .select("id,name,season_year,season_order")
    .order("season_year", { ascending: true })
    .order("season_order", { ascending: true });

  if (seasonsError) throw seasonsError;

  const { data: players, error: playersError } = await supabase
    .from("players")
    .select("name,normalized_name")
    .order("name", { ascending: true });

  if (playersError) throw playersError;

  const seasonById = new Map((seasons || []).map((s) => [s.id, s.name]));

  const { data: seasonStats, error: seasonStatsError } = await supabase
    .from("season_stats")
    .select("*, seasons(name)");

  if (seasonStatsError) throw seasonStatsError;

  const stats = (seasonStats || [])
    .filter((row: any) => isValidPlayerName(row.player_name))
    .map((row: any) => ({
      Season: row.seasons?.name || seasonById.get(row.season_id) || "",
      Player: row.player_name,
      playerName: row.player_name,
      "Total Rounds": row.total_rounds,
      "Total Pts": row.total_points,
      "Average PPR": row.average_ppr,
      "Opponents Avg PPR": row.opponent_average_ppr,
      "Average DPR": row.average_dpr,
      "Opponents Pts": row.opponent_points,
      "Avg Bags In": row.avg_bags_in,
      "Total Bags In": row.total_bags_in,
      "Avg Bags In per Rd": row.avg_bags_in_per_round,
      "Bags On %": row.bags_on_percent,
      "Bags Off %": row.bags_off_percent,
      "Total Bags Thrown": row.total_bags_thrown,
      "Avg 4-Bagger %": row.avg_four_bagger_percent,
      "Total 4-Baggers": row.total_four_baggers,
      "1st in Stats": row.first_in_stats,
      "Avg Rounds/Swap Game": row.avg_rounds_per_swap_game,
      Finish: row.finish,
      "Standing Points": row.standing_points,
    }));

  const standings = (seasonStats || [])
    .filter((row: any) => isValidPlayerName(row.player_name))
    .map((row: any) => ({
      Season: row.seasons?.name || seasonById.get(row.season_id) || "",
      Player: row.player_name,
      Rank: row.finish,
      Overall: row.standing_points ?? row.total_points,
      Points: row.standing_points ?? row.total_points,
    }));

  const { data: results, error: resultsError } = await supabase
    .from("event_results")
    .select("*, events(week,event_type,seasons(name))");

  if (resultsError) throw resultsError;

  const weekly = (results || [])
    .filter((row: any) => isValidPlayerName(row.player_name))
    .map((row: any) => ({
      Season: row.events?.seasons?.name || "",
      Player: row.player_name,
      playerName: row.player_name,
      Week: row.events?.week || "",
      Type: row.events?.event_type || "",
      Rank: row.rank,
      Team: row.team,
      Points: row.finish_points,
      Wins: row.wins,
      Losses: row.losses,
      "+/-": row.plus_minus,
    }));

  const { data: eventStatRows, error: eventStatsError } = await supabase
    .from("event_stats")
    .select("*, events(week,event_type,seasons(name))");

  if (eventStatsError) throw eventStatsError;

  const eventStats = (eventStatRows || [])
    .filter((row: any) => isValidPlayerName(row.player_name))
    .map((row: any) => ({
      Season: row.events?.seasons?.name || "",
      Player: row.player_name,
      playerName: row.player_name,
      Week: row.events?.week || "",
      Type: row.events?.event_type || "",
      Rank: row.rank,
      PPR: row.ppr,
      Rounds: row.rounds,
      Points: row.points,
      OPPR: row.oppr,
      "Opp Pts": row.opponent_points,
      DPR: row.dpr,
      "4 Baggers": row.four_baggers,
    }));

  const { data: weekScoreRows, error: weekScoresError } = await supabase
    .from("season_week_scores")
    .select("*, seasons(name)");

  if (weekScoresError) throw weekScoresError;

  const weekScores = (weekScoreRows || [])
    .filter((row: any) => isValidPlayerName(row.player_name))
    .map((row: any) => ({
      Season: row.seasons?.name || seasonById.get(row.season_id) || "",
      Player: row.player_name,
      playerName: row.player_name,
      Week: row.week_label,
      weekNumber: row.week_number,
      Score: row.score,
    }));

  return {
    seasons: (seasons || []).map((season) => season.name),
    players: (players || [])
      .map((player) => player.name)
      .filter(isValidPlayerName),
    standings,
    weekly,
    eventStats,
    stats,
    weekScores,
    lastUpdated: new Date().toISOString(),
  } as LeagueData;
}
