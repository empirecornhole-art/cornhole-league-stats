// Sample data for local development only. When `next dev` runs without
// Supabase credentials (they live in Vercel, not on this machine), the data
// routes return this instead of empty results so every page has content to
// look at. Never active in production builds or when real credentials exist.
import type { LeagueData } from "./types";
import type { EventRow } from "./events";
import type { StorePreviewItem } from "./storePreview";
import type { HomeRecap } from "./homeRecap";
import type { HomeStandings } from "./homeStandings";

export function useDevMock(): boolean {
  return process.env.NODE_ENV === "development" && !process.env.NEXT_PUBLIC_SUPABASE_URL;
}

const NAMES = [
  "Alex Rivera", "Jordan Blake", "Sam Okafor", "Casey Lindqvist", "Morgan Tate", "Riley Brandt",
  "Taylor Voss", "Jamie Castellan", "Drew Halvorsen", "Quinn Mercer", "Avery Lund", "Parker Nakamura",
  "Reese Dalton", "Skyler Bianchi", "Cameron Ortiz", "Devon Pruitt", "Harper Quill", "Emerson Rowe",
  "Rowan Sutter", "Finley Marsh", "Logan Pierce", "Blair Navarro", "Kendall Frost", "Sage Whitlock",
];
const WEEKS = 8;
const SEASON = "Fall 26";

export function mockLeagueData(): LeagueData {
  const standings: Record<string, any>[] = [];
  const weekly: Record<string, any>[] = [];
  const eventStats: Record<string, any>[] = [];
  const stats: Record<string, any>[] = [];
  NAMES.forEach((name, i) => {
    standings.push({ Season: SEASON, Player: name, Overall: 220 - i * 7 - (i % 3) });
    for (let w = 1; w <= WEEKS; w++) {
      for (const type of ["Swap", "Blind"]) {
        const points = Math.max(1, 30 - i - (w % 4) + (type === "Blind" ? -8 : 0));
        const base = { Season: SEASON, Week: `Week ${w}`, Type: type, Player: name };
        weekly.push({ ...base, Points: points, Finish: i + 1 });
        eventStats.push({
          ...base,
          PPR: (2.9 - i * 0.04 + (w % 3) * 0.05).toFixed(2),
          Rounds: 14 + (i % 4),
          Points: points,
          OPPR: (2.5 + (i % 5) * 0.05).toFixed(2),
          "Opp Pts": 30 + (i % 7),
          DPR: (1.1 + i * 0.01).toFixed(2),
          "4 Baggers": (i + w) % 4,
        });
      }
    }
    stats.push({
      Season: SEASON,
      Player: name,
      "Total Rounds": 220 + i * 2,
      "Total Pts": 900 - i * 20,
      "Average PPR": (2.9 - i * 0.04).toFixed(2),
      "Opponents Avg PPR": (2.5 + (i % 5) * 0.05).toFixed(2),
      "Average DPR": (1.1 + i * 0.01).toFixed(2),
      "Total 4-Baggers": 24 - i,
      "Bags On %": (62 - i * 0.6).toFixed(2),
    });
  });
  return { seasons: [SEASON], players: NAMES, standings, weekly, eventStats, stats, lastUpdated: new Date().toISOString() };
}

