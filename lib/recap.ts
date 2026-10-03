import { getSupabaseAdmin } from "./supabaseAdmin";

/**
 * Weekly recap posts (Facebook/Instagram style) built from a week's stored
 * results and match logs. Only event-level information goes in: placings,
 * records, game scores and event totals/averages. Individual stat lines
 * (PPR, bags, etc. per player) are deliberately never included.
 */

type Row = Record<string, any>;

export type RecapOptions = { season: string; weeks: number[] }[];

export type RecapResult = {
  switch: { text: string; available: boolean };
  blind: { text: string; available: boolean };
  hasMatchLog: { switch: boolean; blind: boolean };
};

export type Game = {
  order: number;
  team1: string;
  team2: string;
  score1: number;
  score2: number;
  seconds: number | null;
  winner: string;
  loser: string;
  ws: number;
  ls: number;
};

const dash = "–";

function seasonOrderKey(name: string) {
  const order: Record<string, number> = { spring: 1, summer: 2, fall: 3, winter: 4 };
  const lower = name.toLowerCase();
  const word = Object.keys(order).find((w) => lower.includes(w));
  const year = Number((lower.match(/(\d{2,4})/) || [])[1]?.slice(-2) || 0);
  return year * 10 + (word ? order[word] : 0);
}

export async function getRecapOptions(): Promise<RecapOptions> {
  const supabase = getSupabaseAdmin();
  const { data: seasons, error } = await supabase.from("seasons").select("id,name");
  if (error) throw error;
  const { data: events, error: evErr } = await supabase.from("events").select("season_id,week_number");
  if (evErr) throw evErr;

  const weeksBySeason = new Map<string, Set<number>>();
  for (const e of events || []) {
    if (!e.week_number) continue;
    if (!weeksBySeason.has(e.season_id)) weeksBySeason.set(e.season_id, new Set());
    weeksBySeason.get(e.season_id)!.add(e.week_number);
  }

  return (seasons || [])
    .filter((s) => weeksBySeason.has(s.id))
    .sort((a, b) => seasonOrderKey(b.name) - seasonOrderKey(a.name))
    .map((s) => ({ season: s.name, weeks: Array.from(weeksBySeason.get(s.id)!).sort((x, y) => y - x) }));
}

function teamKey(names: string[]) {
  return [...names].sort().join(" / ");
}

function members(team: string) {
  return team.split(" / ").map((n) => n.trim()).filter(Boolean);
}

function shortScore(g: Game) {
  return `${g.ws}${dash}${g.ls}`;
}

export function toGames(rows: Row[]): Game[] {
  return rows
    .map((r) => {
      const s1 = Number(r.score1);
      const s2 = Number(r.score2);
      const t1Won = s1 > s2;
      return {
        order: r.game_order,
        team1: r.team1,
        team2: r.team2,
        score1: s1,
        score2: s2,
        seconds: r.play_seconds ?? null,
        winner: t1Won ? r.team1 : r.team2,
        loser: t1Won ? r.team2 : r.team1,
        ws: Math.max(s1, s2),
        ls: Math.min(s1, s2),
      };
    })
    .sort((a, b) => a.order - b.order);
}

function sum(rows: Row[], f: (r: Row) => number) {
  return rows.reduce((s, r) => s + (Number(f(r)) || 0), 0);
}

function pct(n: number, d: number) {
  return d ? `${((n / d) * 100).toFixed(1)}%` : "n/a";
}

