import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

// Default share card for every page (Facebook, Instagram DMs, iMessage, etc.).
// A plain route instead of the opengraph-image file convention so the URL is
// always the absolute https://www.empirecornhole.com/og set in the metadata.
export async function GET() {
  const logo = await readFile(path.join(process.cwd(), "public", "ec-logo.png"));
  const logoSrc = `data:image/png;base64,${logo.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          padding: "0 90px",
          background: "#070707",
          color: "#f5f5f0",
          fontFamily: "sans-serif",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoSrc} width={340} height={340} style={{ objectFit: "contain" }} alt="" />
        <div style={{ display: "flex", flexDirection: "column", marginLeft: 70, width: 610 }}>
          <div style={{ display: "flex", fontSize: 24, fontWeight: 700, letterSpacing: 3, color: "#f04a22", textTransform: "uppercase" }}>
            Weekly cornhole · New Berlin, NY
          </div>
          <div style={{ display: "flex", fontSize: 84, fontWeight: 800, lineHeight: 1, marginTop: 18, textTransform: "uppercase" }}>
            Empire Cornhole League
          </div>
          <div style={{ display: "flex", fontSize: 34, marginTop: 28, color: "#c9c5bf" }}>
            Live standings · Results · Events
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
