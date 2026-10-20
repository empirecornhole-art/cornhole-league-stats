// Sample data for local development only. When `next dev` runs without
// Supabase credentials (they live in Vercel, not on this machine), the data
// routes return this instead of empty results so every page has content to
// look at. Never active in production builds or when real credentials exist.
import type { LeagueData } from "./types";
import type { EventRow } from "./events";
import type { StorePreviewItem } from "./storePreview";

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

export function mockMedia() {
  return Array.from({ length: 10 }, (_, i) => ({
    id: `mock-${i}`,
    season: SEASON,
    week: i < 6 ? WEEKS : WEEKS - 1,
    kind: "photo" as const,
    url: "/ec-logo-full.png",
    caption: `Sample photo ${i + 1}`,
  }));
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