/** The event-level stats block. Totals and averages only, never per player. */
function eventStatsBlock(title: string, stats: Row[], games: Game[], teamsLine: string) {
  const rounds = sum(stats, (r) => r.rounds);
  const points = sum(stats, (r) => r.points);
  const bagsIn = sum(stats, (r) => r.raw?.bagsIn);
  const bagsOn = sum(stats, (r) => r.raw?.bagsOn);
  const bagsOff = sum(stats, (r) => r.raw?.bagsOff);
  const bags = bagsIn + bagsOn + bagsOff;
  const fours = sum(stats, (r) => r.four_baggers);

  const lines = [`📊 ${title}`, teamsLine];
  if (games.length) lines.push(`• Total points scored: ${games.reduce((s, g) => s + g.score1 + g.score2, 0)}`);
  if (rounds) lines.push(`• Event PPR: ${(points / rounds).toFixed(2)}`);
  if (bags) lines.push(`• Bags in: ${pct(bagsIn, bags)} | on: ${pct(bagsOn, bags)} | off: ${pct(bagsOff, bags)}`);
  if (rounds) lines.push(`• 4-baggers: ${fours} (${pct(fours, rounds)} of rounds)`);
  const timed = games.filter((g) => g.seconds);
  if (timed.length) {
    const avg = timed.reduce((s, g) => s + (g.seconds || 0), 0) / timed.length / 60;
    lines.push(`• Average game: ${avg.toFixed(1)} min`);
  }
  return lines;
}

function shutoutLine(games: Game[], label: string) {
  const shutouts = games.filter((g) => g.ls === 0);
  if (!shutouts.length) return null;
  if (shutouts.length === 1) {
    const g = shutouts[0];
    return `• ${label}: ${g.winner} ${g.ws}${dash}0 over ${g.loser}`;
  }
  return `• Shutouts: ${shutouts.map((g) => `${g.winner} ${g.ws}${dash}0`).join(" and ")}`;
}

function standingsLink(label: string, link: string) {
  return link.trim() ? [`${label}: ${link.trim()}`] : [];
}

export type RecapInputs = {
  season: string;
  week: number;
  results: Row[];
  stats: Row[];
  games: Game[];
  weekScores: Row[];
  notes: string;
  link: string;
};

