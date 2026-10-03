import { getSupabaseAdmin } from "./supabaseAdmin";

/**
 * Posts a week's recap (text + photos/videos) to the Facebook Page and the
 * linked Instagram account through Meta's Graph API.
 *
 * Needs three environment variables in Vercel (never exposed to the browser):
 *   META_PAGE_ID            the Facebook Page's ID
 *   META_PAGE_ACCESS_TOKEN  a long-lived *Page* access token
 *   META_IG_USER_ID         the Instagram Business/Creator account ID (optional)
 * Optional: META_GRAPH_VERSION to override the API version below.
 *
 * Media comes from the public week_media store, so Meta can fetch each file by URL.
 */

export const INSTAGRAM_CAPTION_LIMIT = 2200;
export const INSTAGRAM_MAX_ITEMS = 10;

export type PostMedia = { url: string; kind: "photo" | "video" };

// Facebook can't put photos and a video in one Page post, so videos are handled separately:
//   skip     leave videos out of the Facebook post (add them by hand afterwards)
//   main     the video carries the recap text; photos aren't included
//   separate recap + photos in one post, then each video as its own post
export type VideoMode = "skip" | "main" | "separate";

export type SocialStatus = {
  facebook: { configured: boolean; ok: boolean; name?: string; error?: string };
  instagram: { configured: boolean; ok: boolean; name?: string; error?: string };
};

export type PriorPost = { platform: "facebook" | "instagram"; post_id: string; permalink: string; posted_at: string };

function config() {
  const clean = (v?: string) => String(v || "").trim();
  return {
    pageId: clean(process.env.META_PAGE_ID),
    token: clean(process.env.META_PAGE_ACCESS_TOKEN),
    igId: clean(process.env.META_IG_USER_ID),
    version: clean(process.env.META_GRAPH_VERSION) || "v26.0",
  };
}

function friendly(err: any): string {
  const message = String(err?.message || "Meta request failed");
  if (err?.code === 190) {
    return `${message} The Meta access token is invalid or expired. Create a new Page token and update META_PAGE_ACCESS_TOKEN in Vercel.`;
  }
  if (err?.code === 10 || err?.code === 200 || err?.code === 283) {
    return `${message} The token is probably missing a permission (pages_manage_posts for Facebook, instagram_content_publish for Instagram).`;
  }
  return message;
}

async function graph(path: string, params: Record<string, string> = {}, method: "GET" | "POST" = "POST") {
  const { token, version } = config();
  const base = `https://graph.facebook.com/${version}/${path}`;
  const headers = { Authorization: `Bearer ${token}` };
  const res =
    method === "GET"
      ? await fetch(`${base}?${new URLSearchParams(params).toString()}`, { headers, cache: "no-store" })
      : await fetch(base, { method: "POST", headers, body: new URLSearchParams(params), cache: "no-store" });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok || json?.error) throw new Error(friendly(json?.error));
  return json;
}

export async function getSocialStatus(): Promise<SocialStatus> {
  const { pageId, token, igId } = config();
  const status: SocialStatus = {
    facebook: { configured: !!(pageId && token), ok: false },
    instagram: { configured: !!(igId && token), ok: false },
  };

  if (status.facebook.configured) {
    try {
      const page = await graph(pageId, { fields: "name" }, "GET");
      status.facebook.ok = true;
      status.facebook.name = page.name;
    } catch (e: any) {
      status.facebook.error = e.message;
    }
  }
  if (status.instagram.configured) {
    try {
      const ig = await graph(igId, { fields: "username" }, "GET");
      status.instagram.ok = true;
      status.instagram.name = ig.username;
    } catch (e: any) {
      status.instagram.error = e.message;
    }
  }
  return status;
}

