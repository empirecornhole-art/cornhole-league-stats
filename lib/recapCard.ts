/**
 * Pulls the headline facts for a recap's share card out of the recap text: who
 * won the Switch and who won the Blind Draw. Everything is optional, because a
 * recap can be edited freely; whatever isn't found is simply left off the card.
 * Only event-level results are used (placings and records), never stat lines.
 */

export type RecapCardFacts = {
  /** Switch winner, e.g. { name: "Alex Rivera", record: "4-0" } */
  switchChampion?: { name: string; record: string };
  /** Blind Draw winning team, e.g. { team: "Alex Rivera / Logan Pierce", record: "7-1" } */
  blindChampions?: { team: string; record: string };
};

const DASH = "[\\u2013\\u2014-]"; // en dash, em dash or hyphen

const norm = (s: string) => s.replace(/[–—]/g, "-");

export function recapCardFacts(body: string): RecapCardFacts {
  const facts: RecapCardFacts = {};
  const lines = body.replace(/\r/g, "").split("\n").map((l) => l.trim());

  for (const line of lines) {
    // Blind Draw: "🥇 Champions – Name / Name (7–1)"
    const blind = line.match(new RegExp(`^\\u{1F947}\\s+Champions\\s+${DASH}\\s+(.+?)(?:\\s+\\((\\d+${DASH}\\d+)\\))?$`, "u"));
    if (blind && !facts.blindChampions) {
      facts.blindChampions = { team: blind[1].trim(), record: blind[2] ? norm(blind[2]) : "" };
      continue;
    }

    // Switch Top 5: "🥇 Name – 4–0 (94 PF)"
    const sw = line.match(new RegExp(`^\\u{1F947}\\s+(.+?)\\s+${DASH}\\s+(\\d+${DASH}\\d+)\\s*\\(`, "u"));
    if (sw && !facts.switchChampion && !/^Champions$/i.test(sw[1].trim())) {
      facts.switchChampion = { name: sw[1].trim(), record: norm(sw[2]) };
    }
  }
  return facts;
}
