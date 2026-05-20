import { put } from "@vercel/blob";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { error: "No file uploaded" },
        { status: 400 }
      );
    }

    const blob = await put(file.name, file, {
  access: "private",
  allowOverwrite: true,
});

    return NextResponse.json({
      success: true,
      uploaded: blob.url,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: error.message || "Upload failed",
      },
      { status: 500 }
    );
  }
}
