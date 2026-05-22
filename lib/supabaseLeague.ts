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
  const id = normalizeName(name);

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

function getValue(row: Record<string, any> | null | undefined, keys: string[]) {
  if (!row) return "";

  for (const key of keys) {
    if (row?.[key] !== undefined && row?.[key] !== "" && row?.[key] !== null) return row[key];
  }

  const wanted = keys.map(compact);
  const found = Object.keys(row || {}).find((key) => wanted.includes(compact(key)));
  return found ? row[found] : "";
}

function firstNumber(...values: any[]) {
  for (const value of values) {
    const parsed = num(value);
    if (parsed !== null) return parsed;
  }
  return null;
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
  const direct = clean(
    row.Player ||
      row.playerName ||
      row["Player Name"] ||
      row["PLAYER NAME"] ||
      row.Name ||
      row.name
  );

  if (direct) return direct;

  const first = clean(row.playerFirstName || row.First || row["First Name"]);
  const last = clean(row.playerLastName || row.Last || row["Last Name"]);
  return [first, last].filter(Boolean).join(" ").trim();
}

function eventKey(week: any, type: any) {
  return `${clean(week)}|${clean(type)}`;
}

function playerEventKey(row: Record<string, any>) {
  return `${clean(row.Week)}|${clean(row.Type)}|${normalizeName(getPlayer(row))}`;
}

function dedupeBy<T>(rows: T[], getKey: (row: T) => string, prefer?: (existing: T, next: T) => T) {
  const map = new Map<string, T>();

  for (const row of rows) {
    const key = getKey(row);
    if (!key) continue;
    const existing = map.get(key);
    map.set(key, existing && prefer ? prefer(existing, row) : row);
  }

  return Array.from(map.values());
}

function completeness(row: any) {
  return ["PPR", "Rounds", "Points", "OPPR", "Opp Pts", "DPR", "4 Baggers"].reduce(
    (total, key) => total + (getValue(row, [key]) !== "" ? 1 : 0),
    0
  );
}

function findStandingForPlayer(parsed: LeagueData, playerName: string) {
  const target = normalizeName(playerName);
  return (parsed.standings || []).find((row) => normalizeName(getPlayer(row)) === target) || null;
}

function statMetricFromRaw(raw: Record<string, any> | null | undefined, metric: string) {
  if (!raw) return null;

  switch (metric) {
    case "ppr":
      return num(getValue(raw, ["PPR", "ptsPerRnd", "Points Per Round", "Average PPR"]));
    case "rounds":
      return num(getValue(raw, ["Rounds", "Rds", "rounds", "Total Rounds"]));
    case "points":
      return num(getValue(raw, ["Points", "Pts", "totalPts", "Total Pts", "Total Points"]));
    case "oppr":
      return num(getValue(raw, ["OPPR", "opponentPtsPerRnd", "Opponent PPR", "Opp PPR", "Opponents Avg PPR"]));
    case "oppPoints":
      return num(getValue(raw, ["Opp Pts", "opponentPts", "Opponent Points", "Opponents Pts"]));
    case "dpr":
      return num(getValue(raw, ["DPR", "diffPerRnd", "Average DPR"]));
    case "fourBaggers":
      return num(getValue(raw, ["4 Baggers", "TotalFourBaggers", "Total 4-Baggers", "Total 4 Baggers", "Four Baggers"]));
    default:
      return null;
  }
}

