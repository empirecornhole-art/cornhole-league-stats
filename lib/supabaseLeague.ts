import { getSupabaseAdmin } from "./supabaseAdmin";
import { LeagueData } from "./types";

type Row = Record<string, any>;

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

function normalizeName(name: string) {
  return compact(name);
}

function getValue(row: Row, keys: string[]) {
  for (const key of keys) {
    if (row?.[key] !== undefined && row?.[key] !== "") return row[key];
  }
  const wanted = keys.map(compact);
  const found = Object.keys(row || {}).find((key) => wanted.includes(compact(key)));
  return found ? row[found] : "";
}

function getPlayer(row: Row) {
  return clean(row.Player || row.playerName || row["Player Name"] || row["PLAYER NAME"] || row.Name || row.name);
}

function getWeek(row: Row) {
  return clean(getValue(row, ["Week", "WEEK", "Week "]));
}

function getType(row: Row) {
  const raw = clean(getValue(row, ["Type", "TYPE"]));
  const id = compact(raw);
  if (id.includes("blind")) return "Blind";
  if (id.includes("swap")) return "Swap";
  return raw;
}

function weekNumber(week: string) {
  const match = clean(week).match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function eventKey(week: any, type: any) {
  return `${clean(week)}|${getType({ Type: type })}`;
}

function dedupeBy<T>(rows: T[], getKey: (row: T) => string, scoreRow?: (row: T) => number) {
  const map = new Map<string, T>();
  const scores = new Map<string, number>();
  for (const row of rows) {
    const key = getKey(row);
    if (!key) continue;
    const score = scoreRow ? scoreRow(row) : 1;
    if (!map.has(key) || score >= (scores.get(key) || 0)) {
      map.set(key, row);
      scores.set(key, score);
    }
  }
  return Array.from(map.values());
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

function getStandingFor(parsed: LeagueData, playerName: string) {
  const target = normalizeName(playerName);
  return (parsed.standings || []).find((row) => normalizeName(getPlayer(row)) === target) || null;
}

function seasonStatsPayload(parsed: LeagueData, seasonId: string, playerMap: Map<string, string>) {
  return (parsed.stats || [])
    .map((row) => {
      const playerName = getPlayer(row);
      const playerId = playerMap.get(normalizeName(playerName));
      if (!validPlayerName(playerName) || !playerId) return null;
      const standing = getStandingFor(parsed, playerName);
      const standingPoints = num(getValue(row, ["standing_points", "Standing Points"])) ?? num(getValue(standing || {}, ["standing_points", "Overall", "Points"]));
      return {
        season_id: seasonId,
        player_id: playerId,
        player_name: playerName,
        finish: num(getValue(row, ["Finish"])) ?? num(getValue(standing || {}, ["Rank", "RANK", "Finish", "Place"])),
        standing_points: standingPoints,
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

function resultPayload(rows: Row[], eventMap: Map<string, string>, playerMap: Map<string, string>) {
  return rows
    .map((row) => {
      const playerName = getPlayer(row);
      const playerId = playerMap.get(normalizeName(playerName));
      const week = getWeek(row);
      const type = getType(row);
      const eventId = eventMap.get(eventKey(week, type));
      if (!validPlayerName(playerName) || !playerId || !eventId) return null;
      return {
        event_id: eventId,
        player_id: playerId,
        player_name: playerName,
        rank: num(getValue(row, ["Rank", "RANK", "Finish", "Place"])),
        team: clean(getValue(row, ["Team", "TEAM"])) || null,
        finish_points: num(getValue(row, ["Finish Pts", "Points", "POINTS", "Weekly Points"])),
        wins: num(getValue(row, ["Wins", "WINS"])),
        losses: num(getValue(row, ["Losses", "LOSSES"])),
        plus_minus: num(getValue(row, ["+/-", "+ / -", "Plus Minus"])),
        raw: row,
      };
    })
    .filter(Boolean);
}

function eventStatsPayload(rows: Row[], eventMap: Map<string, string>, playerMap: Map<string, string>) {
  return rows
    .map((row) => {
      const playerName = getPlayer(row);
      const playerId = playerMap.get(normalizeName(playerName));
      const week = getWeek(row);
      const type = getType(row);
      const eventId = eventMap.get(eventKey(week, type));
      if (!validPlayerName(playerName) || !playerId || !eventId) return null;
      return {
        event_id: eventId,
        player_id: playerId,
        player_name: playerName,
        rank: num(getValue(row, ["Rank", "RANK"])),
        ppr: num(getValue(row, ["PPR", "ptsPerRnd", "Average PPR"])),
        rounds: num(getValue(row, ["Rounds", "rounds", "Rds", "Total Rounds"])),
        points: num(getValue(row, ["Points", "totalPts", "Pts", "Total Pts", "Total Points"])),
        oppr: num(getValue(row, ["OPPR", "opponentPtsPerRnd", "Opp PPR", "Opponent PPR", "Opponents Avg PPR"])),
        opponent_points: num(getValue(row, ["Opp Pts", "opponentPts", "Opponent Points", "Opponents Pts"])),
        dpr: num(getValue(row, ["DPR", "diffPerRnd", "Average DPR"])),
        four_baggers: num(getValue(row, ["4 Baggers", "TotalFourBaggers", "Total 4-Baggers", "Four Baggers"])),
        raw: row,
      };
    })
    .filter(Boolean);
}

function statCompleteness(row: any) {
  return [row.ppr, row.rounds, row.points, row.oppr, row.opponent_points, row.dpr, row.four_baggers].filter((v) => v !== null && v !== undefined).length;
}

export async function importLeagueDataToSupabase(parsed: LeagueData) {
  const supabase = getSupabaseAdmin();
  const seasonName = parsed.seasons?.[0];
  if (!seasonName) throw new Error("Could not determine the season from the workbook filename.");
  const seasonMeta = parseSeasonName(seasonName);

  const { data: existingSeason, error: existingSeasonError } = await supabase.from("seasons").select("id").eq("name", seasonName).maybeSingle();
  if (existingSeasonError) throw existingSeasonError;
  if (existingSeason?.id) {
    const { error: deleteError } = await supabase.from("seasons").delete().eq("id", existingSeason.id);
    if (deleteError) throw deleteError;
  }

  const { data: season, error: seasonError } = await supabase
    .from("seasons")
    .insert({ name: seasonName, season_label: seasonMeta.label, season_year: seasonMeta.year, season_order: seasonMeta.order })
    .select("id")
    .single();
  if (seasonError) throw seasonError;

  const allNames = [
    ...(parsed.players || []),
    ...(parsed.standings || []).map(getPlayer),
    ...(parsed.weekly || []).map(getPlayer),
    ...(parsed.eventStats || []).map(getPlayer),
    ...(parsed.stats || []).map(getPlayer),
  ].filter(validPlayerName);
  const playerRows = dedupeBy(
    Array.from(new Set(allNames.map(clean))).map((name) => ({ name, normalized_name: normalizeName(name) })),
    (row) => row.normalized_name
  ).sort((a, b) => a.name.localeCompare(b.name));

  if (playerRows.length) {
    const { error } = await supabase.from("players").upsert(playerRows, { onConflict: "normalized_name" });
    if (error) throw error;
  }

  const { data: dbPlayers, error: dbPlayersError } = await supabase
    .from("players")
    .select("id,name,normalized_name")
    .in("normalized_name", playerRows.map((row) => row.normalized_name));
  if (dbPlayersError) throw dbPlayersError;
  const playerMap = new Map((dbPlayers || []).map((p) => [p.normalized_name, p.id]));

  const eventRows = dedupeBy(
    [...(parsed.weekly || []), ...(parsed.eventStats || [])]
      .map((row) => ({ week: getWeek(row), event_type: getType(row), week_number: weekNumber(getWeek(row)) }))
      .filter((row) => row.week && row.event_type)
      .map((row) => ({ ...row, season_id: season.id })),
    (row) => `${row.season_id}|${row.week}|${row.event_type}`
  );

  if (eventRows.length) {
    const { error } = await supabase.from("events").upsert(eventRows, { onConflict: "season_id,week,event_type" });
    if (error) throw error;
  }

  const { data: dbEvents, error: dbEventsError } = await supabase.from("events").select("id,week,event_type").eq("season_id", season.id);
  if (dbEventsError) throw dbEventsError;
  const eventMap = new Map((dbEvents || []).map((e) => [eventKey(e.week, e.event_type), e.id]));

  const seasonRows = dedupeBy(seasonStatsPayload(parsed, season.id, playerMap), (row: any) => `${row.season_id}|${row.player_id}`);
  if (seasonRows.length) {
    const { error } = await supabase.from("season_stats").upsert(seasonRows, { onConflict: "season_id,player_id" });
    if (error) throw error;
  }

  const resultRows = dedupeBy(resultPayload(parsed.weekly || [], eventMap, playerMap), (row: any) => `${row.event_id}|${row.player_id}`);
  if (resultRows.length) {
    const { error } = await supabase.from("event_results").upsert(resultRows, { onConflict: "event_id,player_id" });
    if (error) throw error;
  }

  const statRows = dedupeBy(eventStatsPayload(parsed.eventStats || [], eventMap, playerMap), (row: any) => `${row.event_id}|${row.player_id}`, statCompleteness);
  if (statRows.length) {
    const { error } = await supabase.from("event_stats").upsert(statRows, { onConflict: "event_id,player_id" });
    if (error) throw error;
  }

  const weekScoreRows = dedupeBy(
    (parsed.seasonWeekScores || [])
      .map((row) => {
        const playerName = getPlayer(row);
        const playerId = playerMap.get(normalizeName(playerName));
        if (!validPlayerName(playerName) || !playerId) return null;
        return {
          season_id: season.id,
          player_id: playerId,
          player_name: playerName,
          week_number: num(getValue(row, ["week_number"])) || weekNumber(getWeek(row)),
          week_label: getWeek(row),
          score: num(getValue(row, ["score", "Score", "Points"])),
          raw: row,
        };
      })
      .filter(Boolean) as any[],
    (row: any) => `${row.season_id}|${row.player_id}|${row.week_number}`
  );
  if (weekScoreRows.length) {
    const { error } = await supabase.from("season_week_scores").upsert(weekScoreRows, { onConflict: "season_id,player_id,week_number" });
    if (error) throw error;
  }

  return {
    season: seasonName,
    players: playerRows.length,
    events: eventRows.length,
    seasonStats: seasonRows.length,
    eventResults: resultRows.length,
    eventStats: statRows.length,
    seasonWeekScores: weekScoreRows.length,
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
  const seasonById = new Map((seasons || []).map((s) => [s.id, s.name]));

  const { data: players, error: playersError } = await supabase.from("players").select("name,normalized_name").order("name", { ascending: true });
  if (playersError) throw playersError;

  const { data: seasonStats, error: seasonStatsError } = await supabase.from("season_stats").select("*, seasons(name)");
  if (seasonStatsError) throw seasonStatsError;

  const stats = (seasonStats || []).map((row: any) => ({
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
    standing_points: row.standing_points,
  }));

  const standings = (seasonStats || [])
    .filter((row: any) => validPlayerName(row.player_name))
    .map((row: any) => ({
      Season: row.seasons?.name || seasonById.get(row.season_id) || "",
      Player: row.player_name,
      Rank: row.finish,
      Overall: row.standing_points ?? row.total_points,
      Points: row.standing_points ?? row.total_points,
      standing_points: row.standing_points,
    }));

  const { data: results, error: resultsError } = await supabase
    .from("event_results")
    .select("*, events(week,event_type,seasons(name))");
  if (resultsError) throw resultsError;

  const { data: eventStatRows, error: eventStatsError } = await supabase
    .from("event_stats")
    .select("*, events(week,event_type,seasons(name))");
  if (eventStatsError) throw eventStatsError;

  const eventStats = (eventStatRows || []).map((row: any) => ({
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

  const statLookup = new Map(eventStats.map((row: any) => [`${row.Season}|${row.Week}|${row.Type}|${normalizeName(row.Player)}`, row]));
  const weekly = (results || []).map((row: any) => {
    const seasonName = row.events?.seasons?.name || "";
    const week = row.events?.week || "";
    const type = row.events?.event_type || "";
    const stat = statLookup.get(`${seasonName}|${week}|${type}|${normalizeName(row.player_name)}`) || {};
    return {
      Season: seasonName,
      Player: row.player_name,
      playerName: row.player_name,
      Week: week,
      Type: type,
      Rank: row.rank,
      Team: row.team,
      Points: row.finish_points,
      "Finish Pts": row.finish_points,
      Wins: row.wins,
      Losses: row.losses,
      "+/-": row.plus_minus,
      PPR: stat.PPR,
      Rounds: stat.Rounds,
      OPPR: stat.OPPR,
      "Opp Pts": stat["Opp Pts"],
      DPR: stat.DPR,
      "4 Baggers": stat["4 Baggers"],
      EventPoints: stat.Points,
    };
  });

  let seasonWeekScores: any[] = [];
  const { data: weekScores } = await supabase
    .from("season_week_scores")
    .select("*, seasons(name)");
  seasonWeekScores = (weekScores || []).map((row: any) => ({
    Season: row.seasons?.name || seasonById.get(row.season_id) || "",
    Player: row.player_name,
    playerName: row.player_name,
    Week: row.week_label,
    week_number: row.week_number,
    score: row.score,
  }));

  return {
    seasons: (seasons || []).map((season) => season.name),
    players: (players || []).map((player) => player.name).filter(validPlayerName),
    standings,
    weekly,
    eventStats,
    stats,
    seasonWeekScores,
    lastUpdated: new Date().toISOString(),
  };
}
