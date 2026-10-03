import { NextResponse } from "next/server";
import { listMedia } from "../../../../lib/media";
import {
  INSTAGRAM_CAPTION_LIMIT,
  getPriorPosts,
  getSocialStatus,
  postToFacebook,
  postToInstagram,
  recordPost,
  type VideoMode,
} from "../../../../lib/social";

export const runtime = "nodejs";
export const maxDuration = 60;

const fail = (error: string, status = 500, extra: Record<string, any> = {}) =>
  NextResponse.json({ ok: false, error, ...extra }, { status });

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (body?.password !== process.env.ADMIN_PASSWORD) return fail("Invalid password", 401);

    const season = String(body.season || "").trim();
    const week = Number(body.week);
    if (!season || !week) return fail("Pick a season and week.", 400);

    if (body.action === "status") {
      return NextResponse.json({ ok: true, status: await getSocialStatus(), prior: await getPriorPosts(season, week) });
    }

    if (body.action !== "post") return fail("Unknown action.", 400);

    const platform = body.platform === "instagram" ? "instagram" : "facebook";
    const text = String(body.text || "").trim();
    if (!text) return fail("There's no text to post.", 400);

    // Only files that belong to this week can be posted; the browser sends ids, never URLs.
    const wanted: string[] = Array.isArray(body.mediaIds) ? body.mediaIds.map(String) : [];
    const available = await listMedia({ season, week });
    const media = available.filter((m) => wanted.includes(m.id)).map((m) => ({ url: m.url, kind: m.kind }));

    const prior = (await getPriorPosts(season, week)).filter((p) => p.platform === platform);
    if (prior.length && !body.force) {
      return fail(`Week ${week} was already posted to ${platform === "facebook" ? "Facebook" : "Instagram"}.`, 409, { code: "already_posted", prior });
    }

    if (platform === "instagram" && text.length > INSTAGRAM_CAPTION_LIMIT) {
      return fail(`The Instagram caption is ${text.length} characters; the limit is ${INSTAGRAM_CAPTION_LIMIT}.`, 400);
    }

    const videoMode: VideoMode = body.videoMode === "main" || body.videoMode === "separate" ? body.videoMode : "skip";

    const result =
      platform === "facebook"
        ? await postToFacebook(text, media, `${season} Week ${week}`, videoMode)
        : await postToInstagram(text, media);

    const recorded = await recordPost(season, week, platform, result.postId, result.permalink);
    return NextResponse.json({ ok: true, platform, ...result, recorded });
  } catch (error: any) {
    return fail(error?.message || "Posting failed");
  }
}