function seasonStatsPayload(parsed: LeagueData, seasonId: string, playerMap: Map<string, string>) {
  return (parsed.stats || [])
    .map((row) => {
      const playerName = getPlayer(row);
      const playerId = playerMap.get(normalizeName(playerName));

      if (!playerName || !playerId) return null;

      const standing = findStandingForPlayer(parsed, playerName);
      const standingPoints = num(getValue(standing || {}, ["Overall", "Standing Points", "League Points", "Season Points"]));

      return {
        season_id: seasonId,
        player_id: playerId,
        player_name: playerName,
        finish: num(getValue(standing || {}, ["Rank", "RANK", "Finish", "Place"])),
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

function resultPayload(
  rows: Record<string, any>[],
  eventMap: Map<string, string>,
  playerMap: Map<string, string>,
  statMap: Map<string, any>
) {
  return rows
    .map((row) => {
      const playerName = getPlayer(row);
      const playerId = playerMap.get(normalizeName(playerName));
      const eventId = eventMap.get(eventKey(row.Week, row.Type));

      if (!playerName || !playerId || !eventId) return null;

      const matchingStat = statMap.get(playerEventKey(row)) || null;

      return {
        event_id: eventId,
        player_id: playerId,
        player_name: playerName,
        rank: num(getValue(row, ["Rank", "RANK", "Finish", "Place"])),
        team: clean(getValue(row, ["Team", "TEAM"])) || null,
        finish_points: num(getValue(row, ["FinishPts", "Finish Pts", "Points", "POINTS", "Weekly Points"])),
        wins: num(getValue(row, ["Wins", "WINS"])),
        losses: num(getValue(row, ["Losses", "LOSSES"])),
        plus_minus: num(getValue(row, ["+/-", "+ / -", "Plus Minus"])),
        raw: { ...row, __eventStat: matchingStat },
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

      if (!playerName || !playerId || !eventId) return null;

      return {
        event_id: eventId,
        player_id: playerId,
        player_name: playerName,
        rank: num(getValue(row, ["Rank", "RANK", "ranking"])),
        ppr: statMetricFromRaw(row, "ppr"),
        rounds: statMetricFromRaw(row, "rounds"),
        points: statMetricFromRaw(row, "points"),
        oppr: statMetricFromRaw(row, "oppr"),
        opponent_points: statMetricFromRaw(row, "oppPoints"),
        dpr: statMetricFromRaw(row, "dpr"),
        four_baggers: statMetricFromRaw(row, "fourBaggers"),
        raw: row,
      };
    })
    .filter(Boolean);
}

function weekScorePayload(parsed: LeagueData, seasonId: string, playerMap: Map<string, string>) {
  const rows: any[] = [];

  for (const standing of parsed.standings || []) {
    const playerName = getPlayer(standing);
    const playerId = playerMap.get(normalizeName(playerName));

    if (!playerName || !playerId) continue;

    for (const key of Object.keys(standing || {})) {
      const match = clean(key).match(/^week\s*(\d+)$/i);
      if (!match) continue;

      const weekNum = Number(match[1]);
      const score = num(standing[key]);

      if (!weekNum || score === null) continue;

      rows.push({
        season_id: seasonId,
        player_id: playerId,
        player_name: playerName,
        week_number: weekNum,
        week_label: `Week ${weekNum}`,
        score,
        raw: { sourceColumn: key, value: standing[key] },
      });
    }
  }

  return rows;
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
    const { error: deleteError } = await supabase.from("seasons").delete().eq("id", existingSeason.id);
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

  const playerNameMap = new Map<string, string>();

  for (const rawName of parsed.players || []) {
    const name = clean(rawName);
    if (!isValidPlayerName(name)) continue;

    const normalized = normalizeName(name);
    const existing = playerNameMap.get(normalized);

    if (!existing || (name !== name.toLowerCase() && existing === existing.toLowerCase())) {
      playerNameMap.set(normalized, name);
    }
  }

  const playerRows = Array.from(playerNameMap.entries())
    .map(([normalized_name, name]) => ({ name, normalized_name }))
    .sort((a, b) => a.name.localeCompare(b.name));

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

  const eventStatSourceRows = dedupeBy(
    parsed.eventStats || [],
    (row: any) => playerEventKey(row),
    (existing: any, next: any) => (completeness(next) >= completeness(existing) ? next : existing)
  );

  const statSourceMap = new Map(eventStatSourceRows.map((row: any) => [playerEventKey(row), row]));

  const resultRows = dedupeBy(
    resultPayload(parsed.weekly || [], eventMap, playerMap, statSourceMap),
    (row: any) => `${row.event_id}|${row.player_id}`
  );

  if (resultRows.length) {
    const { error } = await supabase
      .from("event_results")
      .upsert(resultRows, { onConflict: "event_id,player_id" });
    if (error) throw error;
  }

  const statRows = dedupeBy(
    eventStatsPayload(eventStatSourceRows, eventMap, playerMap),
    (row: any) => `${row.event_id}|${row.player_id}`
  );

  if (statRows.length) {
    const { error } = await supabase
      .from("event_stats")
      .upsert(statRows, { onConflict: "event_id,player_id" });
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

function statObjectFromDbRow(row: any) {
  const raw = row?.raw || {};
  return {
    Rank: firstNumber(row?.rank, getValue(raw, ["Rank", "ranking"])),
    PPR: firstNumber(row?.ppr, statMetricFromRaw(raw, "ppr")),
    Rounds: firstNumber(row?.rounds, statMetricFromRaw(raw, "rounds")),
    Points: firstNumber(row?.points, statMetricFromRaw(raw, "points")),
    OPPR: firstNumber(row?.oppr, statMetricFromRaw(raw, "oppr")),
    "Opp Pts": firstNumber(row?.opponent_points, statMetricFromRaw(raw, "oppPoints")),
    DPR: firstNumber(row?.dpr, statMetricFromRaw(raw, "dpr")),
    "4 Baggers": firstNumber(row?.four_baggers, statMetricFromRaw(raw, "fourBaggers")),
  };
}

function statObjectFromRaw(raw: any) {
  return {
    Rank: firstNumber(getValue(raw, ["Rank", "ranking"])),
    PPR: statMetricFromRaw(raw, "ppr"),
    Rounds: statMetricFromRaw(raw, "rounds"),
    Points: statMetricFromRaw(raw, "points"),
    OPPR: statMetricFromRaw(raw, "oppr"),
    "Opp Pts": statMetricFromRaw(raw, "oppPoints"),
    DPR: statMetricFromRaw(raw, "dpr"),
    "4 Baggers": statMetricFromRaw(raw, "fourBaggers"),
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
    .select("name")
    .order("name", { ascending: true });

  if (playersError) throw playersError;

  const seasonById = new Map((seasons || []).map((s) => [s.id, s.name]));

  const { data: seasonStats, error: seasonStatsError } = await supabase
    .from("season_stats")
    .select("*, seasons(name)");

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
  }));

  const standings = (seasonStats || []).map((row: any) => ({
    Season: row.seasons?.name || seasonById.get(row.season_id) || "",
    Player: row.player_name,
    Rank: row.finish,
    Overall: row.standing_points ?? row.total_points,
    Points: row.standing_points ?? row.total_points,
  }));

  const { data: eventStatRows, error: eventStatsError } = await supabase
    .from("event_stats")
    .select("*, events(id,week,event_type,seasons(name))");

  if (eventStatsError) throw eventStatsError;

  const eventStats = dedupeBy(
    (eventStatRows || []).map((row: any) => {
      const stat = statObjectFromDbRow(row);
      return {
        Season: row.events?.seasons?.name || "",
        Player: row.player_name,
        playerName: row.player_name,
        Week: row.events?.week || "",
        Type: row.events?.event_type || "",
        ...stat,
      };
    }),
    (row: any) => `${row.Season}|${row.Week}|${row.Type}|${normalizeName(row.Player)}`
  );

  const eventStatsById = new Map(
    (eventStatRows || []).map((row: any) => [`${row.event_id}|${row.player_id}`, statObjectFromDbRow(row)])
  );

  const { data: results, error: resultsError } = await supabase
    .from("event_results")
    .select("*, events(id,week,event_type,seasons(name))");

  if (resultsError) throw resultsError;

  const weekly = (results || []).map((row: any) => {
    const raw = row.raw || {};
    const stat = eventStatsById.get(`${row.event_id}|${row.player_id}`) || statObjectFromRaw(raw.__eventStat || {});

    return {
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
      PPR: stat.PPR ?? null,
      Rounds: stat.Rounds ?? null,
      StatPoints: stat.Points ?? null,
      OPPR: stat.OPPR ?? null,
      "Opp Pts": stat["Opp Pts"] ?? null,
      DPR: stat.DPR ?? null,
      "4 Baggers": stat["4 Baggers"] ?? null,
    };
  });

  const { data: weekScoreRows, error: weekScoreError } = await supabase
    .from("season_week_scores")
    .select("*, seasons(name)");

  if (weekScoreError) throw weekScoreError;

  const weekScores = (weekScoreRows || []).map((row: any) => ({
    Season: row.seasons?.name || seasonById.get(row.season_id) || "",
    Player: row.player_name,
    playerName: row.player_name,
    Week: row.week_label || `Week ${row.week_number}`,
    WeekNumber: row.week_number,
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
  };
}
