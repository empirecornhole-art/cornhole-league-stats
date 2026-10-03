import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { mediaConfigured, mediaToken } from "../../../../../lib/media";

export const runtime = "nodejs";

/**
 * Token endpoint for direct browser-to-storage uploads. Photos and videos go
 * straight to Vercel Blob from the browser (a normal API route can't take a
 * file over about 4.5 MB); this route only hands out a short-lived upload
 * token after checking the admin password sent with the upload.
 */
export async function POST(req: Request) {
  try {
    if (!mediaConfigured()) {
      return NextResponse.json(
        { error: "Photo/video storage isn't set up yet (missing MEDIA_READ_WRITE_TOKEN)." },
        { status: 400 }
      );
    }

    const body = (await req.json()) as HandleUploadBody;
    const json = await handleUpload({
      body,
      request: req,
      token: mediaToken(),
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        let password = "";
        try {
          password = JSON.parse(clientPayload || "{}").password || "";
        } catch {
          /* fall through to the password check */
        }
        if (password !== process.env.ADMIN_PASSWORD) throw new Error("Invalid password");
        return {
          allowedContentTypes: ["image/*", "video/*"],
          maximumSizeInBytes: 1024 * 1024 * 1024, // 1 GB
          addRandomSuffix: true,
        };
      },
    });
    return NextResponse.json(json);
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Upload failed" }, { status: 400 });
  }
}
