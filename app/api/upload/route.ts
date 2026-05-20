import { put } from "@vercel/blob";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const formData = await req.formData();

    const password = formData.get("password");
    const file = formData.get("file") as File | null;

    if (password !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ error: "Invalid password" }, { status: 401 });
    }

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const blob = await put("league-workbook.xlsx", buffer, {
      access: "private",
      allowOverwrite: true,
      contentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    return NextResponse.json({
  ok: true,
  message: `Workbook uploaded successfully. Size: ${file.size} bytes.`,
  url: blob.url,
  size: file.size,
});
  } catch (error: any) {
    return NextResponse.json(
      {
        error: error?.message || "Upload failed",
      },
      { status: 500 }
    );
  }
}
