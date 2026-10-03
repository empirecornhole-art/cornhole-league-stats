import { NextResponse } from "next/server";
import { listMedia } from "../../../lib/media";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Public feed behind the site's Photos tab. Nothing private lives here: just
// each file's week, type, URL and caption. Fails soft so the tab can say
// "no photos yet" instead of breaking the page if the table doesn't exist yet.
export async function GET() {
  try {
    const items = await listMedia();
    return NextResponse.json(
      {
        items: items.map((i) => ({
          id: i.id,
          season: i.season_name,
          week: i.week_number,
          kind: i.kind,
          url: i.url,
          caption: i.caption,
        })),
      },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } }
    );
  } catch {
    return NextResponse.json({ items: [] });
  }
}