// A portrait stand-in "photo" (two people and a board) in a different color per index,
// so layouts that show several photos look like they will with real ones.
function mockPhotoUrl(i: number) {
  const h = [18, 200, 140, 280, 40, 340][i % 6];
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='900' height='1200' viewBox='0 0 900 1200'>` +
    `<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='hsl(${h} 55% 28%)'/>` +
    `<stop offset='1' stop-color='hsl(${h + 30} 60% 12%)'/></linearGradient></defs>` +
    `<rect width='900' height='1200' fill='url(#g)'/>` +
    `<g fill='hsl(${h} 30% 80%)'><circle cx='300' cy='360' r='90'/><rect x='210' y='470' width='180' height='300' rx='60'/>` +
    `<circle cx='600' cy='400' r='80'/><rect x='520' y='500' width='160' height='280' rx='55'/></g>` +
    `<rect x='250' y='760' width='400' height='300' rx='14' fill='hsl(30 70% 55%)'/>` +
    `<circle cx='450' cy='830' r='38' fill='hsl(${h + 30} 60% 12%)'/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function mockMedia() {
  return Array.from({ length: 10 }, (_, i) => ({
    id: `mock-${i}`,
    season: SEASON,
    week: i < 6 ? WEEKS : WEEKS - 1,
    kind: "photo" as const,
    url: mockPhotoUrl(i),
    caption: `Sample photo ${i + 1}`,
  }));
}

// A published recap in the same format the real ones use (invented names), plus that week's photos.
export function mockHomeRecap(): HomeRecap {
  const body = [
    `🏆 ${SEASON} – Week ${WEEKS} Switch Recap 🏆`,
    `Week ${WEEKS} of ${SEASON} brought 22 players, 4 rounds of round robin and a new partner every game. One player finished perfect.`,
    `🔥 Switch Champion
Alex Rivera went a perfect 4–0 with 94 points for and only 25 against, including a 25–3 win with Jordan Blake and a 26–5 win with Sam Okafor. They were the only undefeated player of the night.`,
    `🏁 Top 5
🥇 Alex Rivera – 4–0 (94 PF)
🥈 Casey Lindqvist – 3–1 (84 PF)
🥉 Morgan Tate – 3–1 (81 PF)
4️⃣ Riley Brandt – 3–1 (81 PF)
5️⃣ Taylor Voss – 3–1 (79 PF)`,
    `📈 Week ${WEEKS} League Points (Switch + Blind Draw bonus)
1. Alex Rivera – 97
2. Casey Lindqvist – 87
3. Morgan Tate – 83`,
    `🎯 Games of the Night
• Closest: Drew Halvorsen / Quinn Mercer edged Avery Lund / Parker Nakamura 21–18
• Longest: Reese Dalton / Skyler Bianchi beat Cameron Ortiz / Devon Pruitt 26–20 in 24 minutes
• Shutouts: Harper Quill / Emerson Rowe 23–0 and Rowan Sutter / Finley Marsh 24–0`,
    `📊 Switch – Event Stats
• 22 players, 24 games
• Total points scored: 745
• Event PPR: 7.59
• Bags in: 50.6% | on: 38.0% | off: 11.4%
• 4-baggers: 56 (10.4% of rounds)
• Average game: 11.7 min`,
    `━━━━━━━━━━━━`,
    `🏆 ${SEASON} – Week ${WEEKS} Blind Draw Recap 🏆`,
    `The Week ${WEEKS} Blind Draw delivered an 11-team double-elimination bracket, and the finals came down to a bracket reset.`,
    `🏁 Final Results
🥇 Champions – Alex Rivera / Logan Pierce (7–1)
🥈 Runner-Up – Blair Navarro / Kendall Frost (4–2)
🥉 3rd Place – Sage Whitlock / Jamie Castellan (2–2)`,
  ].join("\n\n");

  return {
    season: SEASON,
    week: WEEKS,
    body,
    photos: Array.from({ length: 6 }, (_, i) => ({ id: `mock-${i}`, url: mockPhotoUrl(i), caption: `Sample photo ${i + 1}` })),
  };
}

const money = (amount: string) => ({ amount, currencyCode: "USD" });

export function mockProducts() {
  return [
    ["League Tee", "25.00"],
    ["Team Hoodie", "48.00"],
    ["Bag Set", "79.00"],
    ["Embroidered Cap", "22.00"],
    ["Scorekeeper Tote", "18.00"],
    ["Sticker Pack", "6.00"],
  ].map(([title, price], i) => ({
    id: `mock-p${i}`,
    title,
    handle: `mock-${i}`,
    description: "",
    availableForSale: true,
    image: { url: "/ec-logo-full.png", alt: title },
    priceRange: { min: money(price), max: money(price) },
    options: [],
    variants: [{ id: `mock-v${i}`, title: "Default", availableForSale: true, price: money(price), options: [], image: null }],
  }));
}

export function mockStorePreview(limit: number): StorePreviewItem[] {
  return mockProducts()
    .slice(0, limit)
    .map((p) => ({ id: p.id, title: p.title, price: `$${Number(p.priceRange.min.amount).toFixed(2)}`, imageUrl: p.image.url, imageAlt: p.title }));
}

function dateOffset(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function mockEvents(upcoming: boolean): EventRow[] {
  const rows: [number, string, string, string, boolean][] = upcoming
    ? [
        [3, "Switch Night", "7:00 PM", "Weekly league night", true],
        [10, "Blind Draw Classic", "7:00 PM", "Open to all", false],
        [24, "Season Finale", "6:30 PM", "Playoff bracket", false],
      ]
    : [
        [-7, "Switch Night", "7:00 PM", "Weekly league night", false],
        [-14, "Blind Draw Classic", "7:00 PM", "Open to all", false],
      ];
  return rows.map(([offset, title, time, tag, featured], i) => ({
    id: `mock-e${upcoming ? "u" : "p"}${i}`,
    event_date: dateOffset(offset),
    time,
    title,
    location: "Sample Venue",
    tag,
    featured,
    scoreholio_id: null,
    register_url: upcoming ? "#" : null,
    created_at: new Date().toISOString(),
  }));
}

export function mockHomeStandings(limit: number): HomeStandings {
  return {
    season: SEASON,
    rows: NAMES.slice(0, limit).map((name, i) => ({ name, points: 220 - i * 7 - (i % 3) })),
    playerCount: NAMES.length,
  };
}
