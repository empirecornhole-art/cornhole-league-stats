import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { getRecapPage } from "../../../../lib/recapPages";
import { recapCardFacts } from "../../../../lib/recapCard";

export const runtime = "nodejs";

// A designed share card for one week's recap (Facebook, Instagram DMs, iMessage...):
// the week, plus who won the Switch and the Blind Draw. Used as the recap page's
// preview image instead of whichever photo happened to be first.
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  let page = null;
  try {
    page = await getRecapPage(slug);
  } catch {
    page = null;
  }
  if (!page) return Response.redirect(new URL("/og", request.url), 307);

  const { recap } = page;
  const facts = recapCardFacts(recap.body);
  const logo = await readFile(path.join(process.cwd(), "public", "ec-logo.png"));
  // Anton (SIL Open Font License, see app/fonts/Anton-OFL.txt): the site's headline font.
  // Card images need a TTF, so this is a TrueType copy of the same font the site already uses.
  const anton = await readFile(path.join(process.cwd(), "app", "fonts", "anton-400.ttf"));
  const logoSrc = `data:image/png;base64,${logo.toString("base64")}`;

  const rows: { label: string; value: string; note: string }[] = [];
  if (facts.switchChampion) rows.push({ label: "Switch", value: facts.switchChampion.name, note: facts.switchChampion.record });
  if (facts.blindChampions) rows.push({ label: "Blind Draw", value: facts.blindChampions.team, note: facts.blindChampions.record });

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "#070707",
          color: "#f5f5f0",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", width: 14, height: "100%", background: "#f04a22" }} />
        <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: "56px 70px 48px 64px" }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoSrc} width={92} height={92} style={{ objectFit: "contain" }} alt="" />
            <div style={{ display: "flex", flexDirection: "column", marginLeft: 22 }}>
              <div style={{ display: "flex", fontFamily: "Anton", fontSize: 32, letterSpacing: 4, color: "#f04a22", textTransform: "uppercase" }}>
                {recap.season} · Week {recap.week}
              </div>
              <div style={{ display: "flex", fontSize: 24, color: "#c9c5bf", marginTop: 4 }}>Empire Cornhole League · New Berlin, NY</div>
            </div>
          </div>

          <div style={{ display: "flex", fontFamily: "Anton", fontSize: 150, lineHeight: 1, marginTop: 40, textTransform: "uppercase" }}>
            Week {recap.week} recap
          </div>

          {rows.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", marginTop: 40 }}>
              {rows.map((row) => (
                <div key={row.label} style={{ display: "flex", alignItems: "center", marginTop: 14 }}>
                  <div
                    style={{
                      display: "flex",
                      width: 250,
                      fontFamily: "Anton",
                      fontSize: 30,
                      letterSpacing: 3,
                      color: "#f04a22",
                      textTransform: "uppercase",
                    }}
                  >
                    {row.label}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      maxWidth: 700,
                      fontFamily: "Anton",
                      fontSize: 52,
                      letterSpacing: 1,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {row.value}
                  </div>
                  {row.note && <div style={{ display: "flex", fontSize: 32, color: "#c9c5bf", marginLeft: 22 }}>{row.note}</div>}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: "flex", fontSize: 38, marginTop: 36, color: "#c9c5bf" }}>Results · Standings · Photos</div>
          )}
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: [{ name: "Anton", data: anton, weight: 400, style: "normal" }],
      // Recaps can be edited and republished, so don't let the card go stale for long.
      headers: { "Cache-Control": "public, max-age=300, s-maxage=300, stale-while-revalidate=86400" },
    }
  );
}
