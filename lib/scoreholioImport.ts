import * as XLSX from "xlsx";
import { getSupabaseAdmin } from "./supabaseAdmin";

/**
 * Weekly Scoreholio results import (Fall '26 onward).
 *
 * Each week the admin uploads Scoreholio exports:
 *   Switch:      "ScoreMagic" stats  +  "RoundRobin-Standings"  (+ optional match log)
 *   Blind Draw:  "ScoreMagic" stats  +  "Bracket-Standings"     (+ optional match log)
 * File names carry no week/event info, so everything is read from the files:
 * the ScoreMagic "Game Name" column gives the week and event type ("... Week 1"
 * is the Switch, "... Week 1 Blind" the Blind Draw), and each standings file is
 * paired to its ScoreMagic file by the players in it.
 *
 * League scoring:
 *   - Switch: weekly league score = the player's round-robin "Points For".
 *   - Blind Draw: the top 3 bracket places earn 3 / 2 / 1 bonus points, and
 *     BOTH teammates on a placing team get it. Tied places share the bonus.
 *     The bonus is added to that week's Switch score; a player who only played
 *     the Blind Draw still gets it as their weekly score.
 *   - Season total: best 9 weekly scores. Ties: highest single week, then
 *     season PPR (same rule the Scenarios tab uses).
 *
 * Writes into the same tables the legacy workbook import fills, but one week
 * at a time. The Switch is stored with event_type "Swap" so the existing site
 * filters keep working; the UI labels it "Switch". Seasons imported from the
 * legacy workbook are never touched.
 */

export const BEST_WEEKS_COUNT = 9;
export const BLIND_DRAW_BONUS = [3, 2, 1];
const SOURCE = "scoreholio";

type EventType = "Swap" | "Blind";

type PlayerRec = {
  name: string; // "First Last" -- the site's player identity
  display: string;
  email: string;
  rounds: number;
  pts: number;
  oppPts: number;
  ppr: number | null;
  oppr: number | null;
  dpr: number | null;
  fourBaggers: number;
  bagsIn: number;
  bagsOn: number;
  bagsOff: number;
  statsRank?: number; // 1 = top of that event's stats (highest PPR)
  // Switch standings
  pointsFor?: number;
  wins?: number;
  losses?: number;
  ties?: number;
  position?: number;
  // Blind Draw bracket
  team?: string;
  place?: number;
  bonus?: number;
};

export type GameRec = {
  order: number;
  team1: string; // real names, sorted, joined " / "
  team2: string;
  score1: number;
  score2: number;
  playedAt: string | null;
  playSeconds: number | null;
};

export type ParsedEvent = {
  week: number;
  type: EventType;
  gameName: string;
  players: PlayerRec[];
  games: GameRec[];
  warnings: string[];
};

export type ScoreholioImportResult = {
  season: string;
  events: { week: number; type: EventType; players: number; games: number }[];
  weeksInSeason: number[];
  players: number;
  warnings: string[];
};

function clean(v: any) {
  return String(v ?? "").trim();
}

