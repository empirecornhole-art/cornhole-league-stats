"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import StoreTab from "./StoreTab";

type Data = {
  lastUpdated?: string;
  seasons: string[];
  players: string[];
  standings: any[];
  weekly: any[];
  eventStats?: any[];
  stats: any[];
  weekScores?: any[];
};

type Tab = "dashboard" | "standings" | "weeks" | "stats" | "alltime" | "badges" | "players" | "scenarios" | "compare" | "store";
const TAB_IDS: Tab[] = ["dashboard", "standings", "weeks", "stats", "alltime", "badges", "players", "scenarios", "compare", "store"];
type EventFilter = "All" | "Blind" | "Swap";
type SortDirection = "asc" | "desc";

function clean(value: any) {
  return String(value ?? "").trim();
}

function compact(value: any) {
  return clean(value).toLowerCase().replace(/[^a-z0-9]/g, "");
}

// URL-friendly player slug for shareable links, e.g. "Jim Mateunas" -> "jim-mateunas".
// Matching an incoming slug back to a player uses compact() instead (see findPlayerBySlug),
// since compact() already strips hyphens and is insensitive to spacing/punctuation either way.
function slugify(value: any) {
  return clean(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-+|-+$)/g, "");
}

function findPlayerBySlug(players: string[], slug: string) {
  const target = compact(slug);
  if (!target) return "";
  return players.find((p) => compact(p) === target) || "";
}

