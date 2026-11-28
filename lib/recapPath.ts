// Pure helpers (no server or database imports), so client components can use them too:
// the address of a week's public recap page.

export function recapSlug(season: string, week: number): string {
  const s = season.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return `${s}-week-${week}`;
}

export function recapPath(season: string, week: number): string {
  return `/recaps/${recapSlug(season, week)}`;
}
