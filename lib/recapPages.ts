import { listPublishedRecaps } from "./recapStore";
import { listMedia } from "./media";
import { seasonOrderKey } from "./recap";
import { useDevMock, mockHomeRecap } from "./devMock";

/**
 * Data behind the public recap pages (/recaps and /recaps/<season>-week-<n>).
 * Only published recaps with text are listed. The recap text itself is the same
 * event-level post the League page's Weeks tab shows: placings, game scores and
 * event totals, never per-player stat lines.
 */

export type RecapPhoto = { id: string; url: string; caption: string };

export type RecapPage = {
  season: string;
  week: number;
  slug: string;
  title: string;
  /** "Switch & Blind Draw" etc., from what the post covers; "" if unclear. */
  formats: string;
  body: string;
  excerpt: string;
  updated: string;
  photos: RecapPhoto[];
};

export function recapSlug(season: string, week: number): string {
  const s = season.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return `${s}-week-${week}`;
}

export function recapPath(season: string, week: number): string {
  return `/recaps/${recapSlug(season, week)}`;
}

const EMOJI_START = /^\p{Extended_Pictographic}/u;

/** First plain-prose paragraph of the post, trimmed to a meta-description length. */
export function recapExcerpt(body: string, max = 155): string {
  const blocks = body.replace(/\r/g, "").split(/\n{2,}/).map((b) => b.trim());
  const prose = blocks.find(
    (b) => b.length > 40 && !b.includes("\n") && !EMOJI_START.test(b) && !/^(•|\d|━)/u.test(b)
  );
  if (!prose) return "";
  if (prose.length <= max) return prose;
  const cut = prose.slice(0, max - 1);
  return `${cut.slice(0, cut.lastIndexOf(" ")).replace(/[,;:\s]+$/, "")}…`;
}

function formatsOf(body: string): string {
  const found: string[] = [];
  if (/switch/i.test(body)) found.push("Switch");
  if (/blind draw/i.test(body)) found.push("Blind Draw");
  return found.join(" & ");
}

const order = (a: { season: string; week: number }, b: { season: string; week: number }) =>
  seasonOrderKey(b.season) * 1000 + b.week - (seasonOrderKey(a.season) * 1000 + a.week);

function build(season: string, week: number, body: string, updated: string, photos: RecapPhoto[]): RecapPage {
  const formats = formatsOf(body);
  return {
    season,
    week,
    slug: recapSlug(season, week),
    title: `${season} Week ${week} Recap`,
    formats,
    body,
    excerpt: recapExcerpt(body),
    updated,
    photos,
  };
}

/** Every published recap, newest first. Throws if the data source is unavailable. */
export async function listRecapPages(): Promise<RecapPage[]> {
  if (useDevMock()) {
    const mock = mockHomeRecap();
    const older = mock.body.replace(new RegExp(`Week ${mock.week}`, "g"), `Week ${mock.week - 1}`);
    return [
      build(mock.season, mock.week, mock.body, new Date().toISOString(), mock.photos),
      build(mock.season, mock.week - 1, older, new Date(Date.now() - 7 * 86400000).toISOString(), mock.photos.slice(0, 3)),
    ];
  }

  const [recaps, media] = await Promise.all([listPublishedRecaps(), listMedia()]);
  const photos = media.filter((m) => m.kind === "photo" && m.week_number > 0 && m.season_name);

  return recaps
    .filter((r) => r.body.trim() && r.season_name && r.week_number > 0)
    .map((r) =>
      build(
        r.season_name,
        r.week_number,
        r.body,
        r.updated_at,
        photos
          .filter((p) => p.season_name === r.season_name && p.week_number === r.week_number)
          .map((p) => ({ id: p.id, url: p.url, caption: p.caption }))
      )
    )
    .sort(order);
}

/** One recap plus its neighbours in time (older = prev, newer = next); null if there's no such recap. */
export async function getRecapPage(slug: string) {
  const all = await listRecapPages();
  const index = all.findIndex((r) => r.slug === slug);
  if (index < 0) return null;
  return {
    recap: all[index],
    newer: index > 0 ? all[index - 1] : null,
    older: index < all.length - 1 ? all[index + 1] : null,
  };
}