function normalizeName(name: string) {
  return clean(name).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function norm(v: any) {
  return clean(v).toLowerCase();
}

function num(v: any): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function n0(v: any) {
  return num(v) ?? 0;
}

const seasonOrder: Record<string, number> = { spring: 1, summer: 2, fall: 3, winter: 4 };

/** "fall '26", "Fall 2026", "fall26" -> "Fall 26" */
export function normalizeSeasonName(input: string): string {
  const s = clean(input).toLowerCase();
  const word = Object.keys(seasonOrder).find((w) => s.includes(w));
  const year = s.match(/(\d{2,4})/);
  if (!word || !year) throw new Error(`Season "${input}" isn't recognized. Use something like "Fall 26".`);
  return `${word[0].toUpperCase()}${word.slice(1)} ${year[1].slice(-2)}`;
}

type Table = { fileName: string; headers: string[]; rows: Record<string, any>[] };
type Kind = "scoremagic" | "roundrobin" | "bracket" | "matchlog";

function readTable(buffer: ArrayBuffer, fileName: string): Table {
  const wb = XLSX.read(buffer, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = (sheet ? XLSX.utils.sheet_to_json(sheet, { defval: "" }) : []) as Record<string, any>[];
  return { fileName, headers: rows.length ? Object.keys(rows[0]) : [], rows };
}

function classify(t: Table): Kind {
  const h = new Set(t.headers.map(norm));
  if (h.has("display name") && h.has("total points")) return "scoremagic";
  if (h.has("position") && h.has("points for")) return "roundrobin";
  if (h.has("place") && h.has("playername1")) return "bracket";
  if (h.has("team 1") && h.has("team 2") && h.has("score 2")) return "matchlog";
  throw new Error(
    `${t.fileName}: not a recognized Scoreholio export. Expected ScoreMagic, RoundRobin-Standings, Bracket-Standings, or a Match Log.`
  );
}

/** Reads and pairs one upload's worth of files into per-week events. */
export function parseScoreholioUpload(files: { name: string; buffer: ArrayBuffer }[]): ParsedEvent[] {
  const tables = files.map((f) => readTable(f.buffer, f.name));
  const byKind: Record<Kind, Table[]> = { scoremagic: [], roundrobin: [], bracket: [], matchlog: [] };
  for (const t of tables) byKind[classify(t)].push(t);

  if (!byKind.scoremagic.length) throw new Error("Upload at least one ScoreMagic file (it carries the week and the player stats).");

  const used = new Set<Table>();
  const events: ParsedEvent[] = [];

  for (const sm of byKind.scoremagic) {
    const gameName = clean(sm.rows[0]?.["Game Name"]);
    const weekMatch = gameName.match(/week\s*#?\s*(\d+)/i);
    if (!weekMatch) throw new Error(`${sm.fileName}: couldn't find "Week N" in its Game Name ("${gameName}").`);
    const week = Number(weekMatch[1]);
    const type: EventType = /blind/i.test(gameName) ? "Blind" : "Swap";

    const players: PlayerRec[] = [];
    for (const r of sm.rows) {
      const name = `${clean(r["First Name"])} ${clean(r["Last Name"])}`.trim();
      if (!name) continue;
      players.push({
        name,
        display: clean(r["Display Name"]),
        email: norm(r["Email"]),
        rounds: n0(r["Rounds"]),
        pts: n0(r["Total Points"]),
        oppPts: n0(r["Opp Points"]),
        ppr: num(r["PPR"]),
        oppr: num(r["OPP PPR"]),
        dpr: num(r["DPR"]),
        fourBaggers: n0(r["4IN"]),
        bagsIn: n0(r["IN"]),
        bagsOn: n0(r["ON"]),
        bagsOff: n0(r["OFF"]),
      });
    }
    if (!players.length) throw new Error(`${sm.fileName}: no player rows found.`);
    // "1st in Stats": the top PPR on this import (file order breaks exact ties).
    [...players]
      .map((p, i) => ({ p, i }))
      .sort((a, b) => (b.p.ppr ?? -Infinity) - (a.p.ppr ?? -Infinity) || a.i - b.i)
      .forEach(({ p }, idx) => (p.statsRank = idx + 1));

    const ev: ParsedEvent = { week, type, gameName, players, games: [], warnings: [] };
    const label = `Week ${week} ${type === "Blind" ? "Blind Draw" : "Switch"}`;
    const bracketTeams = new Set<string>();

    if (type === "Swap") {
      // Pair with the round-robin file whose team names are these players' display names.
      const displays = new Set(players.map((p) => norm(p.display)));
      const rr = pickBest(byKind.roundrobin, used, (t) => t.rows.filter((r) => displays.has(norm(r["Team Name"]))).length);
      if (!rr) throw new Error(`${label}: no RoundRobin-Standings file matches ${sm.fileName}. Upload both Switch files.`);
      used.add(rr);

      const byDisplay = new Map(players.map((p) => [norm(p.display), p]));
      for (const r of rr.rows) {
        const p = byDisplay.get(norm(r["Team Name"]));
        if (!p) {
          ev.warnings.push(`${label}: "${clean(r["Team Name"])}" is in the standings but not in the stats file; skipped.`);
          continue;
        }
        p.position = n0(r["Position"]);
        p.pointsFor = n0(r["Points For"]);
        p.wins = n0(r["Wins"]);
        p.losses = n0(r["Losses"]);
        p.ties = n0(r["Ties"]);
      }
      for (const p of players) {
        if (p.pointsFor === undefined) ev.warnings.push(`${label}: ${p.name} has stats but no standings row; no Switch score recorded.`);
      }
    } else {
      const emails = new Set(players.map((p) => p.email).filter(Boolean));
      const br = pickBest(byKind.bracket, used, (t) =>
        t.rows.reduce((n, r) => n + [r["PlayerEmail1"], r["PlayerEmail2"]].filter((e) => emails.has(norm(e))).length, 0)
      );
      if (!br) {
        ev.warnings.push(`${label}: no Bracket-Standings file found, so no bonus points were awarded.`);
      } else {
        used.add(br);
        for (const r of br.rows) bracketTeams.add(norm(r["Team Name"]));
        const byEmail = new Map(players.filter((p) => p.email).map((p) => [p.email, p]));
        const byDisplay = new Map(players.map((p) => [norm(p.display), p]));
        for (const r of br.rows) {
          const place = n0(r["Place"]);
          const bonus = place >= 1 && place <= BLIND_DRAW_BONUS.length ? BLIND_DRAW_BONUS[place - 1] : 0;
          for (const i of [1, 2, 3, 4]) {
            const display = clean(r[`PlayerName${i}`]);
            if (!display) continue;
            const p = byEmail.get(norm(r[`PlayerEmail${i}`])) || byDisplay.get(norm(display));
            if (!p) {
              ev.warnings.push(`${label}: bracket player "${display}" isn't in the stats file; skipped.`);
              continue;
            }
            p.place = place;
            p.team = clean(r["Team Name"]);
            p.bonus = bonus;
          }
        }
      }
    }
    ev.games = pairMatchLog(sm, type, players, bracketTeams, byKind.matchlog, used, ev.warnings, label);
    events.push(ev);
  }

  const leftovers = [...byKind.roundrobin, ...byKind.bracket, ...byKind.matchlog].filter((t) => !used.has(t));
  for (const t of leftovers) {
    events[0].warnings.push(`${t.fileName} didn't match any ScoreMagic file and was ignored.`);
  }

  return events.sort((a, b) => a.week - b.week || a.type.localeCompare(b.type) * -1);
}

function fileId(name: string) {
  const m = name.match(/([A-Za-z0-9]{20})(?:\s*\(\d+\))?\.\w+$/);
  return m ? m[1] : "";
}

function splitTeam(team: string) {
  return clean(team)
    .split(/\s+\/\s+|\s+&\s+/)
    .map((n) => n.trim())
    .filter(Boolean);
}

/**
 * Finds this event's match log. Both events have the same players, so the
 * match log is told apart by its shape: Blind Draw teams are the fixed
 * "A / B" teams from the bracket file, while Switch pairings use "A & B".
 * The id in the file name (shared with the ScoreMagic file) wins if present.
 */
function pairMatchLog(
  sm: Table,
  type: EventType,
  players: PlayerRec[],
  bracketTeams: Set<string>,
  logs: Table[],
  used: Set<Table>,
  warnings: string[],
  label: string
): GameRec[] {
  const smId = fileId(sm.fileName);
  const score = (t: Table) => {
    if (smId && fileId(t.fileName) === smId) return 1_000_000;
    let amp = 0;
    let slash = 0;
    let bracketHits = 0;
    for (const r of t.rows) {
      for (const k of ["Team 1", "Team 2"]) {
        const team = clean(r[k]);
        if (/\s&\s/.test(team)) amp++;
        if (/\s\/\s/.test(team)) slash++;
        if (bracketTeams.has(norm(team))) bracketHits++;
      }
    }
    return type === "Blind" ? bracketHits * 10 + slash : amp;
  };
  const log = pickBest(logs, used, score);
  if (!log) return [];
  used.add(log);

  const realByDisplay = new Map(players.map((p) => [norm(p.display), p.name]));
  const unknown = new Set<string>();
  const realTeam = (team: string) =>
    splitTeam(team)
      .map((d) => {
        const real = realByDisplay.get(norm(d));
        if (!real) unknown.add(d);
        return real || d;
      })
      .sort()
      .join(" / ");

  const games = log.rows
    .map((r) => ({
      order: n0(r["#"]),
      team1: realTeam(r["Team 1"]),
      team2: realTeam(r["Team 2"]),
      score1: n0(r["Score"]),
      score2: n0(r["Score 2"]),
      playedAt: clean(r["Date/Time"]) || null,
      playSeconds: num(r["Play Duration"]),
    }))
    .sort((a, b) => a.order - b.order);

  if (unknown.size) warnings.push(`${label}: match log names not found in the stats file: ${Array.from(unknown).join(", ")}.`);
  return games;
}

function pickBest(candidates: Table[], used: Set<Table>, score: (t: Table) => number): Table | null {
  let best: Table | null = null;
  let bestScore = 0;
  for (const t of candidates) {
    if (used.has(t)) continue;
    const s = score(t);
    if (s > bestScore) {
      best = t;
      bestScore = s;
    }
  }
  return best;
}

export async function importScoreholioWeeks(seasonInput: string, events: ParsedEvent[]): Promise<ScoreholioImportResult> {
  const supabase = getSupabaseAdmin();
  const seasonName = normalizeSeasonName(seasonInput);
  const warnings: string[] = events.flatMap((e) => e.warnings);

  // Find or create the season, refusing to touch one the legacy workbook built.
  let { data: season, error: seasonErr } = await supabase.from("seasons").select("id").eq("name", seasonName).maybeSingle();
  if (seasonErr) throw seasonErr;

  if (season?.id) {
    const { data: existing, error } = await supabase.from("season_stats").select("raw").eq("season_id", season.id).limit(1);
    if (error) throw error;
    if (existing?.length && existing[0].raw?.source !== SOURCE) {
      throw new Error(`${seasonName} was imported from the old workbook and is locked. Weekly imports only work on new seasons.`);
    }
  } else {
    const word = seasonName.split(" ")[0].toLowerCase();
    const { data, error } = await supabase
      .from("seasons")
      .insert({
        name: seasonName,
        season_label: seasonName.split(" ")[0],
        season_year: Number(seasonName.split(" ")[1]),
        season_order: seasonOrder[word],
      })
      .select("id")
      .single();
    if (error) throw error;
    season = data;
  }
  const seasonId = season!.id as string;

  // Players
  const names = new Map<string, string>();
  for (const e of events) for (const p of e.players) names.set(normalizeName(p.name), p.name);
  const { error: playerErr } = await supabase
    .from("players")
    .upsert(Array.from(names, ([normalized_name, name]) => ({ name, normalized_name })), { onConflict: "normalized_name" });
  if (playerErr) throw playerErr;
  const { data: dbPlayers, error: dbPlayersErr } = await supabase
    .from("players")
    .select("id,normalized_name")
    .in("normalized_name", Array.from(names.keys()));
  if (dbPlayersErr) throw dbPlayersErr;
  const playerId = new Map((dbPlayers || []).map((p) => [p.normalized_name as string, p.id as string]));

  // Replace each uploaded (week, type) wholesale so re-uploads correct mistakes.
  const seen = new Set<string>();
  for (const e of events) {
    const key = `${e.week}|${e.type}`;
    if (seen.has(key)) warnings.push(`Two files for Week ${e.week} ${e.type === "Blind" ? "Blind Draw" : "Switch"}; the later one was used.`);
    seen.add(key);

    const { data: ev, error: evErr } = await supabase
      .from("events")
      .upsert(
        { season_id: seasonId, week: `Week ${e.week}`, week_number: e.week, event_type: e.type },
        { onConflict: "season_id,week,event_type" }
      )
      .select("id")
      .single();
    if (evErr) throw evErr;
    const eventId = ev.id as string;

    for (const table of ["event_results", "event_stats"]) {
      const { error } = await supabase.from(table).delete().eq("event_id", eventId);
      if (error) throw error;
    }

    const resultRows = e.players.map((p) => ({
      event_id: eventId,
      player_id: playerId.get(normalizeName(p.name)),
      player_name: p.name,
      rank: e.type === "Swap" ? p.position ?? null : p.place ?? null,
      team: e.type === "Blind" ? p.team ?? null : null,
      // League points this event contributes: Switch = Points For, Blind Draw = bonus.
      finish_points: e.type === "Swap" ? p.pointsFor ?? 0 : p.bonus ?? 0,
      wins: p.wins ?? null,
      losses: p.losses ?? null,
      raw: { source: SOURCE, ties: p.ties ?? 0 },
    }));
    const statRows = e.players.map((p) => ({
      event_id: eventId,
      player_id: playerId.get(normalizeName(p.name)),
      player_name: p.name,
      rank: e.type === "Swap" ? p.position ?? null : p.place ?? null,
      ppr: p.ppr,
      rounds: p.rounds,
      points: p.pts,
      oppr: p.oppr,
      opponent_points: p.oppPts,
      dpr: p.dpr,
      four_baggers: p.fourBaggers,
      raw: { source: SOURCE, bagsIn: p.bagsIn, bagsOn: p.bagsOn, bagsOff: p.bagsOff, statsRank: p.statsRank },
    }));

    // Match log (optional). Skipped quietly if the table hasn't been created yet.
    await supabase.from("event_games").delete().eq("event_id", eventId).then(() => undefined);
    if (e.games.length) {
      const { error: gErr } = await supabase.from("event_games").insert(
        e.games.map((g) => ({
          event_id: eventId,
          game_order: g.order,
          team1: g.team1,
          team2: g.team2,
          score1: g.score1,
          score2: g.score2,
          played_at: g.playedAt,
          play_seconds: g.playSeconds,
        }))
      );
      if (gErr) {
        const missing = /event_games|schema cache|does not exist/i.test(gErr.message || "");
        if (!missing) throw gErr;
        warnings.push(
          `Week ${e.week} ${e.type === "Blind" ? "Blind Draw" : "Switch"}: the match log wasn't saved because the recap database tables haven't been created yet.`
        );
      }
    }

    const { error: rErr } = await supabase.from("event_results").upsert(resultRows, { onConflict: "event_id,player_id" });
    if (rErr) throw rErr;
    const { error: sErr } = await supabase.from("event_stats").upsert(statRows, { onConflict: "event_id,player_id" });
    if (sErr) throw sErr;
  }

  const recomputed = await recomputeSeason(seasonId);
  warnings.push(...recomputed.warnings);

  return {
    season: seasonName,
    events: events.map((e) => ({ week: e.week, type: e.type, players: e.players.length, games: e.games.length })),
    weeksInSeason: recomputed.weeks,
    players: recomputed.players,
    warnings,
  };
}

type PlayerAgg = {
  id: string;
  name: string;
  weekScore: Map<number, number>; // switch Points For + blind bonus
  switchWeeks: Set<number>;
  blindBonus: Map<number, number>;
  rounds: number;
  pts: number;
  oppPts: number;
  fourBaggers: number;
  bagsIn: number;
  bagsOn: number;
  bagsOff: number;
  firsts: number; // events where they topped the stats
  switchRounds: number;
  switchGames: number;
};

/** Rebuild season_week_scores and season_stats from every stored event in the season. */
async function recomputeSeason(seasonId: string) {
  const supabase = getSupabaseAdmin();
  const warnings: string[] = [];

  const { data: events, error: evErr } = await supabase.from("events").select("id,week_number,event_type").eq("season_id", seasonId);
  if (evErr) throw evErr;
  const eventById = new Map((events || []).map((e) => [e.id as string, e]));
  const eventIds = Array.from(eventById.keys());

  const results = eventIds.length
    ? (await supabase.from("event_results").select("event_id,player_id,player_name,finish_points,wins,losses,raw").in("event_id", eventIds)).data || []
    : [];
  const stats = eventIds.length
    ? (await supabase.from("event_stats").select("event_id,player_id,player_name,rounds,points,opponent_points,four_baggers,raw").in("event_id", eventIds)).data || []
    : [];

  const agg = new Map<string, PlayerAgg>();
  const get = (id: string, name: string) => {
    let a = agg.get(id);
    if (!a) {
      a = {
        id, name, weekScore: new Map(), switchWeeks: new Set(), blindBonus: new Map(),
        rounds: 0, pts: 0, oppPts: 0, fourBaggers: 0, bagsIn: 0, bagsOn: 0, bagsOff: 0,
        firsts: 0, switchRounds: 0, switchGames: 0,
      };
      agg.set(id, a);
    }
    return a;
  };

  for (const r of results) {
    const ev = eventById.get(r.event_id);
    if (!ev) continue;
    const a = get(r.player_id, r.player_name);
    if (ev.event_type === "Swap") {
      a.switchWeeks.add(ev.week_number);
      a.switchGames += (r.wins || 0) + (r.losses || 0) + (r.raw?.ties || 0);
      a.weekScore.set(ev.week_number, (a.weekScore.get(ev.week_number) || 0) + (r.finish_points || 0));
    } else if (ev.event_type === "Blind" && r.finish_points) {
      a.blindBonus.set(ev.week_number, r.finish_points);
    }
  }

  for (const a of agg.values()) {
    for (const [week, bonus] of a.blindBonus) {
      a.weekScore.set(week, (a.weekScore.get(week) || 0) + bonus);
      if (!a.switchWeeks.has(week)) warnings.push(`${a.name} placed in the Blind Draw in Week ${week} without playing Switch; the bonus counts as their week score.`);
    }
  }

  for (const s of stats) {
    const a = get(s.player_id, s.player_name);
    const raw = s.raw || {};
    a.rounds += s.rounds || 0;
    a.pts += s.points || 0;
    a.oppPts += s.opponent_points || 0;
    a.fourBaggers += s.four_baggers || 0;
    a.bagsIn += raw.bagsIn || 0;
    a.bagsOn += raw.bagsOn || 0;
    a.bagsOff += raw.bagsOff || 0;
    if (raw.statsRank === 1) a.firsts += 1;
    if (eventById.get(s.event_id)?.event_type === "Swap") a.switchRounds += s.rounds || 0;
  }

  const players = Array.from(agg.values());
  const weeks = Array.from(new Set((events || []).map((e) => e.week_number as number))).sort((x, y) => x - y);

  const scored = players.map((a) => {
    const scores = Array.from(a.weekScore.values()).sort((x, y) => y - x);
    return {
      a,
      total: scores.slice(0, BEST_WEEKS_COUNT).reduce((s, v) => s + v, 0),
      best: scores[0] ?? 0,
      ppr: a.rounds ? a.pts / a.rounds : 0,
    };
  });
  scored.sort((x, y) => y.total - x.total || y.best - x.best || y.ppr - x.ppr || x.a.name.localeCompare(y.a.name));

  const round2 = (v: number) => Math.round(v * 100) / 100;

  // Rebuild derived tables for this season only.
  for (const table of ["season_week_scores", "season_stats"]) {
    const { error } = await supabase.from(table).delete().eq("season_id", seasonId);
    if (error) throw error;
  }

  const weekRows = players.flatMap((a) =>
    Array.from(a.weekScore, ([week, score]) => ({
      season_id: seasonId,
      player_id: a.id,
      player_name: a.name,
      week_number: week,
      week_label: `Week ${week}`,
      score,
      raw: { source: SOURCE, bonus: a.blindBonus.get(week) || 0 },
    }))
  );
  if (weekRows.length) {
    const { error } = await supabase.from("season_week_scores").insert(weekRows);
    if (error) throw error;
  }

  const seasonRows = scored.map(({ a, total, ppr }, i) => {
    const bags = a.bagsIn + a.bagsOn + a.bagsOff;
    return {
      season_id: seasonId,
      player_id: a.id,
      player_name: a.name,
      finish: i + 1,
      standing_points: total,
      total_rounds: a.rounds,
      total_points: a.pts,
      average_ppr: round2(ppr),
      opponent_average_ppr: a.rounds ? round2(a.oppPts / a.rounds) : null,
      average_dpr: a.rounds ? round2((a.pts - a.oppPts) / a.rounds) : null,
      opponent_points: a.oppPts,
      total_bags_in: a.bagsIn,
      avg_bags_in_per_round: a.rounds ? round2(a.bagsIn / a.rounds) : null,
      bags_on_percent: bags ? round2((a.bagsOn / bags) * 100) : null,
      bags_off_percent: bags ? round2((a.bagsOff / bags) * 100) : null,
      total_bags_thrown: bags,
      avg_four_bagger_percent: a.rounds ? round2((a.fourBaggers / a.rounds) * 100) : null,
      total_four_baggers: a.fourBaggers,
      first_in_stats: a.firsts,
      avg_rounds_per_swap_game: a.switchGames ? round2(a.switchRounds / a.switchGames) : null,
      raw: { source: SOURCE },
    };
  });
  if (seasonRows.length) {
    const { error } = await supabase.from("season_stats").insert(seasonRows);
    if (error) throw error;
  }

  return { weeks, players: players.length, warnings };
}