function isValidPlayerName(value: any) {
  const name = clean(value);
  const id = compact(name);

  if (!name) return false;
  if (/^\d+$/.test(name)) return false;
  // Spreadsheet error tokens (e.g. "#REF!", "#N/A", "#DIV/0!") that can leak
  // in from a broken upstream formula reference -- these aren't real
  // players and shouldn't be selectable anywhere on the site.
  if (/^#[A-Z0-9/]+!?\??$/i.test(name)) return false;

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

function getSeason(row: any, fallback = "") {
  return clean(row.Season || row.season || row.SEASON || fallback);
}

function getPlayer(row: any) {
  return clean(
    row.Player ||
      row.playerName ||
      row["Row Labels"] ||
      row["Player Name"] ||
      row["PLAYER NAME"] ||
      row.Name ||
      row.name
  );
}

function getWeek(row: any) {
  return clean(row.Week || row.week || row.WEEK);
}

function getType(row: any) {
  return clean(row.Type || row.type || row.TYPE);
}

function numberVal(value: any) {
  if (value === null || value === undefined || value === "") return 0;
  const n = Number(String(value).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function getValue(row: any, keys: string[]) {
  for (const key of keys) {
    if (row?.[key] !== undefined && row?.[key] !== "" && row?.[key] !== null) return row[key];
  }

  const wanted = keys.map(compact);
  const found = Object.keys(row || {}).find((key) => wanted.includes(compact(key)));
  return found ? row[found] : "";
}

function getStatValue(row: any, keys: string[]) {
  return getValue(row || {}, keys);
}

function pointValue(row: any) {
  return numberVal(
    getValue(row, [
      "Overall",
      "Standing Points",
      "standing_points",
      "Points",
      "Total Points",
      "Total Pts",
    ])
  );
}

function formatValue(value: any, decimals = 2) {
  if (value === "" || value === null || value === undefined) return "-";
  const n = numberVal(value);
  if (!Number.isFinite(n)) return String(value);
  if (String(value).includes("%")) return `${n.toFixed(2)}%`;
  if (Number.isInteger(n) || decimals === 0) return String(Math.round(n));
  return n.toFixed(decimals).replace(/\.00$/, "");
}

function weekSort(a: string, b: string) {
  const an = Number(clean(a).replace(/[^0-9]/g, ""));
  const bn = Number(clean(b).replace(/[^0-9]/g, ""));
  return an - bn;
}

const seasonOrder: Record<string, number> = {
  spring: 1,
  summer: 2,
  fall: 3,
  winter: 4,
};

function seasonSort(a: string, b: string) {
  const parse = (season: string) => {
    const value = clean(season).toLowerCase();
    const yearMatch = value.match(/(\d{2,4})/);
    const year = yearMatch ? Number(yearMatch[1].slice(-2)) : 0;
    const label = Object.keys(seasonOrder).find((word) => value.includes(word)) || "spring";
    return { year, order: seasonOrder[label] || 99 };
  };

  const av = parse(a);
  const bv = parse(b);
  if (av.year !== bv.year) return av.year - bv.year;
  return av.order - bv.order;
}

const statColumns = [
  { label: "Finish", keys: ["Finish", "Rank"], decimals: 0 },
  { label: "Total Rounds", keys: ["Total Rounds"], decimals: 0 },
  { label: "Total Pts", keys: ["Total Pts", "Total Points"], decimals: 0 },
  { label: "Average PPR", keys: ["Average PPR", "PPR"], decimals: 2 },
  { label: "Opp Avg PPR", keys: ["Opponents Avg PPR", "OPPR", "Opp Avg PPR"], decimals: 2 },
  { label: "Average DPR", keys: ["Average DPR", "DPR"], decimals: 2 },
  { label: "Opp Pts", keys: ["Opponents Pts", "Opp Pts"], decimals: 0 },
  { label: "Avg Bags In", keys: ["Avg Bags In"], decimals: 2 },
  { label: "Total Bags In", keys: ["Total Bags In"], decimals: 0 },
  { label: "Avg Bags In/Rd", keys: ["Avg Bags In per Rd", "Avg Bags In/Rd"], decimals: 2 },
  { label: "Bags On %", keys: ["Bags On %"], decimals: 2 },
  { label: "Bags Off %", keys: ["Bags Off %"], decimals: 2 },
  { label: "Total Bags", keys: ["Total Bags Thrown", "Total Bags"], decimals: 0 },
  { label: "Avg 4-Bagger %", keys: ["Avg 4-Bagger %"], decimals: 2 },
  { label: "Total 4-Baggers", keys: ["Total 4-Baggers", "4 Baggers"], decimals: 0 },
  { label: "1st in Stats", keys: ["1st in Stats"], decimals: 0 },
  { label: "Avg Rounds/Swap", keys: ["Avg Rounds/Swap Game", "Avg Rounds/Swap"], decimals: 2 },
];

const weeklyStatColumns = [
  { label: "PPR", keys: ["PPR"], decimals: 2 },
  { label: "Rounds", keys: ["Rounds"], decimals: 0 },
  { label: "Points", keys: ["Points"], decimals: 0 },
  { label: "OPPR", keys: ["OPPR"], decimals: 2 },
  { label: "Opp Pts", keys: ["Opp Pts"], decimals: 0 },
  { label: "DPR", keys: ["DPR"], decimals: 2 },
  { label: "4 Baggers", keys: ["4 Baggers"], decimals: 0 },
];

function eventIdentity(row: any) {
  return `${compact(getSeason(row))}|${compact(getWeek(row))}|${compact(getType(row))}|${compact(getPlayer(row))}`;
}

function mergeWeeklyRows(weeklyRows: any[], eventStatsRows: any[]) {
  const statMap = new Map<string, any>();
  for (const stat of eventStatsRows || []) {
    if (!isValidPlayerName(getPlayer(stat))) continue;
    statMap.set(eventIdentity(stat), stat);
  }

  return (weeklyRows || [])
    .filter((row) => isValidPlayerName(getPlayer(row)))
    .map((row) => {
      const stat = statMap.get(eventIdentity(row)) || {};
      return {
        ...row,
        PPR: getValue(stat, ["PPR"]),
        Rounds: getValue(stat, ["Rounds"]),
        StatPoints: getValue(stat, ["Points"]),
        OPPR: getValue(stat, ["OPPR"]),
        "Opp Pts": getValue(stat, ["Opp Pts"]),
        DPR: getValue(stat, ["DPR"]),
        "4 Baggers": getValue(stat, ["4 Baggers"]),
      };
    });
}

function summarizeSeasonStats(rows: any[]) {
  const valid = rows.filter((row) => isValidPlayerName(getPlayer(row)));
  const avg = (keys: string[], decimals = 2) => {
    const values = valid.map((row) => numberVal(getStatValue(row, keys))).filter((n) => Number.isFinite(n));
    if (!values.length) return "-";
    return formatValue(values.reduce((a, b) => a + b, 0) / values.length, decimals);
  };
  const sum = (keys: string[], decimals = 0) => {
    const total = valid.reduce((acc, row) => acc + numberVal(getStatValue(row, keys)), 0);
    return total ? formatValue(total, decimals) : "-";
  };

  return [
    { label: "Players", value: valid.length },
    { label: "Total Rounds", value: sum(["Total Rounds"], 0) },
    { label: "Total Points", value: sum(["Total Pts", "Total Points"], 0) },
    { label: "Avg PPR", value: avg(["Average PPR", "PPR"], 2) },
    { label: "Avg OPPR", value: avg(["Opponents Avg PPR", "OPPR"], 2) },
    { label: "Avg DPR", value: avg(["Average DPR", "DPR"], 2) },
    { label: "Total 4-Baggers", value: sum(["Total 4-Baggers", "4 Baggers"], 0) },
    { label: "Avg Bags On %", value: avg(["Bags On %"], 2) },
  ];
}

function summarizeEvent(rows: any[]) {
  const valid = rows.filter((row) => isValidPlayerName(getPlayer(row)));
  const avg = (key: string) => {
    const values = valid.map((row) => numberVal(row[key])).filter((n) => n !== 0);
    if (!values.length) return "-";
    return formatValue(values.reduce((a, b) => a + b, 0) / values.length, 2);
  };
  const sum = (key: string) => {
    const total = valid.reduce((acc, row) => acc + numberVal(row[key]), 0);
    return total ? formatValue(total, 0) : "-";
  };

  return [
    { label: "Players", value: valid.length },
    { label: "Total Rounds", value: sum("Rounds") },
    { label: "Total Points", value: sum("StatPoints") },
    { label: "Avg PPR", value: avg("PPR") },
    { label: "Avg OPPR", value: avg("OPPR") },
    { label: "Avg DPR", value: avg("DPR") },
    { label: "Opp Points", value: sum("Opp Pts") },
    { label: "4 Baggers", value: sum("4 Baggers") },
  ];
}

// Career (all-time, cross-season) totals per player, built from the same
// per-season Stats rows the Season Stats tab uses. Counting stats (rounds,
// points, bags, 4-baggers) are straight sums across every season on record.
// Rate stats are recomputed from those sums where the underlying formula is
// known (PPR/OPPR/DPR, Bags On %, Avg Bags In/Rd) rather than averaged, so a
// 3-round cameo season can't skew a rate the way a naive average would; the
// couple of rate stats without a documented sum-based formula (4-Bagger %,
// Bags Off %, Rounds/Swap) fall back to a rounds-weighted average instead of
// a guessed formula.
function aggregateCareerStats(rows: any[]) {
  const byPlayer = new Map<string, any[]>();
  for (const row of rows) {
    const name = getPlayer(row);
    if (!isValidPlayerName(name)) continue;
    if (!byPlayer.has(name)) byPlayer.set(name, []);
    byPlayer.get(name)!.push(row);
  }

  const sumKeys = (playerRows: any[], keys: string[]) =>
    playerRows.reduce((acc, row) => acc + numberVal(getStatValue(row, keys)), 0);

  const roundsWeightedAvg = (playerRows: any[], keys: string[]) => {
    let weightedTotal = 0;
    let weightTotal = 0;
    for (const row of playerRows) {
      const weight = numberVal(getStatValue(row, ["Total Rounds"]));
      weightedTotal += numberVal(getStatValue(row, keys)) * weight;
      weightTotal += weight;
    }
    return weightTotal ? weightedTotal / weightTotal : 0;
  };

  return Array.from(byPlayer.entries()).map(([name, playerRows]) => {
    const totalRounds = sumKeys(playerRows, ["Total Rounds"]);
    const totalPts = sumKeys(playerRows, ["Total Pts", "Total Points"]);
    const totalOppPts = sumKeys(playerRows, ["Opponents Pts", "Opp Pts"]);
    const totalBagsIn = sumKeys(playerRows, ["Total Bags In"]);
    const totalBags = sumKeys(playerRows, ["Total Bags Thrown", "Total Bags"]);
    const total4Baggers = sumKeys(playerRows, ["Total 4-Baggers", "4 Baggers"]);
    const totalFirsts = sumKeys(playerRows, ["1st in Stats"]);
    const avgPPR = totalRounds ? totalPts / totalRounds : 0;
    const avgOPPR = totalRounds ? totalOppPts / totalRounds : 0;

    return {
      name,
      seasonsPlayed: playerRows.length,
      totalRounds,
      totalPts,
      totalOppPts,
      avgPPR,
      avgOPPR,
      avgDPR: avgPPR - avgOPPR,
      bagsOnPct: totalBags ? (totalBagsIn / totalBags) * 100 : 0,
      avgBagsInPerRd: totalRounds ? totalBagsIn / totalRounds : 0,
      totalBagsIn,
      totalBags,
      avgBaggerPct: roundsWeightedAvg(playerRows, ["Avg 4-Bagger %"]),
      total4Baggers,
      avgBagsOffPct: roundsWeightedAvg(playerRows, ["Bags Off %"]),
      avgRoundsPerSwap: roundsWeightedAvg(playerRows, ["Avg Rounds/Swap Game", "Avg Rounds/Swap"]),
      totalFirsts,
    };
  });
}

function standardDeviation(values: number[]) {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

// Picks the best value out of a list of {name, value} entries and returns
// every name tied for it -- ties are common with small league sizes, and a
// badge that silently picked one of several tied players would look wrong
// to everyone else who actually earned it too.
function pickLeaders(entries: { name: string; value: number }[], lowerIsBetter = false) {
  const valid = entries.filter((e) => e.name && Number.isFinite(e.value));
  if (!valid.length) return { winners: [] as string[], value: null as number | null };

  const best = valid.reduce(
    (acc, e) => (lowerIsBetter ? Math.min(acc, e.value) : Math.max(acc, e.value)),
    lowerIsBetter ? Infinity : -Infinity
  );

  const winners = Array.from(new Set(valid.filter((e) => e.value === best).map((e) => e.name)));
  return { winners, value: best };
}

const MIN_SEASON_ROUNDS_FOR_RATE_BADGES = 30;
const MIN_WEEKS_FOR_CONSISTENCY_BADGE = 4;

// Season-long badges, recomputed live from whatever weeks have been uploaded
// so far -- they can change hands week to week right up until the season
// ends, which is the point (it gives people a reason to check back).
function computeSeasonBadges(seasonRows: any[], weeklyRows: any[], priorSeasonRows: any[], careerByName: Map<string, any>) {
  const valid = seasonRows.filter((row) => isValidPlayerName(getPlayer(row)));
  const badges: any[] = [];

  const roundsByPlayer = new Map<string, number>();
  for (const row of valid) roundsByPlayer.set(getPlayer(row), numberVal(getStatValue(row, ["Total Rounds"])));

  const finishEntries = valid
    .map((row) => ({ name: getPlayer(row), value: numberVal(getStatValue(row, ["Finish", "Rank"])) }))
    .filter((e) => e.value > 0);
  if (finishEntries.length) {
    const { winners, value } = pickLeaders(finishEntries, true);
    badges.push({
      id: "points-champion",
      icon: "🏆",
      title: "Points Champion",
      description: "Best final standing this season.",
      winners,
      display: value ? `Finished #${value}` : "",
    });
  }

  const weeksByPlayer = new Map<string, Set<string>>();
  for (const row of weeklyRows) {
    const name = getPlayer(row);
    if (!isValidPlayerName(name)) continue;
    if (!weeksByPlayer.has(name)) weeksByPlayer.set(name, new Set());
    weeksByPlayer.get(name)!.add(getWeek(row));
  }
  const totalWeeksInSeason = new Set(weeklyRows.map(getWeek).filter(Boolean)).size;
  const attendanceEntries = Array.from(weeksByPlayer.entries()).map(([name, weeks]) => ({ name, value: weeks.size }));

  {
    const { winners, value } = pickLeaders(attendanceEntries);
    badges.push({
      id: "iron-man",
      icon: "🦾",
      title: "Iron Man",
      description: "Played in the most weeks this season.",
      winners,
      display: value ? `${value} week${value === 1 ? "" : "s"} played` : "",
    });
  }

  if (totalWeeksInSeason > 0) {
    const perfect = attendanceEntries.filter((e) => e.value === totalWeeksInSeason).map((e) => e.name);
    if (perfect.length) {
      badges.push({
        id: "perfect-attendance",
        icon: "📅",
        title: "Perfect Attendance",
        description: `Played every one of the ${totalWeeksInSeason} weeks so far.`,
        winners: perfect,
        display: `${totalWeeksInSeason}/${totalWeeksInSeason} weeks`,
      });
    }
  }

  const pprEntries = valid
    .map((row) => ({ name: getPlayer(row), value: numberVal(getStatValue(row, ["Average PPR", "PPR"])) }))
    .filter((e) => (roundsByPlayer.get(e.name) || 0) >= MIN_SEASON_ROUNDS_FOR_RATE_BADGES);
  {
    const { winners, value } = pickLeaders(pprEntries);
    badges.push({
      id: "offensive-machine",
      icon: "🔥",
      title: "Offensive Machine",
      description: `Highest scoring average (min ${MIN_SEASON_ROUNDS_FOR_RATE_BADGES} rounds played).`,
      winners,
      display: value !== null ? `${value.toFixed(2)} PPR` : "",
    });
  }

  const opprEntries = valid
    .map((row) => ({ name: getPlayer(row), value: numberVal(getStatValue(row, ["Opponents Avg PPR", "OPPR"])) }))
    .filter((e) => (roundsByPlayer.get(e.name) || 0) >= MIN_SEASON_ROUNDS_FOR_RATE_BADGES);
  {
    const { winners, value } = pickLeaders(opprEntries, true);
    badges.push({
      id: "defensive-wall",
      icon: "🧱",
      title: "Defensive Wall",
      description: `Held opponents to the fewest points per round (min ${MIN_SEASON_ROUNDS_FOR_RATE_BADGES} rounds played).`,
      winners,
      display: value !== null ? `${value.toFixed(2)} OPPR allowed` : "",
    });
  }

  const baggerPctEntries = valid
    .map((row) => ({ name: getPlayer(row), value: numberVal(getStatValue(row, ["Avg 4-Bagger %"])) }))
    .filter((e) => (roundsByPlayer.get(e.name) || 0) >= MIN_SEASON_ROUNDS_FOR_RATE_BADGES);
  {
    const { winners, value } = pickLeaders(baggerPctEntries);
    badges.push({
      id: "sharpshooter",
      icon: "🎯",
      title: "Sharpshooter",
      description: `Highest 4-bagger rate (min ${MIN_SEASON_ROUNDS_FOR_RATE_BADGES} rounds played).`,
      winners,
      display: value !== null ? `${value.toFixed(2)}%` : "",
    });
  }

  const totalBaggerEntries = valid
    .map((row) => ({ name: getPlayer(row), value: numberVal(getStatValue(row, ["Total 4-Baggers", "4 Baggers"])) }))
    .filter((e) => e.value > 0);
  {
    const { winners, value } = pickLeaders(totalBaggerEntries);
    badges.push({
      id: "bag-assassin",
      icon: "💥",
      title: "Bag Assassin",
      description: "Most 4-baggers thrown this season.",
      winners,
      display: value !== null ? `${Math.round(value)} 4-baggers` : "",
    });
  }

  const bagsOnEntries = valid
    .map((row) => ({ name: getPlayer(row), value: numberVal(getStatValue(row, ["Bags On %"])) }))
    .filter((e) => e.value > 0);
  {
    const { winners, value } = pickLeaders(bagsOnEntries);
    badges.push({
      id: "bullseye",
      icon: "🏹",
      title: "Bullseye",
      description: "Highest percentage of bags landing on the board this season.",
      winners,
      display: value !== null ? `${value.toFixed(2)}%` : "",
    });
  }

  const pointsByPlayer = new Map<string, number[]>();
  for (const row of weeklyRows) {
    const name = getPlayer(row);
    if (!isValidPlayerName(name)) continue;
    const pts = numberVal(row.Points);
    if (!pts) continue;
    if (!pointsByPlayer.has(name)) pointsByPlayer.set(name, []);
    pointsByPlayer.get(name)!.push(pts);
  }
  const consistencyEntries = Array.from(pointsByPlayer.entries())
    .filter(([, pts]) => pts.length >= MIN_WEEKS_FOR_CONSISTENCY_BADGE)
    .map(([name, pts]) => ({ name, value: standardDeviation(pts) }));
  {
    const { winners, value } = pickLeaders(consistencyEntries, true);
    badges.push({
      id: "iceman",
      icon: "🧊",
      title: "Iceman",
      description: `Most consistent week-to-week finishes (min ${MIN_WEEKS_FOR_CONSISTENCY_BADGE} weeks played).`,
      winners,
      display: value !== null ? `±${value.toFixed(1)} pts` : "",
    });
  }

  if (priorSeasonRows.length) {
    const priorFinishByName = new Map<string, number>();
    for (const row of priorSeasonRows) {
      const name = getPlayer(row);
      const finish = numberVal(getStatValue(row, ["Finish", "Rank"]));
      if (isValidPlayerName(name) && finish > 0) priorFinishByName.set(name, finish);
    }

    const improvedEntries = valid
      .map((row) => {
        const name = getPlayer(row);
        const currentFinish = numberVal(getStatValue(row, ["Finish", "Rank"]));
        const priorFinish = priorFinishByName.get(name);
        if (!currentFinish || !priorFinish) return null;
        return { name, value: priorFinish - currentFinish };
      })
      .filter((e): e is { name: string; value: number } => !!e && e.value > 0);

    if (improvedEntries.length) {
      const { winners, value } = pickLeaders(improvedEntries);
      badges.push({
        id: "most-improved",
        icon: "🚀",
        title: "Most Improved",
        description: "Biggest jump in final standing vs. last season.",
        winners,
        display: value !== null ? `Up ${value} spot${value === 1 ? "" : "s"}` : "",
      });
    }
  }

  const rookieEntries = valid
    .map((row) => {
      const name = getPlayer(row);
      const career = careerByName.get(name);
      if (!career || career.seasonsPlayed !== 1) return null;
      const finish = numberVal(getStatValue(row, ["Finish", "Rank"]));
      if (!finish) return null;
      return { name, value: finish };
    })
    .filter((e): e is { name: string; value: number } => !!e);

  if (rookieEntries.length) {
    const { winners, value } = pickLeaders(rookieEntries, true);
    badges.push({
      id: "rookie-standout",
      icon: "🌱",
      title: "Rookie Standout",
      description: "Best finish this season among first-timers.",
      winners,
      display: value !== null ? `Finished #${value}` : "",
    });
  }

  return badges;
}

// Week-specific badges. Rewards more than just "who won the week" -- offense,
// defense, volume, and a personal-best callout so players who aren't
// contending for the top spot still have something to check for.
function computeWeeklyBadges(weekRows: any[], seasonWeekScores: any[], weekNumber: number, allWeeklyForSeason: any[]) {
  if (!weekNumber) return [];

  const badges: any[] = [];
  const validWeekRows = weekRows.filter((row) => isValidPlayerName(getPlayer(row)));

  const scoreEntries = seasonWeekScores
    .filter((row) => isValidPlayerName(getPlayer(row)) && numberVal(row.WeekNumber) === weekNumber)
    .map((row) => ({ name: getPlayer(row), value: numberVal(row.Score) }))
    .filter((e) => e.value > 0);

  if (scoreEntries.length) {
    const { winners, value } = pickLeaders(scoreEntries);
    badges.push({
      id: "weekly-champ",
      icon: "👑",
      title: "Weekly Champ",
      description: "Highest scoring week.",
      winners,
      display: value !== null ? `${formatValue(value, 0)} pts` : "",
    });
  }

  const prevWeekScores = new Map(
    seasonWeekScores
      .filter((row) => isValidPlayerName(getPlayer(row)) && numberVal(row.WeekNumber) === weekNumber - 1)
      .map((row) => [getPlayer(row), numberVal(row.Score)])
  );
  // Someone who sat out last week and is just showing up this week isn't a
  // "riser" -- that's not an improvement over anything. Requiring an actual
  // played row for the prior week (rather than just a non-null score) also
  // guards against a sheet that zero-fills a bye week's score instead of
  // leaving the cell blank, which would otherwise look like a huge jump
  // from 0.
  const playedPrevWeek = new Set(
    allWeeklyForSeason
      .filter((row) => isValidPlayerName(getPlayer(row)) && numberVal(getWeek(row)) === weekNumber - 1)
      .map((row) => getPlayer(row))
  );
  const riserEntries = scoreEntries
    .map((entry) => {
      if (!playedPrevWeek.has(entry.name)) return null;
      const prev = prevWeekScores.get(entry.name);
      if (prev === undefined) return null;
      return { name: entry.name, value: entry.value - prev };
    })
    .filter((e): e is { name: string; value: number } => !!e && e.value > 0);

  if (riserEntries.length) {
    const { winners, value } = pickLeaders(riserEntries);
    badges.push({
      id: "biggest-riser",
      icon: "📈",
      title: "Biggest Riser",
      description: "Biggest jump in weekly score vs. last week (must have played both weeks).",
      winners,
      display: value !== null ? `+${formatValue(value, 0)} pts` : "",
    });
  }

  const byPlayer = new Map<string, { ppr: number[]; oppr: number[]; fourBaggers: number; rounds: number }>();
  for (const row of validWeekRows) {
    const name = getPlayer(row);
    if (!byPlayer.has(name)) byPlayer.set(name, { ppr: [], oppr: [], fourBaggers: 0, rounds: 0 });
    const bucket = byPlayer.get(name)!;
    const ppr = numberVal(getStatValue(row, ["PPR"]));
    const oppr = numberVal(getStatValue(row, ["OPPR"]));
    if (ppr) bucket.ppr.push(ppr);
    if (oppr) bucket.oppr.push(oppr);
    bucket.fourBaggers += numberVal(getStatValue(row, ["4 Baggers"]));
    bucket.rounds += numberVal(getStatValue(row, ["Rounds"]));
  }

  const avg = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : NaN);

  const pprWeekEntries = Array.from(byPlayer.entries())
    .map(([name, b]) => ({ name, value: avg(b.ppr) }))
    .filter((e) => Number.isFinite(e.value));
  {
    const { winners, value } = pickLeaders(pprWeekEntries);
    badges.push({
      id: "sharpshooter-week",
      icon: "🎯",
      title: "Sharpshooter of the Week",
      description: "Highest scoring average this week.",
      winners,
      display: value !== null ? `${value.toFixed(2)} PPR` : "",
    });
  }

  const opprWeekEntries = Array.from(byPlayer.entries())
    .map(([name, b]) => ({ name, value: avg(b.oppr) }))
    .filter((e) => Number.isFinite(e.value));
  {
    const { winners, value } = pickLeaders(opprWeekEntries, true);
    badges.push({
      id: "lockdown-week",
      icon: "🧱",
      title: "Lockdown Defense",
      description: "Held opponents to the fewest points per round this week.",
      winners,
      display: value !== null ? `${value.toFixed(2)} OPPR allowed` : "",
    });
  }

  const baggerWeekEntries = Array.from(byPlayer.entries())
    .map(([name, b]) => ({ name, value: b.fourBaggers }))
    .filter((e) => e.value > 0);
  {
    const { winners, value } = pickLeaders(baggerWeekEntries);
    badges.push({
      id: "bag-frenzy",
      icon: "💣",
      title: "4-Bagger Frenzy",
      description: "Most 4-baggers thrown this week.",
      winners,
      display: value !== null ? `${Math.round(value)} 4-baggers` : "",
    });
  }

  const grinderEntries = Array.from(byPlayer.entries())
    .map(([name, b]) => ({ name, value: b.rounds }))
    .filter((e) => e.value > 0);
  {
    const { winners, value } = pickLeaders(grinderEntries);
    badges.push({
      id: "grinder",
      icon: "🥵",
      title: "Grinder",
      description: "Most rounds played this week.",
      winners,
      display: value !== null ? `${Math.round(value)} rounds` : "",
    });
  }

  const historyByPlayer = new Map<string, { week: number; ppr: number }[]>();
  for (const row of allWeeklyForSeason) {
    const name = getPlayer(row);
    if (!isValidPlayerName(name)) continue;
    const wn = numberVal(getWeek(row));
    const ppr = numberVal(getStatValue(row, ["PPR"]));
    if (!wn || !ppr) continue;
    if (!historyByPlayer.has(name)) historyByPlayer.set(name, []);
    historyByPlayer.get(name)!.push({ week: wn, ppr });
  }

  const personalBests: string[] = [];
  for (const [name, bucket] of historyByPlayer) {
    const thisWeek = byPlayer.get(name);
    if (!thisWeek || !thisWeek.ppr.length) continue;
    const priorWeeks = bucket.filter((b) => b.week < weekNumber);
    if (!priorWeeks.length) continue;
    const thisWeekPPR = avg(thisWeek.ppr);
    const priorMax = Math.max(...priorWeeks.map((b) => b.ppr));
    if (thisWeekPPR > priorMax) personalBests.push(name);
  }

  if (personalBests.length) {
    badges.push({
      id: "personal-best",
      icon: "🌟",
      title: "Personal Best",
      description: "Set a new season-high PPR this week.",
      winners: personalBests,
      display: "New high!",
    });
  }

  return badges;
}

function sumBestScores(scores: number[], count = 9) {
  return [...scores].sort((a, b) => b - a).slice(0, count).reduce((acc, value) => acc + value, 0);
}

function highestScore(scores: number[]) {
  return scores.length ? Math.max(...scores) : 0;
}

function buildPlayerWeekScores(rows: any[], playerName: string, scenarioWeek: string, projectedValue?: string) {
  const byWeek = new Map<number, number>();

  for (const row of rows) {
    if (getPlayer(row) !== playerName) continue;
    const weekNumber = numberVal(row.WeekNumber || getWeek(row));
    if (!weekNumber) continue;
    byWeek.set(weekNumber, numberVal(row.Score));
  }

  const scenarioWeekNumber = numberVal(scenarioWeek);
  if (scenarioWeekNumber && projectedValue !== undefined && projectedValue !== "") {
    byWeek.set(scenarioWeekNumber, numberVal(projectedValue));
  }

  return Array.from(byWeek.values());
}

function getCurrentRank(standings: { name: string; points: number }[], playerName: string) {
  const index = standings.findIndex((row) => row.name === playerName);
  return index >= 0 ? index + 1 : null;
}

// Gold/silver/bronze treatment for the top 3 spots on a leaderboard. Ranks
// below 3 get no special styling.
function podiumStyle(rank: number) {
  if (rank === 1) {
    return {
      medal: "🥇",
      rowClass: "border-yellow-400/50 bg-gradient-to-r from-yellow-400/15 via-transparent to-transparent",
      textClass: "text-yellow-300",
    };
  }
  if (rank === 2) {
    return {
      medal: "🥈",
      rowClass: "border-slate-300/40 bg-gradient-to-r from-slate-300/10 via-transparent to-transparent",
      textClass: "text-slate-200",
    };
  }
  if (rank === 3) {
    return {
      medal: "🥉",
      rowClass: "border-amber-600/40 bg-gradient-to-r from-amber-600/15 via-transparent to-transparent",
      textClass: "text-amber-500",
    };
  }
  return { medal: null, rowClass: "", textClass: "text-[#f04a22]" };
}

// Turns a timestamp into "3 minutes ago" style text. Falls back to a plain
// date/time once it's more than a day old, since "37 hours ago" stops being
// useful.
function formatRelativeTime(dateString?: string) {
  if (!dateString) return "No upload date found";
  const then = new Date(dateString).getTime();
  if (Number.isNaN(then)) return "No upload date found";

  const seconds = Math.round((Date.now() - then) / 1000);
  if (seconds < 15) return "just now";
  if (seconds < 60) return `${seconds} seconds ago`;

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;

  const days = Math.round(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;

  return new Date(dateString).toLocaleString();
}

// Keeps its own tick so "X minutes ago" advances on its own without needing
// the whole page to re-render.
function LastUpdated({ value }: { value?: string }) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick((n) => n + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="text-sm text-neutral-400" title={value ? new Date(value).toLocaleString() : undefined}>
      Last updated: {formatRelativeTime(value)}
    </div>
  );
}

// Smoothly animates between a stat's previous and next value instead of it
// just popping to the new number whenever a filter/season/player selection
// changes. `target` is null for anything non-numeric (a name, a "-"
// placeholder) -- callers simply don't animate those.
function useCountUp(target: number | null, duration = 700) {
  const [display, setDisplay] = useState(target ?? 0);
  const fromRef = useRef(target ?? 0);

  useEffect(() => {
    if (target === null) return;
    const from = fromRef.current;
    const to = target;
    if (from === to) {
      setDisplay(to);
      return;
    }
    let frame: number;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(from + (to - from) * eased);
      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);

  return display;
}

// Parses an already-formatted stat ("8.52", "4784", "37.16%") back into a
// number + decimals + suffix so it can be animated and re-rendered looking
// identical to the static version. Returns null for anything that isn't a
// plain formatted number (a player's name, a "-" placeholder), so callers
// know to just render the value as-is with no animation.
function parseAnimatable(value: any) {
  const raw = String(value ?? "").trim();
  const match = raw.match(/^(-?\d+(?:\.\d+)?)(%?)$/);
  if (!match) return null;
  const numeric = match[1];
  const dot = numeric.indexOf(".");
  const decimals = dot === -1 ? 0 : numeric.length - dot - 1;
  return { target: Number(numeric), decimals, suffix: match[2] };
}

function AnimatedNumber({ value }: { value: any }) {
  const parsed = parseAnimatable(value);
  const animated = useCountUp(parsed ? parsed.target : null);
  if (!parsed) return <>{value}</>;
  return (
    <>
      {animated.toFixed(parsed.decimals)}
      {parsed.suffix}
    </>
  );
}

export default function LeagueClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [data, setData] = useState<Data | null>(null);
  const [tab, setTab] = useState<Tab>("dashboard");
  const [season, setSeason] = useState("");
  const [player, setPlayer] = useState("All Players");
  const [dashboardWeek, setDashboardWeek] = useState("All Weeks");
  const [type, setType] = useState<"Blind" | "Swap">("Blind");
  const [week, setWeek] = useState("");
  const [profileSeason, setProfileSeason] = useState("All Seasons");
  const [profileWeek, setProfileWeek] = useState("All Weeks");
  const [profileType, setProfileType] = useState<EventFilter>("All");
  const [compareA, setCompareA] = useState("");
  const [compareB, setCompareB] = useState("");
  const [sortKey, setSortKey] = useState("Total Pts");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [selectedStatsPlayers, setSelectedStatsPlayers] = useState<string[]>([]);
  const [statsPlayerFilter, setStatsPlayerFilter] = useState("");
  const [scenarioWeek, setScenarioWeek] = useState("Week 12");
  const [scenarioInputs, setScenarioInputs] = useState<Record<string, string>>({});
  const [careerSortKey, setCareerSortKey] = useState("totalPts");
  const [careerSortDirection, setCareerSortDirection] = useState<SortDirection>("desc");
  const [urlReady, setUrlReady] = useState(false);

  useEffect(() => {
    fetch("/api/data")
      .then((res) => res.json())
      .then((loaded) => {
        const seasons = loaded.seasons || [];
        const latestSeason = seasons[seasons.length - 1] || "";
        const validPlayers = (loaded.players || []).filter(isValidPlayerName);

        setData(loaded);

        // A shared/bookmarked link (?player=jim-mateunas&tab=players&season=...)
        // takes priority over the defaults so it lands exactly where it was shared from.
        const urlSeason = searchParams.get("season");
        const urlTab = searchParams.get("tab");
        const urlPlayerSlug = searchParams.get("player");
        const matchedPlayer = urlPlayerSlug ? findPlayerBySlug(validPlayers, urlPlayerSlug) : "";

        setSeason(urlSeason && seasons.includes(urlSeason) ? urlSeason : latestSeason);

        if (matchedPlayer) {
          setPlayer(matchedPlayer);
          setProfileSeason("All Seasons");
          setTab("players");
        } else {
          if (urlTab && (TAB_IDS as string[]).includes(urlTab)) setTab(urlTab as Tab);
          setProfileSeason(latestSeason);
        }

        setUrlReady(true);
      });
    // Only ever runs once on mount to read the initial URL -- afterwards the
    // effect below is the one source of truth writing the URL back out.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keeps the URL in sync with the current view so any state (season, tab, a
  // selected player) can be copied/bookmarked/shared and land back in the
  // same place. Guarded by urlReady so this doesn't fire (and clobber the
  // just-parsed URL) before the initial load above has had a chance to read it.
  useEffect(() => {
    if (!urlReady) return;
    const params = new URLSearchParams();
    params.set("tab", tab);
    if (season) params.set("season", season);
    if (player !== "All Players") params.set("player", slugify(player));
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [tab, season, player, urlReady, pathname, router]);

  const seasons = useMemo(() => [...(data?.seasons || [])].sort(seasonSort), [data]);
  const players = useMemo(
    () => (data?.players || []).filter(isValidPlayerName).sort((a, b) => a.localeCompare(b)),
    [data]
  );

  const eventStats = data?.eventStats || [];
  const weekScores = data?.weekScores || [];

  const allWeeklyMerged = useMemo(
    () => mergeWeeklyRows(data?.weekly || [], eventStats),
    [data, eventStats]
  );

  const seasonStatsAll = useMemo(
    () => (data?.stats || []).filter((row) => isValidPlayerName(getPlayer(row))),
    [data]
  );

  const selectedSeasonStats = useMemo(
    () => seasonStatsAll.filter((row) => !season || getSeason(row) === season),
    [seasonStatsAll, season]
  );

  // Players who actually appear in the selected season -- pulled from Stats,
  // Standings, and Weekly rows together (rather than just one) so a player
  // never goes missing from the picker just because one of those tabs
  // happened to sync slightly ahead of the others. Falls back to the full
  // roster if data hasn't loaded for a season yet.
  const seasonPlayers = useMemo(() => {
    if (!season) return players;
    const names = new Set<string>();
    for (const row of selectedSeasonStats) names.add(getPlayer(row));
    for (const row of data?.standings || []) {
      if (getSeason(row, season) === season) {
        const name = getPlayer(row);
        if (isValidPlayerName(name)) names.add(name);
      }
    }
    for (const row of allWeeklyMerged) {
      if (getSeason(row) === season) names.add(getPlayer(row));
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [players, selectedSeasonStats, data, season, allWeeklyMerged]);

  // The Players and All-Time tabs are explicitly about a player across (or
  // regardless of) season, so the picker there stays the full roster rather
  // than whoever happened to play in whatever season the top bar has active.
  const playerPickerOptions = tab === "players" || tab === "alltime" ? players : seasonPlayers;

  // If the currently selected player didn't play in whatever season you just
  // switched to, drop back to "All Players" instead of silently showing a
  // player who has nothing to do with this season. Only fires on an actual
  // season *change* (tracked via prevSeasonRef) -- never on the initial load
  // (so a shared profile link still lands correctly), and never while on the
  // Players/All-Time tabs, where a player's selection is season-independent.
  const prevSeasonRef = useRef("");
  useEffect(() => {
    if (!urlReady) return;
    if (prevSeasonRef.current && prevSeasonRef.current !== season) {
      if (tab !== "players" && tab !== "alltime" && player !== "All Players" && !seasonPlayers.includes(player)) {
        setPlayer("All Players");
      }
    }
    prevSeasonRef.current = season;
  }, [season, seasonPlayers, urlReady, player, tab]);

  const dashboardStandings = useMemo(() => {
    if (dashboardWeek === "All Weeks") {
      return (data?.standings || [])
        .filter((row) => isValidPlayerName(getPlayer(row)))
        .filter((row) => !season || getSeason(row, season) === season)
        .filter((row) => player === "All Players" || getPlayer(row) === player)
        .map((row) => ({ name: getPlayer(row), points: pointValue(row), raw: row }))
        .filter((row) => row.name && row.points > 0)
        .sort((a, b) => b.points - a.points);
    }

    const totals = new Map<string, number>();
    for (const row of allWeeklyMerged) {
      if (getSeason(row) !== season) continue;
      if (getWeek(row) !== dashboardWeek) continue;
      if (player !== "All Players" && getPlayer(row) !== player) continue;
      totals.set(getPlayer(row), (totals.get(getPlayer(row)) || 0) + numberVal(row.Points));
    }

    return Array.from(totals.entries())
      .map(([name, points]) => ({ name, points, raw: {} }))
      .filter((row) => isValidPlayerName(row.name) && row.points > 0)
      .sort((a, b) => b.points - a.points);
  }, [data, season, player, dashboardWeek, allWeeklyMerged]);

  const dashboardWeeks = useMemo(() => {
    const values = Array.from(
      new Set(allWeeklyMerged.filter((row) => getSeason(row) === season).map(getWeek).filter(Boolean))
    ).sort(weekSort);
    return ["All Weeks", ...values];
  }, [allWeeklyMerged, season]);

  const weeksRowsForType = useMemo(
    () =>
      allWeeklyMerged.filter((row) => {
        return getSeason(row) === season && getType(row) === type;
      }),
    [allWeeklyMerged, season, type]
  );

  const weeks = useMemo(
    () => Array.from(new Set(weeksRowsForType.map(getWeek).filter(Boolean))).sort(weekSort),
    [weeksRowsForType]
  );

  useEffect(() => {
    if (!week || !weeks.includes(week)) setWeek(weeks[0] || "");
  }, [weeks, week]);

  const visibleWeekRows = useMemo(() => {
    const weekIndex = weeks.indexOf(week);
    const prevWeek = weekIndex > 0 ? weeks[weekIndex - 1] : null;

    const prevRankByPlayer = new Map<string, number>();
    if (prevWeek) {
      for (const row of weeksRowsForType) {
        if (getWeek(row) !== prevWeek) continue;
        const rank = numberVal(row.Rank);
        if (rank) prevRankByPlayer.set(getPlayer(row), rank);
      }
    }

    return weeksRowsForType
      .filter((row) => getWeek(row) === week)
      .filter((row) => player === "All Players" || getPlayer(row) === player)
      .map((row) => {
        const currentRank = numberVal(row.Rank);
        const prevRank = prevRankByPlayer.get(getPlayer(row));
        const rankChange = prevWeek && prevRank && currentRank ? prevRank - currentRank : null;
        return { ...row, RankChange: rankChange };
      })
      .sort((a, b) => numberVal(a.Rank) - numberVal(b.Rank) || getPlayer(a).localeCompare(getPlayer(b)));
  }, [weeksRowsForType, week, weeks, player]);

  const statsTabRows = useMemo(() => {
    const selected = selectedStatsPlayers.length
      ? selectedStatsPlayers
      : player !== "All Players"
      ? [player]
      : [];

    const selectedColumn = statColumns.find((col) => col.label === sortKey);

    return selectedSeasonStats
      .filter((row) => !selected.length || selected.includes(getPlayer(row)))
      .sort((a, b) => {
        if (!selectedColumn) return getPlayer(a).localeCompare(getPlayer(b));
        const av = numberVal(getStatValue(a, selectedColumn.keys));
        const bv = numberVal(getStatValue(b, selectedColumn.keys));
        if (av === bv) return getPlayer(a).localeCompare(getPlayer(b));
        return sortDirection === "asc" ? av - bv : bv - av;
      });
  }, [selectedSeasonStats, selectedStatsPlayers, player, sortKey, sortDirection]);

  const selectedProfilePlayer = player !== "All Players" ? player : "";

  const profileSeasonStats = useMemo(() => {
    if (!selectedProfilePlayer) return [];
    return seasonStatsAll
      .filter((row) => getPlayer(row) === selectedProfilePlayer)
      .filter((row) => profileSeason === "All Seasons" || getSeason(row) === profileSeason)
      .sort((a, b) => seasonSort(getSeason(a), getSeason(b)));
  }, [seasonStatsAll, selectedProfilePlayer, profileSeason]);

  const profileWeeks = useMemo(() => {
    if (!selectedProfilePlayer) return [];
    return Array.from(
      new Set(
        allWeeklyMerged
          .filter((row) => getPlayer(row) === selectedProfilePlayer)
          .filter((row) => profileSeason === "All Seasons" || getSeason(row) === profileSeason)
          .map(getWeek)
          .filter(Boolean)
      )
    ).sort(weekSort);
  }, [allWeeklyMerged, selectedProfilePlayer, profileSeason]);

  const profileWeeklyRows = useMemo(() => {
    if (!selectedProfilePlayer) return [];
    return allWeeklyMerged
      .filter((row) => getPlayer(row) === selectedProfilePlayer)
      .filter((row) => profileSeason === "All Seasons" || getSeason(row) === profileSeason)
      .filter((row) => profileWeek === "All Weeks" || getWeek(row) === profileWeek)
      .filter((row) => profileType === "All" || getType(row) === profileType)
      .sort((a, b) => seasonSort(getSeason(a), getSeason(b)) || weekSort(getWeek(a), getWeek(b)) || getType(a).localeCompare(getType(b)));
  }, [allWeeklyMerged, selectedProfilePlayer, profileSeason, profileWeek, profileType]);

  const groupedProfileWeeks = useMemo(() => {
    const groups: Record<string, any[]> = {};
    for (const row of profileWeeklyRows) {
      const key = `${getSeason(row)} - ${getWeek(row)} - ${getType(row)}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(row);
    }
    return Object.entries(groups);
  }, [profileWeeklyRows]);

  const progressData = profileSeasonStats.map((row) => ({
    season: getSeason(row),
    PPR: numberVal(getStatValue(row, ["Average PPR", "PPR"])),
    DPR: numberVal(getStatValue(row, ["Average DPR", "DPR"])),
  }));


  const scenarioSeasonScores = useMemo(
    () => weekScores.filter((row) => getSeason(row) === season && isValidPlayerName(getPlayer(row))),
    [weekScores, season]
  );

  const scenarioWeeks = useMemo(() => {
    const values = Array.from(new Set(scenarioSeasonScores.map((row) => getWeek(row)).filter(Boolean))).sort(weekSort);
    return values.length ? values : ["Week 12"];
  }, [scenarioSeasonScores]);

  useEffect(() => {
    if (!scenarioWeeks.includes(scenarioWeek)) setScenarioWeek(scenarioWeeks[scenarioWeeks.length - 1] || "Week 12");
  }, [scenarioWeeks, scenarioWeek]);

  const pprByPlayer = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of selectedSeasonStats) map.set(getPlayer(row), numberVal(getStatValue(row, ["Average PPR", "PPR"])));
    return map;
  }, [selectedSeasonStats]);

  const scenarioRows = useMemo(() => {
    return players
      .map((name) => {
        const currentScores = buildPlayerWeekScores(scenarioSeasonScores, name, scenarioWeek);
        const projectedScores = buildPlayerWeekScores(scenarioSeasonScores, name, scenarioWeek, scenarioInputs[name]);
        const currentTotal = sumBestScores(currentScores, 9);
        const projectedTotal = sumBestScores(projectedScores, 9);
        const projectedScore = scenarioInputs[name] ?? "";
        const ppr = pprByPlayer.get(name) || 0;
        const currentRank = getCurrentRank(dashboardStandings, name);

        return {
          name,
          currentRank,
          currentTotal,
          lowestCounted: [...currentScores].sort((a, b) => b - a)[8] ?? 0,
          projectedScore,
          netGain: projectedTotal - currentTotal,
          projectedTotal,
          highestWeek: highestScore(projectedScores),
          ppr,
        };
      })
      .filter((row) => row.currentTotal > 0 || row.projectedScore !== "")
      .sort((a, b) => {
        if (b.projectedTotal !== a.projectedTotal) return b.projectedTotal - a.projectedTotal;
        if (b.highestWeek !== a.highestWeek) return b.highestWeek - a.highestWeek;
        return b.ppr - a.ppr;
      })
      .map((row, index) => ({ ...row, projectedRank: index + 1 }));
  }, [players, scenarioSeasonScores, scenarioWeek, scenarioInputs, pprByPlayer, dashboardStandings]);

  const scenarioSelectedPlayer = player !== "All Players" ? player : scenarioRows[0]?.name || "";
  const selectedScenario = scenarioRows.find((row) => row.name === scenarioSelectedPlayer);

  const statA = seasonStatsAll.find((row) => getPlayer(row) === compareA && getSeason(row) === season);
  const statB = seasonStatsAll.find((row) => getPlayer(row) === compareB && getSeason(row) === season);

  const careerColumns = [
    { key: "seasonsPlayed", label: "Seasons", decimals: 0 },
    { key: "totalRounds", label: "Total Rounds", decimals: 0 },
    { key: "totalPts", label: "Total Pts", decimals: 0 },
    { key: "avgPPR", label: "Avg PPR", decimals: 2 },
    { key: "avgOPPR", label: "Opp Avg PPR", decimals: 2 },
    { key: "avgDPR", label: "Avg DPR", decimals: 2 },
    { key: "bagsOnPct", label: "Bags On %", decimals: 2 },
    { key: "avgBagsInPerRd", label: "Avg Bags In/Rd", decimals: 2 },
    { key: "avgBaggerPct", label: "Avg 4-Bagger %", decimals: 2 },
    { key: "total4Baggers", label: "Total 4-Baggers", decimals: 0 },
    { key: "totalBags", label: "Total Bags", decimals: 0 },
    { key: "totalFirsts", label: "1st in Stats", decimals: 0 },
  ];

  const careerRows = useMemo(() => aggregateCareerStats(seasonStatsAll), [seasonStatsAll]);

  const sortedCareerRows = useMemo(() => {
    return [...careerRows].sort((a, b) => {
      const av = Number((a as any)[careerSortKey]) || 0;
      const bv = Number((b as any)[careerSortKey]) || 0;
      if (av === bv) return a.name.localeCompare(b.name);
      return careerSortDirection === "asc" ? av - bv : bv - av;
    });
  }, [careerRows, careerSortKey, careerSortDirection]);

  const MIN_CAREER_ROUNDS_FOR_RATE_LEADERS = 200;
  const careerLeaders = useMemo(() => {
    const eligibleForRates = careerRows.filter((r) => r.totalRounds >= MIN_CAREER_ROUNDS_FOR_RATE_LEADERS);
    const top = (rows: typeof careerRows, key: keyof (typeof careerRows)[number], n = 3) =>
      [...rows].sort((a, b) => (Number(b[key]) || 0) - (Number(a[key]) || 0)).slice(0, n);

    return {
      "Career Points": { rows: top(careerRows, "totalPts"), key: "totalPts" as const, decimals: 0 },
      "Career PPR": { rows: top(eligibleForRates, "avgPPR"), key: "avgPPR" as const, decimals: 2 },
      "Career 4-Baggers": { rows: top(careerRows, "total4Baggers"), key: "total4Baggers" as const, decimals: 0 },
    };
  }, [careerRows]);

  // Badges tab: season-long badges recompute from whatever's uploaded so far
  // for the selected season, and weekly badges are scoped to one week at a
  // time (defaulting to the most recent) so there's a reason to check back
  // after every week's results go up.
  const allWeeklyForSeason = useMemo(
    () => allWeeklyMerged.filter((row) => getSeason(row) === season),
    [allWeeklyMerged, season]
  );

  const priorSeason = useMemo(() => {
    const index = seasons.indexOf(season);
    return index > 0 ? seasons[index - 1] : "";
  }, [seasons, season]);

  const priorSeasonStats = useMemo(
    () => (priorSeason ? seasonStatsAll.filter((row) => getSeason(row) === priorSeason) : []),
    [seasonStatsAll, priorSeason]
  );

  const careerByName = useMemo(() => new Map(careerRows.map((row) => [row.name, row])), [careerRows]);

  const seasonBadges = useMemo(
    () => computeSeasonBadges(selectedSeasonStats, allWeeklyForSeason, priorSeasonStats, careerByName),
    [selectedSeasonStats, allWeeklyForSeason, priorSeasonStats, careerByName]
  );

  const badgeWeeks = useMemo(() => dashboardWeeks.filter((w) => w !== "All Weeks"), [dashboardWeeks]);
  const [badgeWeek, setBadgeWeek] = useState("");

  useEffect(() => {
    if (!badgeWeek || !badgeWeeks.includes(badgeWeek)) setBadgeWeek(badgeWeeks[badgeWeeks.length - 1] || "");
  }, [badgeWeeks, badgeWeek]);

  const weeklyRowsForBadgeWeek = useMemo(
    () => allWeeklyForSeason.filter((row) => getWeek(row) === badgeWeek),
    [allWeeklyForSeason, badgeWeek]
  );

  const weeklyBadges = useMemo(
    () =>
      badgeWeek ? computeWeeklyBadges(weeklyRowsForBadgeWeek, scenarioSeasonScores, numberVal(badgeWeek), allWeeklyForSeason) : [],
    [weeklyRowsForBadgeWeek, scenarioSeasonScores, badgeWeek, allWeeklyForSeason]
  );

  const shareUrl =
    typeof window !== "undefined" && selectedProfilePlayer
      ? `${window.location.origin}${pathname}?tab=players&player=${slugify(selectedProfilePlayer)}`
      : "";

  if (!data) {
    return <LoadingSkeleton />;
  }

  const navItems: { id: Tab; label: string }[] = [
    { id: "dashboard", label: "Dashboard" },
    { id: "standings", label: "Standings" },
    { id: "weeks", label: "Weeks" },
    { id: "stats", label: "Stats" },
    { id: "alltime", label: "All-Time" },
    { id: "badges", label: "Badges" },
    { id: "players", label: "Players" },
    { id: "scenarios", label: "Scenarios" },
    { id: "compare", label: "Compare" },
    { id: "store", label: "Store" },
  ];

  return (
    <main className="min-h-screen bg-[#070707] pb-24 text-white">
      <header className="border-b border-[#2a2a2a] bg-gradient-to-r from-black via-[#151515] to-[#f04a22]/20">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <img src="/ec-logo.png" alt="Empire Cornhole" className="h-16 w-20 rounded-xl bg-white object-contain p-1" />
            <div>
              <h1 className="text-3xl font-black tracking-tight">League Stats</h1>
              <p className="text-sm text-neutral-300">Empire Cornhole standings, weekly results, and player stats.</p>
            </div>
          </div>

          <div className="hidden flex-wrap gap-2 md:flex">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
                className={`rounded-full px-4 py-2 text-sm font-bold ${tab === item.id ? "bg-[#f04a22] text-white" : "bg-neutral-900 text-neutral-300 hover:bg-neutral-800"}`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {tab !== "store" && (
        <section className="sticky top-0 z-20 mx-auto max-w-7xl bg-[#070707]/95 p-4 backdrop-blur supports-[backdrop-filter]:bg-[#070707]/85">
          <div className="rounded-2xl border border-neutral-800 bg-[#141414] p-4 shadow-xl">
            <div className="flex flex-col gap-3 md:flex-row md:items-end">
              <div>
                <label className="text-xs font-bold uppercase text-[#f04a22]">Season</label>
                <select
                  className="block rounded-lg border border-neutral-700 bg-[#242424] p-2 text-white"
                  value={season}
                  onChange={(e) => {
                    setSeason(e.target.value);
                    setDashboardWeek("All Weeks");
                  }}
                >
                  {seasons.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div className="w-full md:w-64">
                <label className="text-xs font-bold uppercase text-[#f04a22]">Player</label>
                <PlayerCombobox players={playerPickerOptions} value={player} onChange={setPlayer} allLabel="All Players" />
              </div>

              <div>
                <label className="text-xs font-bold uppercase text-[#f04a22]">Dashboard Week</label>
                <select className="block rounded-lg border border-neutral-700 bg-[#242424] p-2 text-white" value={dashboardWeek} onChange={(e) => setDashboardWeek(e.target.value)}>
                  {dashboardWeeks.map((w) => (
                    <option key={w}>{w}</option>
                  ))}
                </select>
              </div>

              <LastUpdated value={data.lastUpdated} />
            </div>
          </div>
        </section>
      )}

      <section className="mx-auto max-w-7xl space-y-6 p-4">
        {/* Keying on `tab` remounts this wrapper on every switch, which
           re-triggers the fadeSlideIn animation -- a cheap way to get a
           transition between tabs without a full animation library. */}
        <div key={tab} className="tab-transition space-y-6">
        {tab === "dashboard" && (
          <>
            <Card title="Top Standings">
              <RankedList rows={dashboardStandings.slice(0, 20)} />
            </Card>

            <Card title={`${season} League Overview`}>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {summarizeSeasonStats(selectedSeasonStats).map((item) => (
                  <MiniStat key={item.label} label={item.label} value={item.value} />
                ))}
              </div>
              <p className="mt-4 text-sm text-neutral-400">Individual player stat tables are now under the Stats tab.</p>
            </Card>
          </>
        )}

        {tab === "standings" && (
          <Card title="Season Standings">
            <StandingsTable rows={dashboardStandings} />
          </Card>
        )}

        {tab === "weeks" && (
          <Card title="Weekly Results">
            <div className="mb-4 flex flex-wrap gap-3">
              <select className="rounded-lg bg-[#242424] p-2" value={type} onChange={(e) => { setType(e.target.value as "Blind" | "Swap"); setWeek(""); }}>
                <option>Blind</option>
                <option>Swap</option>
              </select>

              <select className="rounded-lg bg-[#242424] p-2" value={week} onChange={(e) => setWeek(e.target.value)}>
                {weeks.map((w) => (
                  <option key={w}>{w}</option>
                ))}
              </select>
            </div>

            <h3 className="mb-2 text-lg font-black text-[#f04a22]">Standings</h3>
            <WeeklyTable rows={visibleWeekRows} />
            <EventSummary rows={visibleWeekRows} />
          </Card>
        )}

        {tab === "stats" && (
          <Card title="Season Stats">
            <div className="mb-4 space-y-3">
              <div>
                <div className="mb-2 text-sm font-bold text-neutral-300">Multi-select players for this tab</div>
                <input
                  className="mb-2 w-full rounded-lg border border-neutral-700 bg-[#242424] p-2 text-sm text-white"
                  placeholder="Filter players..."
                  value={statsPlayerFilter}
                  onChange={(e) => setStatsPlayerFilter(e.target.value)}
                />
                <div className="grid max-h-56 gap-2 overflow-y-auto rounded-xl border border-neutral-800 bg-[#101010] p-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                  {seasonPlayers.filter((p) => p.toLowerCase().includes(statsPlayerFilter.toLowerCase())).map((p) => (
                    <label key={p} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={selectedStatsPlayers.includes(p)}
                        onChange={(e) => {
                          setSelectedStatsPlayers((current) =>
                            e.target.checked ? [...current, p] : current.filter((name) => name !== p)
                          );
                        }}
                      />
                      <span>{p}</span>
                    </label>
                  ))}
                </div>
                {selectedStatsPlayers.length > 0 && (
                  <button className="mt-2 rounded-lg bg-[#242424] px-3 py-2 text-sm font-bold" onClick={() => setSelectedStatsPlayers([])}>
                    Clear multi-select
                  </button>
                )}
              </div>
            </div>

            <StatsTable
              rows={statsTabRows}
              sortKey={sortKey}
              sortDirection={sortDirection}
              onSort={(key) => {
                if (sortKey === key) setSortDirection(sortDirection === "asc" ? "desc" : "asc");
                else {
                  setSortKey(key);
                  setSortDirection("desc");
                }
              }}
            />
          </Card>
        )}

        {tab === "alltime" && (
          <>
            <Card title="All-Time Leaders">
              <p className="mb-4 text-sm text-neutral-400">
                Career totals across every season on record. PPR leaders require at least {MIN_CAREER_ROUNDS_FOR_RATE_LEADERS} career
                rounds played so a short cameo season can&apos;t top the list.
              </p>
              <div className="grid gap-4 md:grid-cols-3">
                {Object.entries(careerLeaders).map(([label, { rows, key, decimals }]) => (
                  <div key={label} className="rounded-xl border border-neutral-800 bg-[#101010] p-4">
                    <div className="mb-2 text-xs font-bold uppercase text-[#f04a22]">{label}</div>
                    <div className="space-y-1">
                      {rows.length === 0 && <div className="text-sm text-neutral-500">Not enough data yet</div>}
                      {rows.map((row, index) => (
                        <div key={row.name} className="flex items-center justify-between text-sm">
                          <span className="font-bold">
                            {index + 1}. {row.name}
                          </span>
                          <span className="text-neutral-300">{formatValue((row as any)[key], decimals)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card title="Career Stats — All Players">
              <CareerStatsTable
                rows={sortedCareerRows}
                columns={careerColumns}
                sortKey={careerSortKey}
                sortDirection={careerSortDirection}
                highlightPlayer={selectedProfilePlayer}
                onSort={(key) => {
                  if (careerSortKey === key) setCareerSortDirection(careerSortDirection === "asc" ? "desc" : "asc");
                  else {
                    setCareerSortKey(key);
                    setCareerSortDirection("desc");
                  }
                }}
              />
            </Card>
          </>
        )}

        {tab === "badges" && (
          <>
            <Card title={`${season} Season Badges`}>
              <p className="mb-4 text-sm text-neutral-400">
                Auto-awarded from this season&apos;s stats so far — these can change hands as more weeks get added, right up
                until the season wraps up.
              </p>
              <BadgeGrid badges={seasonBadges} highlightPlayer={selectedProfilePlayer} />
            </Card>

            <Card title="Weekly Badges">
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <label className="text-xs font-bold uppercase text-[#f04a22]">Week</label>
                <select className="rounded-lg bg-[#242424] p-2" value={badgeWeek} onChange={(e) => setBadgeWeek(e.target.value)}>
                  {badgeWeeks.map((w) => (
                    <option key={w}>{w}</option>
                  ))}
                </select>
              </div>
              <BadgeGrid badges={weeklyBadges} highlightPlayer={selectedProfilePlayer} />
            </Card>
          </>
        )}

        {tab === "players" && (
          <Card
            title={selectedProfilePlayer ? `${selectedProfilePlayer} Profile` : "Player Profile"}
            actions={selectedProfilePlayer && shareUrl ? <ShareButton url={shareUrl} /> : undefined}
          >
            {!selectedProfilePlayer ? (
              <p className="text-neutral-400">Choose a player from the top Player dropdown to view their profile.</p>
            ) : (
              <div className="space-y-6">
                <div className="flex flex-wrap gap-3">
                  <select className="rounded-lg bg-[#242424] p-2" value={profileSeason} onChange={(e) => { setProfileSeason(e.target.value); setProfileWeek("All Weeks"); }}>
                    <option>All Seasons</option>
                    {seasons.map((s) => <option key={s}>{s}</option>)}
                  </select>
                  <select className="rounded-lg bg-[#242424] p-2" value={profileWeek} onChange={(e) => setProfileWeek(e.target.value)}>
                    <option>All Weeks</option>
                    {profileWeeks.map((w) => <option key={w}>{w}</option>)}
                  </select>
                  <select className="rounded-lg bg-[#242424] p-2" value={profileType} onChange={(e) => setProfileType(e.target.value as EventFilter)}>
                    <option>All</option>
                    <option>Blind</option>
                    <option>Swap</option>
                  </select>
                </div>

                {profileSeason === "All Seasons" ? (
                  <CareerStatsSummary
                    row={careerRows.find((r) => r.name === selectedProfilePlayer)}
                    columns={careerColumns}
                  />
                ) : (
                  <PlayerStatsSummary row={profileSeasonStats[profileSeasonStats.length - 1]} />
                )}

                <div>
                  <h3 className="mb-3 text-lg font-black text-[#f04a22]">Season Finishes</h3>
                  <SeasonFinishesTable rows={profileSeasonStats} />
                </div>

                <div>
                  <h3 className="mb-3 text-lg font-black text-[#f04a22]">Progress Over Time</h3>
                  <div className="h-72 rounded-xl border border-neutral-800 p-3">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={progressData}>
                        <XAxis dataKey="season" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="DPR" stroke="#ffffff" strokeWidth={3} />
                        <Line type="monotone" dataKey="PPR" stroke="#f04a22" strokeWidth={3} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div>
                  <h3 className="mb-3 text-lg font-black text-[#f04a22]">Weekly Breakdown</h3>
                  <div className="space-y-4">
                    {groupedProfileWeeks.map(([label, rows]) => (
                      <div key={label} className="rounded-xl border border-neutral-800 bg-[#1c1c1c] p-4">
                        <h4 className="mb-3 text-xl font-black">{label}</h4>
                        <WeeklyTable rows={rows} />
                        <EventSummary rows={rows} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </Card>
        )}

        {tab === "scenarios" && (
          <Card title="Final Week Scenarios">
            <div className="mb-4 rounded-xl border border-neutral-800 bg-[#202020] p-4 text-sm text-neutral-300">
              Enter a projected combined weekly score for the selected week. The calculator keeps each player's best 9 scores and ranks ties by highest single week, then season PPR.
            </div>

            <div className="mb-4 flex flex-wrap gap-3">
              <select className="rounded-lg bg-[#242424] p-2" value={scenarioWeek} onChange={(e) => setScenarioWeek(e.target.value)}>
                {scenarioWeeks.map((w) => <option key={w}>{w}</option>)}
              </select>
              <button className="rounded-lg bg-[#242424] px-3 py-2 text-sm font-bold" onClick={() => setScenarioInputs({})}>
                Clear projected scores
              </button>
            </div>

            {selectedScenario && (
              <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <MiniStat label="Selected Player" value={selectedScenario.name} />
                <MiniStat label="Current Rank" value={selectedScenario.currentRank || "-"} />
                <MiniStat label="Current Points" value={formatValue(selectedScenario.currentTotal, 0)} />
                <MiniStat label="Projected Rank" value={selectedScenario.projectedRank} />
                <MiniStat label="Projected Points" value={formatValue(selectedScenario.projectedTotal, 0)} />
              </div>
            )}

            <ScenarioTable
              rows={scenarioRows}
              inputs={scenarioInputs}
              setInputs={setScenarioInputs}
              selectedPlayer={scenarioSelectedPlayer}
            />
          </Card>
        )}

        {tab === "compare" && (
          <Card title="Compare Players">
            <div className="mb-4 flex flex-wrap gap-3">
              <div className="w-full sm:w-64">
                <PlayerCombobox players={seasonPlayers} value={compareA} onChange={setCompareA} placeholder="Player A" />
              </div>
              <div className="w-full sm:w-64">
                <PlayerCombobox players={seasonPlayers} value={compareB} onChange={setCompareB} placeholder="Player B" />
              </div>
            </div>
            <CompareTable statA={statA} statB={statB} />
          </Card>
        )}

        {tab === "store" && <StoreTab />}
        </div>
      </section>

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-neutral-800 bg-black/95 p-2 md:hidden">
        <div className="grid grid-cols-4 gap-1">
          {navItems.map((item) => (
            <button key={item.id} onClick={() => setTab(item.id)} className={`rounded-lg px-1 py-3 text-[11px] font-bold ${tab === item.id ? "bg-[#f04a22]" : "bg-[#1d1d1d]"}`}>
              {item.label}
            </button>
          ))}
        </div>
      </nav>
    </main>
  );
}

function Card({ title, actions, children }: { title: string; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-neutral-800 bg-[#141414] p-4 shadow-xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-black">{title}</h2>
        {actions}
      </div>
      {children}
    </section>
  );
}

// Searchable player picker -- a plain <select> with 100+ alphabetical names is
// painful to scroll through on a phone, so this is a text input that filters
// as you type and falls back to showing the current value when closed.
function PlayerCombobox({
  players,
  value,
  onChange,
  allLabel,
  placeholder = "Search players...",
}: {
  players: string[];
  value: string;
  onChange: (value: string) => void;
  allLabel?: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const options = allLabel ? [allLabel, ...players] : players;
  const filtered = query ? options.filter((p) => p.toLowerCase().includes(query.toLowerCase())) : options;

  return (
    <div ref={containerRef} className="relative">
      <input
        className="block w-full rounded-lg border border-neutral-700 bg-[#242424] p-2 text-white"
        value={open ? query : value}
        placeholder={value ? undefined : placeholder}
        onFocus={() => {
          setOpen(true);
          setQuery("");
        }}
        onChange={(e) => setQuery(e.target.value)}
      />
      {open && (
        <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-neutral-700 bg-[#1c1c1c] shadow-xl">
          {filtered.length === 0 && <div className="p-3 text-sm text-neutral-500">No players found</div>}
          {filtered.map((p) => (
            <button
              type="button"
              key={p}
              className={`block w-full px-3 py-2 text-left text-sm hover:bg-[#f04a22]/20 ${
                p === value ? "bg-[#f04a22]/10 text-[#f04a22]" : "text-white"
              }`}
              onClick={() => {
                onChange(p);
                setOpen(false);
                setQuery("");
              }}
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Gray placeholder boxes shaped like the real page, shown while the season's
// data is loading client-side. Replaces the old plain "Loading..." text so
// the first impression of the site feels finished rather than broken.
function LoadingSkeleton() {
  return (
    <main className="min-h-screen animate-pulse bg-[#070707] pb-24 text-white">
      <header className="border-b border-[#2a2a2a] bg-gradient-to-r from-black via-[#151515] to-[#f04a22]/20">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="h-16 w-20 rounded-xl bg-neutral-800" />
            <div className="space-y-2">
              <div className="h-6 w-40 rounded bg-neutral-800" />
              <div className="h-4 w-64 rounded bg-neutral-800" />
            </div>
          </div>
          <div className="hidden flex-wrap gap-2 md:flex">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-9 w-24 rounded-full bg-neutral-800" />
            ))}
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl p-4">
        <div className="rounded-2xl border border-neutral-800 bg-[#141414] p-4 shadow-xl">
          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="h-3 w-16 rounded bg-neutral-800" />
                <div className="h-10 w-40 rounded-lg bg-neutral-800" />
              </div>
            ))}
            <div className="h-4 w-32 rounded bg-neutral-800" />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl space-y-6 p-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl border border-neutral-800 bg-[#101010] p-4">
              <div className="h-3 w-20 rounded bg-neutral-800" />
              <div className="mt-3 h-8 w-16 rounded bg-neutral-800" />
            </div>
          ))}
        </div>

        <div className="space-y-2 rounded-xl border border-neutral-800 bg-[#101010] p-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-8 rounded bg-neutral-800" />
          ))}
        </div>
      </section>
    </main>
  );
}

function ShareButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      className="rounded-lg bg-[#242424] px-3 py-2 text-sm font-bold hover:bg-[#2f2f2f]"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url);
        } catch {
          // Clipboard API can be unavailable (older browsers, non-HTTPS) --
          // fall back to a manual prompt so the link is still copyable.
          window.prompt("Copy this link:", url);
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? "Link copied!" : "Copy share link"}
    </button>
  );
}

type BadgeInfo = { id: string; icon: string; title: string; description: string; winners: string[]; display?: string };

function BadgeGrid({ badges, highlightPlayer }: { badges: BadgeInfo[]; highlightPlayer?: string }) {
  if (!badges.length) {
    return <p className="text-sm text-neutral-500">Not enough data yet to award badges here.</p>;
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {badges.map((badge) => (
        <BadgeCard key={badge.id} badge={badge} highlightPlayer={highlightPlayer} />
      ))}
    </div>
  );
}

function BadgeCard({ badge, highlightPlayer }: { badge: BadgeInfo; highlightPlayer?: string }) {
  const tied = badge.winners.length > 1;
  return (
    <div className="rounded-xl border border-neutral-800 bg-[#101010] p-4">
      <div className="mb-1 flex items-center gap-2">
        <span className="text-2xl">{badge.icon}</span>
        <div className="text-sm font-black uppercase text-[#f04a22]">{badge.title}</div>
      </div>
      <p className="mb-3 text-xs text-neutral-500">{badge.description}</p>
      <div className="space-y-1">
        {badge.winners.map((name) => (
          <div
            key={name}
            className={`rounded-lg px-2 py-1 text-sm ${
              name === highlightPlayer ? "bg-[#f04a22]/20 font-bold text-white" : "text-neutral-200"
            }`}
          >
            {name}
          </div>
        ))}
      </div>
      {badge.display && (
        <div className="mt-2 text-right text-xs font-bold text-neutral-400">
          {badge.display}
          {tied ? " (tied)" : ""}
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-[#101010] p-4">
      <div className="text-xs font-bold uppercase text-neutral-400">{label}</div>
      <div className="mt-1 text-3xl font-black text-[#f04a22]"><AnimatedNumber value={value} /></div>
    </div>
  );
}

function RankedList({ rows }: { rows: { name: string; points: number }[] }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map((row, index) => {
        const rank = index + 1;
        const podium = podiumStyle(rank);
        return (
          <div
            key={`${row.name}-${index}`}
            className={`flex items-center justify-between rounded-xl border border-transparent bg-[#202020] px-4 py-3 ${podium.rowClass}`}
          >
            <span className={`font-black ${podium.textClass}`}>
              {podium.medal ? `${podium.medal} ` : `${rank}. `}{row.name}
            </span>
            <span className={`text-xl font-black ${podium.medal ? podium.textClass : "text-[#f04a22]"}`}>
              <AnimatedNumber value={formatValue(row.points, 0)} />
            </span>
          </div>
        );
      })}
    </div>
  );
}

function StandingsTable({ rows }: { rows: { name: string; points: number }[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead><tr className="text-left text-neutral-400"><th className="p-2">#</th><th className="p-2">Player</th><th className="p-2">Points</th></tr></thead>
        <tbody>
          {rows.map((row, index) => {
            const rank = index + 1;
            const podium = podiumStyle(rank);
            return (
              <tr key={`${row.name}-${index}`} className={`border-t border-neutral-800 ${podium.rowClass}`}>
                <td className={`p-2 font-black ${podium.textClass}`}>{podium.medal || rank}</td>
                <td className={`p-2 font-bold ${podium.medal ? podium.textClass : "text-[#f04a22]"}`}>{row.name}</td>
                <td className="p-2"><AnimatedNumber value={formatValue(row.points, 0)} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function RankChangeBadge({ change }: { change: number | null }) {
  if (change === null || change === undefined || Number.isNaN(change)) {
    return <span className="text-neutral-600">-</span>;
  }
  if (change === 0) {
    return <span className="text-neutral-500">•</span>;
  }
  if (change > 0) {
    return <span className="font-bold text-emerald-400">▲{change}</span>;
  }
  return <span className="font-bold text-red-500">▼{Math.abs(change)}</span>;
}

function WeeklyTable({ rows }: { rows: any[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[12px]">
        <thead>
          <tr className="text-left text-neutral-400">
            <th className="p-2">Rank</th><th className="p-2">Player</th><th className="p-2">Team</th><th className="p-2">Finish Pts</th><th className="p-2">+/-</th>
            {weeklyStatColumns.map((col) => <th key={col.label} className="p-2">{col.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${getPlayer(row)}-${getSeason(row)}-${getWeek(row)}-${getType(row)}-${index}`} className="border-t border-neutral-800">
              <td className="p-2">{formatValue(row.Rank, 0)}</td>
              <td className="p-2 font-bold text-[#f04a22]">{getPlayer(row)}</td>
              <td className="p-2">{clean(row.Team) || "-"}</td>
              <td className="p-2">{formatValue(row.Points, 0)}</td>
              <td className="p-2"><RankChangeBadge change={row.RankChange ?? null} /></td>
              {weeklyStatColumns.map((col) => (
                <td key={col.label} className="p-2">{formatValue(getStatValue(row, col.label === "Points" ? ["StatPoints"] : col.keys), col.decimals)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EventSummary({ rows }: { rows: any[] }) {
  return (
    <div className="mt-6 rounded-xl border border-neutral-800 bg-[#202020] p-4">
      <h3 className="mb-3 text-lg font-black text-[#f04a22]">Event Totals / Averages</h3>
      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
        {summarizeEvent(rows).map((item) => <MiniStat key={item.label} label={item.label} value={item.value} />)}
      </div>
    </div>
  );
}

function StatsTable({ rows, sortKey, sortDirection, onSort }: { rows: any[]; sortKey: string; sortDirection: SortDirection; onSort: (key: string) => void }) {
  return (
    <>
      <div className="grid gap-3 md:hidden">
        {rows.map((row, index) => (
          <div key={`${getPlayer(row)}-${index}`} className="rounded-xl border border-neutral-800 bg-[#202020] p-4">
            <div className="mb-3 text-lg font-black text-[#f04a22]">{getPlayer(row)}</div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {statColumns.map((col) => <div key={col.label}><div className="text-xs uppercase text-neutral-500">{col.label}</div><div className="font-bold">{formatValue(getStatValue(row, col.keys), col.decimals)}</div></div>)}
            </div>
          </div>
        ))}
      </div>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[1150px] text-[12px]">
          <thead>
            <tr className="text-left text-neutral-400">
              <th className="sticky left-0 z-10 bg-[#141414] p-2">Player</th>
              {statColumns.map((col) => (
                <th key={col.label} className="cursor-pointer whitespace-nowrap p-2 hover:text-[#f04a22]" onClick={() => onSort(col.label)}>
                  {col.label}{sortKey === col.label ? (sortDirection === "asc" ? " ▲" : " ▼") : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${getPlayer(row)}-${index}`} className="border-t border-neutral-800">
                <td className="sticky left-0 z-10 bg-[#141414] p-2 font-bold text-[#f04a22]">{getPlayer(row)}</td>
                {statColumns.map((col) => <td key={col.label} className="whitespace-nowrap p-2">{formatValue(getStatValue(row, col.keys), col.decimals)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function CareerStatsTable({
  rows,
  columns,
  sortKey,
  sortDirection,
  highlightPlayer,
  onSort,
}: {
  rows: any[];
  columns: { key: string; label: string; decimals: number }[];
  sortKey: string;
  sortDirection: SortDirection;
  highlightPlayer?: string;
  onSort: (key: string) => void;
}) {
  return (
    <>
      <div className="grid gap-3 md:hidden">
        {rows.map((row) => (
          <div
            key={row.name}
            className={`rounded-xl border p-4 ${
              row.name === highlightPlayer ? "border-[#f04a22] bg-[#f04a22]/10" : "border-neutral-800 bg-[#202020]"
            }`}
          >
            <div className="mb-3 text-lg font-black text-[#f04a22]">{row.name}</div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {columns.map((col) => (
                <div key={col.key}>
                  <div className="text-xs uppercase text-neutral-500">{col.label}</div>
                  <div className="font-bold">{formatValue(row[col.key], col.decimals)}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[1150px] text-[12px]">
          <thead>
            <tr className="text-left text-neutral-400">
              <th className="sticky left-0 z-10 bg-[#141414] p-2">Player</th>
              {columns.map((col) => (
                <th key={col.key} className="cursor-pointer whitespace-nowrap p-2 hover:text-[#f04a22]" onClick={() => onSort(col.key)}>
                  {col.label}
                  {sortKey === col.key ? (sortDirection === "asc" ? " ▲" : " ▼") : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.name} className={`border-t border-neutral-800 ${row.name === highlightPlayer ? "bg-[#f04a22]/10" : ""}`}>
                <td className="sticky left-0 z-10 bg-[#141414] p-2 font-bold text-[#f04a22]">{row.name}</td>
                {columns.map((col) => (
                  <td key={col.key} className="whitespace-nowrap p-2">
                    {formatValue(row[col.key], col.decimals)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function PlayerStatsSummary({ row }: { row: any }) {
  if (!row) return <p className="text-neutral-400">No season stats found for this player.</p>;
  return (
    <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-5">
      {statColumns.slice(1).map((col) => (
        <MiniStat key={col.label} label={col.label} value={formatValue(getStatValue(row, col.keys), col.decimals)} />
      ))}
    </div>
  );
}

// Career-aggregate version of PlayerStatsSummary, shown instead when the
// profile's season filter is set to "All Seasons" -- previously that setting
// still just showed the single most recent season's numbers (whichever
// season happened to sort last), which looked identical to picking that
// season directly and made "All Seasons" seem broken.
function CareerStatsSummary({ row, columns }: { row: any; columns: { key: string; label: string; decimals: number }[] }) {
  if (!row) return <p className="text-neutral-400">No career stats found for this player.</p>;
  return (
    <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-5">
      {columns.map((col) => (
        <MiniStat key={col.key} label={col.label} value={formatValue(row[col.key], col.decimals)} />
      ))}
    </div>
  );
}

function SeasonFinishesTable({ rows }: { rows: any[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead><tr className="text-left text-neutral-400"><th className="p-2">Season</th><th className="p-2">Finish</th><th className="p-2">PPR</th><th className="p-2">DPR</th><th className="p-2">OPPR</th><th className="p-2">Points</th><th className="p-2">Rounds</th><th className="p-2">4 Baggers</th></tr></thead>
        <tbody>
          {rows.map((row) => (
            <tr key={getSeason(row)} className="border-t border-neutral-800"><td className="p-2 font-bold">{getSeason(row)}</td><td className="p-2 text-[#f04a22]">{formatValue(getStatValue(row, ["Finish"]), 0)}</td><td className="p-2">{formatValue(getStatValue(row, ["Average PPR", "PPR"]), 2)}</td><td className="p-2">{formatValue(getStatValue(row, ["Average DPR", "DPR"]), 2)}</td><td className="p-2">{formatValue(getStatValue(row, ["Opponents Avg PPR", "OPPR"]), 2)}</td><td className="p-2">{formatValue(getStatValue(row, ["Total Pts", "Total Points"]), 0)}</td><td className="p-2">{formatValue(getStatValue(row, ["Total Rounds"]), 0)}</td><td className="p-2">{formatValue(getStatValue(row, ["Total 4-Baggers", "4 Baggers"]), 0)}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}


function ScenarioTable({
  rows,
  inputs,
  setInputs,
  selectedPlayer,
}: {
  rows: any[];
  inputs: Record<string, string>;
  setInputs: any;
  selectedPlayer: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[950px] text-sm">
        <thead>
          <tr className="text-left text-neutral-400">
            <th className="p-2">Projected Rank</th>
            <th className="p-2">Player</th>
            <th className="p-2">Current Rank</th>
            <th className="p-2">Current Points</th>
            <th className="p-2">Lowest Counted</th>
            <th className="p-2">Projected Score</th>
            <th className="p-2">Net Gain</th>
            <th className="p-2">Projected Points</th>
            <th className="p-2">Highest Week</th>
            <th className="p-2">PPR</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.name} className={`border-t border-neutral-800 ${row.name === selectedPlayer ? "bg-[#f04a22]/10" : ""}`}>
              <td className="p-2 font-bold">{row.projectedRank}</td>
              <td className="p-2 font-bold text-[#f04a22]">{row.name}</td>
              <td className="p-2">{row.currentRank || "-"}</td>
              <td className="p-2">{formatValue(row.currentTotal, 0)}</td>
              <td className="p-2">{formatValue(row.lowestCounted, 0)}</td>
              <td className="p-2">
                <input
                  className="w-24 rounded bg-[#242424] p-2 text-white"
                  type="number"
                  min="0"
                  value={inputs[row.name] ?? ""}
                  placeholder="score"
                  onChange={(e) => {
                    const value = e.target.value;
                    setInputs((current) => ({ ...current, [row.name]: value }));
                  }}
                />
              </td>
              <td className="p-2">{formatValue(row.netGain, 0)}</td>
              <td className="p-2 font-bold text-[#f04a22]">{formatValue(row.projectedTotal, 0)}</td>
              <td className="p-2">{formatValue(row.highestWeek, 0)}</td>
              <td className="p-2">{formatValue(row.ppr, 2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CompareTable({ statA, statB }: { statA: any; statB: any }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <tbody>
          {statColumns.map((col) => (
            <tr key={col.label} className="border-t border-neutral-800"><td className="p-2 text-neutral-400">{col.label}</td><td className="p-2">{formatValue(getStatValue(statA, col.keys), col.decimals)}</td><td className="p-2">{formatValue(getStatValue(statB, col.keys), col.decimals)}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