export function buildSwitchRecap(i: RecapInputs): string {
  const res = [...i.results].sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99) || (b.finish_points || 0) - (a.finish_points || 0));
  if (!res.length) return "";
  const champ = res[0];
  const rounds = Math.max(...res.map((r) => (r.wins || 0) + (r.losses || 0)), 0);
  const undefeated = res.filter((r) => (r.losses || 0) === 0 && (r.wins || 0) > 0);

  // Points against for the champion, from the match log (names are real names).
  const mine = i.games
    .map((g) => {
      const t1 = members(g.team1).includes(champ.player_name);
      const t2 = members(g.team2).includes(champ.player_name);
      if (!t1 && !t2) return null;
      const myTeam = t1 ? g.team1 : g.team2;
      const my = t1 ? g.score1 : g.score2;
      const their = t1 ? g.score2 : g.score1;
      const partner = members(myTeam).find((n) => n !== champ.player_name) || "";
      return { my, their, partner, won: my > their };
    })
    .filter(Boolean) as { my: number; their: number; partner: string; won: boolean }[];
  const pa = mine.reduce((s, g) => s + g.their, 0);
  const bigWins = mine.filter((g) => g.won).sort((a, b) => b.my - b.their - (a.my - a.their)).slice(0, 2);

  const record = `${champ.wins ?? 0}${dash}${champ.losses ?? 0}`;
  const lines: string[] = [];
  lines.push(`🏆 ${i.season} ${dash} Week ${i.week} Switch Recap 🏆`, "");

  const intro =
    i.week === 1
      ? `Week 1 of the ${i.season} season opened with ${res.length} players, ${rounds || 4} rounds of round robin and a new partner every game.`
      : `Week ${i.week} of ${i.season} brought ${res.length} players, ${rounds || 4} rounds of round robin and a new partner every game.`;
  lines.push(
    undefeated.length === 1 ? `${intro} One player finished perfect.` : intro,
    ""
  );
  if (i.notes.trim()) lines.push(i.notes.trim(), "");

  lines.push("🔥 Switch Champion");
  let champLine = `${champ.player_name} ${(champ.losses || 0) === 0 ? `went a perfect ${record}` : `led the field at ${record}`} with ${champ.finish_points} points for`;
  if (mine.length) champLine += ` and only ${pa} against`;
  if (bigWins.length) {
    champLine += `, including ${bigWins
      .map((g) => `a ${g.my}${dash}${g.their} win${g.partner ? ` with ${g.partner}` : ""}`)
      .join(" and ")}`;
  }
  champLine += ".";
  if (undefeated.length === 1 && (champ.losses || 0) === 0) champLine += " They were the only undefeated player of the night.";
  lines.push(champLine, "");

  lines.push("🏁 Top 5");
  const medals = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣"];
  res.slice(0, 5).forEach((r, idx) => {
    lines.push(`${medals[idx]} ${r.player_name} ${dash} ${r.wins ?? 0}${dash}${r.losses ?? 0} (${r.finish_points} PF)`);
  });
  lines.push("");

  const top = [...i.weekScores].sort((a, b) => b.score - a.score).slice(0, 3);
  if (top.length) {
    lines.push("📈 Week " + i.week + " League Points (Switch + Blind Draw bonus)");
    top.forEach((r, idx) => lines.push(`${idx + 1}. ${r.player_name} ${dash} ${r.score}`));
    lines.push("");
  }

  if (i.games.length) {
    const byMargin = [...i.games].sort((a, b) => a.ws - a.ls - (b.ws - b.ls));
    const closest = byMargin[0];
    const longest = [...i.games].filter((g) => g.seconds).sort((a, b) => (b.seconds || 0) - (a.seconds || 0))[0];
    lines.push("🎯 Games of the Night");
    lines.push(`• Closest: ${closest.winner} edged ${closest.loser} ${shortScore(closest)}`);
    if (longest) lines.push(`• Longest: ${longest.winner} beat ${longest.loser} ${shortScore(longest)} in ${Math.round((longest.seconds || 0) / 60)} minutes`);
    const so = shutoutLine(i.games, "Shutout");
    if (so) lines.push(so);
    lines.push("");
  }

  lines.push(...eventStatsBlock("Switch " + dash + " Event Stats", i.stats, i.games, `• ${i.stats.length} players${i.games.length ? `, ${i.games.length} games` : ""}`));
  lines.push("", ...standingsLink("Full standings", i.link));
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function buildBlindRecap(i: RecapInputs): string {
  // Teams from the results (everyone on a team shares a rank and team name).
  const placed = new Map<string, { place: number; names: string[] }>();
  for (const r of i.results) {
    if (!r.rank || !r.team) continue;
    const key = `${r.rank}|${r.team}`;
    if (!placed.has(key)) placed.set(key, { place: r.rank, names: [] });
    placed.get(key)!.names.push(r.player_name);
  }
  const teams = Array.from(placed.values())
    .map((t) => ({ place: t.place, key: teamKey(t.names), label: teamKey(t.names) }))
    .sort((a, b) => a.place - b.place);
  if (!teams.length) return "";

  const champion = teams.find((t) => t.place === 1) || teams[0];
  const games = i.games;
  const record = new Map<string, { w: number; l: number }>();
  for (const g of games) {
    for (const [team, won] of [[g.winner, true], [g.loser, false]] as const) {
      const r = record.get(team) || { w: 0, l: 0 };
      if (won) r.w++;
      else r.l++;
      record.set(team, r);
    }
  }
  const rec = (key: string) => (record.has(key) ? `${record.get(key)!.w}${dash}${record.get(key)!.l}` : "");

  // Finals: the last game, plus the one before it if it's a rematch (bracket reset).
  let final1: Game | null = null;
  let final2: Game | null = null;
  if (games.length >= 2) {
    const last = games[games.length - 1];
    const prev = games[games.length - 2];
    const samePair = new Set([last.team1, last.team2]).size === 2 && new Set([prev.team1, prev.team2, last.team1, last.team2]).size === 2;
    if (samePair) {
      final1 = prev;
      final2 = last;
    } else {
      final2 = last;
    }
  } else if (games.length === 1) {
    final2 = games[0];
  }
  const reset = !!(final1 && final2);
  const finalsFirstOrder = (final1 || final2)?.order ?? Infinity;
  const preFinals = games.filter((g) => g.order < finalsFirstOrder);

  const runnerUp = teams.find((t) => t.place === 2) || null;
  const thirds = teams.filter((t) => t.place === 3);

  const lossesBefore = (team: string) => preFinals.filter((g) => g.loser === team).length;
  const winsOf = (team: string) => preFinals.filter((g) => g.winner === team);
  const label = (key: string) => teams.find((t) => t.key === key)?.label || key.split(" / ").join(" / ");

  const lines: string[] = [];
  lines.push(`🏆 ${i.season} ${dash} Week ${i.week} Blind Draw Recap 🏆`, "");

  const teamCount = new Set(teams.map((t) => t.key)).size;
  const opener = i.week === 1 ? "The first Blind Draw of the season" : `The Week ${i.week} Blind Draw`;
  lines.push(
    reset
      ? `${opener} delivered a ${teamCount}-team double-elimination bracket, and the finals came down to a bracket reset.`
      : `${opener} delivered a ${teamCount}-team double-elimination bracket and a champion to show for it.`,
    ""
  );
  if (i.notes.trim()) lines.push(i.notes.trim(), "");

  if (games.length && runnerUp) {
    // Winner's bracket: the runner-up's route (if they were unbeaten into the finals).
    const unbeaten = lossesBefore(runnerUp.key) === 0;
    const ruWins = winsOf(runnerUp.key);
    const overChamp = ruWins.find((g) => g.loser === champion.key);
    const overThird = thirds.length ? ruWins.find((g) => thirds.some((t) => t.key === g.loser)) : undefined;
    const highlights = [overChamp, overThird].filter(Boolean) as Game[];

    if (unbeaten) {
      lines.push("🔥 Winner's Bracket");
      let t = `${runnerUp.label} stayed unbeaten, running through the winner's side and earning the king seat.`;
      if (highlights.length) {
        t += ` Their biggest statements were a ${highlights
          .map((g) => `${shortScore(g)} win over ${label(g.loser)}`)
          .join(" and a ")}.`;
      }
      lines.push(t, "");
    }

    // Champion's route.
    const champGames = preFinals.filter((g) => g.winner === champion.key || g.loser === champion.key);
    const firstLoss = champGames.find((g) => g.loser === champion.key);
    if (firstLoss) {
      const afterLoss = champGames.filter((g) => g.order > firstLoss.order && g.winner === champion.key);
      lines.push("💪 Loser's Bracket Grind");
      lines.push(
        `That ${firstLoss.winner === runnerUp?.key ? "opening " : ""}loss didn't end the night for ${champion.label}, it fueled it. They went on a ${afterLoss.length}-game elimination run:`
      );
      afterLoss.forEach((g, idx) => {
        const isLosersFinal = idx === afterLoss.length - 1;
        lines.push(`• ${shortScore(g)} over ${label(g.loser)}${isLosersFinal && afterLoss.length > 1 ? " in the loser's final" : ""}`);
      });
      lines.push("");
    } else if (champGames.length) {
      lines.push("🔥 Champion's Run");
      lines.push(`${champion.label} went through the bracket without a loss before the finals.`, "");
    }

    // Third place.
    for (const third of thirds) {
      const wins = winsOf(third.key);
      const losses = preFinals.filter((g) => g.loser === third.key);
      const elim = losses[losses.length - 1];
      const beforeFinal = preFinals[preFinals.length - 1];
      lines.push("🥉 Third Place Spotlight");
      let t = `${third.label} finished ${rec(third.key)}`;
      if (wins.length) t += ` with wins over ${wins.map((g) => label(g.loser)).join(" and ")}`;
      if (elim) t += ` before bowing out ${elim === beforeFinal && elim.winner === champion.key ? "in the loser's final" : `to ${label(elim.winner)}`}`;
      lines.push(t + ".", "");
    }

    // Championship.
    if (final2 && (final1 || final2)) {
      lines.push("🏆 Championship Match");
      if (reset && final1) {
        const finalWinnerFirst = final1.winner;
        lines.push(
          finalWinnerFirst === champion.key
            ? `With ${runnerUp.label} in the king seat, ${champion.label} needed to win twice, and they did. Game 1 went ${shortScore(final1)}, forcing the reset. Game 2 sealed it ${shortScore(final2)}.`
            : `${champion.label} fell in Game 1 ${shortScore(final1)}, then won the reset ${shortScore(final2)} to take the title.`
        );
      } else {
        lines.push(`${champion.label} beat ${runnerUp.label} ${shortScore(final2)} in the finals.`);
      }
      lines.push("");
    }
  }

  lines.push("🏁 Final Results");
  const placeLine = (emoji: string, word: string, t: { key: string; label: string }) =>
    `${emoji} ${word} ${dash} ${t.label}${rec(t.key) ? ` (${rec(t.key)})` : ""}`;
  lines.push(placeLine("🥇", "Champions", champion));
  if (runnerUp) lines.push(placeLine("🥈", "Runner-Up", runnerUp));
  thirds.forEach((t) => lines.push(placeLine("🥉", "3rd Place", t)));
  lines.push("");

  const bonusTeams = teams.filter((t) => t.place <= 3);
  if (bonusTeams.length) {
    lines.push("🎁 League Bonus: +3 / +2 / +1 for the top three teams, both players each.", "");
  }

  lines.push(
    ...eventStatsBlock("Blind Draw " + dash + " Event Stats", i.stats, games, `• ${teamCount} teams, ${i.stats.length} players${games.length ? `, ${games.length} games` : ""}`)
  );
  const so = shutoutLine(games, "Shutout of the night");
  if (so) lines.push(so);
  lines.push("", ...standingsLink("Full bracket", i.link));
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export async function buildRecaps(
  seasonName: string,
  week: number,
  extras: { switchNotes?: string; blindNotes?: string; switchLink?: string; blindLink?: string } = {}
): Promise<RecapResult> {
  const supabase = getSupabaseAdmin();

  const { data: season, error: sErr } = await supabase.from("seasons").select("id,name").eq("name", seasonName).maybeSingle();
  if (sErr) throw sErr;
  if (!season) throw new Error(`Season "${seasonName}" not found.`);

  const { data: events, error: eErr } = await supabase
    .from("events")
    .select("id,event_type")
    .eq("season_id", season.id)
    .eq("week_number", week);
  if (eErr) throw eErr;

  const byType = new Map((events || []).map((e) => [e.event_type as string, e.id as string]));
  const weekScores =
    (await supabase.from("season_week_scores").select("player_name,score").eq("season_id", season.id).eq("week_number", week)).data || [];

  async function load(eventId?: string) {
    if (!eventId) return { results: [] as Row[], stats: [] as Row[], games: [] as Game[] };
    const results = (await supabase.from("event_results").select("player_name,rank,team,finish_points,wins,losses").eq("event_id", eventId)).data || [];
    const stats = (await supabase.from("event_stats").select("rounds,points,four_baggers,raw").eq("event_id", eventId)).data || [];
    // The match log table may not exist yet; recaps still work without it.
    const gameQuery = await supabase.from("event_games").select("*").eq("event_id", eventId);
    const games = gameQuery.error ? [] : toGames(gameQuery.data || []);
    return { results, stats, games };
  }

  const sw = await load(byType.get("Swap"));
  const bl = await load(byType.get("Blind"));

  const switchText = buildSwitchRecap({
    season: season.name, week, ...sw, weekScores, notes: extras.switchNotes || "", link: extras.switchLink || "",
  });
  const blindText = buildBlindRecap({
    season: season.name, week, ...bl, weekScores, notes: extras.blindNotes || "", link: extras.blindLink || "",
  });

  return {
    switch: { text: switchText, available: !!switchText },
    blind: { text: blindText, available: !!blindText },
    hasMatchLog: { switch: sw.games.length > 0, blind: bl.games.length > 0 },
  };
}
