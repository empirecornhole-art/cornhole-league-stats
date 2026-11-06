import { listPublishedRecaps } from "./recapStore";
import { listMedia } from "./media";
import { seasonOrderKey } from "./recap";
import { useDevMock, mockHomeRecap } from "./devMock";

/**
 * What the homepage's "Latest Recap" section shows: the newest week that has a
 * published recap, with that week's photos. If no recap has been published yet,
 * it falls back to the newest week that has photos. Never throws: the
 * homepage just leaves the section out.
 */

export type HomeRecapPhoto = { id: string; url: string; caption: string };

export type HomeRecap = {
  season: string;
  week: number;
  body: string; // "" if only photos exist for this week
  photos: HomeRecapPhoto[];
};

const weekKey = (season: string, week: number) => seasonOrderKey(season) * 1000 + week;

export async function getHomeRecap(): Promise<HomeRecap | null> {
  if (useDevMock()) return mockHomeRecap();

  try {
    const [recaps, media] = await Promise.all([listPublishedRecaps(), listMedia()]);
    const photos = media.filter((m) => m.kind === "photo" && m.week_number > 0 && m.season_name);

    const published = recaps.filter((r) => r.body.trim());
    let season = "";
    let week = 0;
    let body = "";

    if (published.length) {
      const newest = published.reduce((a, b) => (weekKey(b.season_name, b.week_number) > weekKey(a.season_name, a.week_number) ? b : a));
      season = newest.season_name;
      week = newest.week_number;
      body = newest.body;
    } else if (photos.length) {
      const newest = photos.reduce((a, b) => (weekKey(b.season_name, b.week_number) > weekKey(a.season_name, a.week_number) ? b : a));
      season = newest.season_name;
      week = newest.week_number;
    } else {
      return null;
    }

    return {
      season,
      week,
      body,
      photos: photos
        .filter((p) => p.season_name === season && p.week_number === week)
        .map((p) => ({ id: p.id, url: p.url, caption: p.caption })),
    };
  } catch {
    return null;
  }
}