export async function postToFacebook(text: string, media: PostMedia[], videoCaption: string, videoMode: VideoMode = "skip") {
  const { pageId, token } = config();
  if (!pageId || !token) throw new Error("Facebook isn't set up yet (META_PAGE_ID / META_PAGE_ACCESS_TOKEN).");

  const allPhotos = media.filter((m) => m.kind === "photo");
  const videos = media.filter((m) => m.kind === "video");
  const ids: string[] = [];

  // "main" with a video: the video is the post, so photos are dropped. Every other case keeps them.
  const videoIsMain = videoMode === "main" && videos.length > 0;
  const photos = videoIsMain ? [] : allPhotos;
  const videosToPost = videoMode === "skip" ? [] : videos;

  if (!videoIsMain) {
    // Text post, optionally with photos attached. Photos go up unpublished first, then ride on the post.
    const params: Record<string, string> = { message: text };
    for (let i = 0; i < photos.length; i++) {
      const photo = await graph(`${pageId}/photos`, { url: photos[i].url, published: "false" });
      params[`attached_media[${i}]`] = JSON.stringify({ media_fbid: photo.id });
    }
    const post = await graph(`${pageId}/feed`, params);
    ids.push(post.id);
    for (const video of videosToPost) {
      const v = await graph(`${pageId}/videos`, { file_url: video.url, description: videoCaption });
      ids.push(v.id);
    }
  } else {
    // The first video carries the recap text, any others get a short caption.
    for (let i = 0; i < videosToPost.length; i++) {
      const v = await graph(`${pageId}/videos`, { file_url: videosToPost[i].url, description: i === 0 ? text : videoCaption });
      ids.push(v.id);
    }
  }

  const first = ids[0];
  return { postId: first, permalink: first.includes("_") ? `https://www.facebook.com/${first}` : `https://www.facebook.com/${pageId}/videos/${first}` };
}

async function waitForContainer(id: string) {
  const deadline = Date.now() + 45_000;
  for (;;) {
    const info = await graph(id, { fields: "status_code" }, "GET");
    if (info.status_code === "FINISHED") return;
    if (info.status_code === "ERROR" || info.status_code === "EXPIRED") {
      throw new Error(`Instagram couldn't process one of the files (${info.status_code}). Videos should be MP4 (H.264) and photos JPEG or PNG.`);
    }
    if (Date.now() > deadline) {
      throw new Error("Instagram is still processing the video. Wait a minute and try again.");
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
}

export async function postToInstagram(caption: string, media: PostMedia[]) {
  const { igId, token } = config();
  if (!igId || !token) throw new Error("Instagram isn't set up yet (META_IG_USER_ID / META_PAGE_ACCESS_TOKEN).");
  if (!media.length) throw new Error("Instagram posts need at least one photo or video. Select some first.");
  if (media.length > INSTAGRAM_MAX_ITEMS) throw new Error(`Instagram allows up to ${INSTAGRAM_MAX_ITEMS} photos/videos in one post. Select fewer.`);
  if (caption.length > INSTAGRAM_CAPTION_LIMIT) {
    throw new Error(`The Instagram caption is ${caption.length} characters. The limit is ${INSTAGRAM_CAPTION_LIMIT}. Shorten it first.`);
  }

  let containerId: string;
  if (media.length === 1) {
    const m = media[0];
    const container =
      m.kind === "video"
        ? await graph(`${igId}/media`, { media_type: "REELS", video_url: m.url, caption, share_to_feed: "true" })
        : await graph(`${igId}/media`, { image_url: m.url, caption });
    containerId = container.id;
    await waitForContainer(containerId);
  } else {
    const children: string[] = [];
    for (const m of media) {
      const child =
        m.kind === "video"
          ? await graph(`${igId}/media`, { media_type: "VIDEO", video_url: m.url, is_carousel_item: "true" })
          : await graph(`${igId}/media`, { image_url: m.url, is_carousel_item: "true" });
      children.push(child.id);
    }
    for (const id of children) await waitForContainer(id);
    const carousel = await graph(`${igId}/media`, { media_type: "CAROUSEL", children: children.join(","), caption });
    containerId = carousel.id;
    await waitForContainer(containerId);
  }

  const published = await graph(`${igId}/media_publish`, { creation_id: containerId });
  let permalink = "";
  try {
    permalink = (await graph(published.id, { fields: "permalink" }, "GET")).permalink || "";
  } catch {
    /* the post is live even if the link lookup fails */
  }
  return { postId: published.id as string, permalink };
}

// ---- Record of what was posted, so a week isn't posted twice by accident ----

export async function getPriorPosts(season: string, week: number): Promise<PriorPost[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("social_posts")
    .select("platform,post_id,permalink,posted_at")
    .eq("season_name", season)
    .eq("week_number", week)
    .order("posted_at", { ascending: false });
  if (error) return []; // table not created yet: no history, posting still works
  return (data || []) as PriorPost[];
}

export async function recordPost(season: string, week: number, platform: "facebook" | "instagram", postId: string, permalink: string) {
  const { error } = await getSupabaseAdmin()
    .from("social_posts")
    .insert({ season_name: season, week_number: week, platform, post_id: postId, permalink });
  return !error;
}
