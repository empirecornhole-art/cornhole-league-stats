// Single source of truth for the public site's identity. The canonical host is
// www (the apex 308-redirects to it), so every canonical URL, sitemap entry and
// structured-data URL is built from SITE_URL.
export const SITE_URL = "https://www.empirecornhole.com";
export const SITE_NAME = "Empire Cornhole League";
export const SITE_DESCRIPTION =
  "Weekly blind draw and switch cornhole nights in New Berlin, NY. Live league standings, results, recaps, photos and events from Empire Cornhole League.";
export const SOCIAL_LINKS = ["https://facebook.com/empirecornhole", "https://instagram.com/empirecornhole"];

/** Organization markup shared by every page (rendered once from the root layout). */
export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "SportsOrganization",
    "@id": `${SITE_URL}/#organization`,
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/ec-logo.png`,
    image: `${SITE_URL}/og`,
    description: SITE_DESCRIPTION,
    sport: "Cornhole",
    email: "info@empirecornhole.com",
    sameAs: SOCIAL_LINKS,
    location: {
      "@type": "Place",
      address: { "@type": "PostalAddress", addressLocality: "New Berlin", addressRegion: "NY", addressCountry: "US" },
    },
  };
}

/** "6:30 PM" + "2026-11-27" -> "2026-11-27T18:30:00" (venue-local time). Falls back to the date alone. */
export function eventStartDate(date: string, time: string): string {
  const match = /(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i.exec(time || "");
  if (!match) return date;
  let hour = Number(match[1]) % 12;
  if (match[3].toLowerCase() === "pm") hour += 12;
  return `${date}T${String(hour).padStart(2, "0")}:${match[2] || "00"}:00`;
}
