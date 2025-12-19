import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { resolveSafePath } from "../../../lib/fs";
import sharp from "sharp";

const mimeMap: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".heic": "image/heic",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".avi": "video/x-msvideo",
  ".mkv": "video/x-matroska",
};

export async function GET(req: NextRequest) {
  const relativePath = req.nextUrl.searchParams.get("path") ?? "";
  try {
    const { abs } = resolveSafePath(relativePath);
    const ext = path.extname(abs).toLowerCase();

    if (ext === ".heic") {
      const src = await fs.readFile(abs);

      // 必要ならサイズや画質は調整可能
      const jpegBuffer = await sharp(src, { failOn: "none", limitInputPixels: false })
        .rotate() // EXIF の向きを反映
        .jpeg({ quality: 90 })
        .toBuffer();

      const body = new Uint8Array(jpegBuffer);
      return new NextResponse(body, {
        headers: {
          "Content-Type": "image/jpeg",
          "Cache-Control": "no-store",
        },
      });
    }

    const data = await fs.readFile(abs);
    const contentType = mimeMap[ext] ?? "application/octet-stream";
    const body = new Uint8Array(data);
    
    return new NextResponse(body, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "no-store",
      },
    });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json(
      { error: e.message ?? "Error" },
      { status: 400 }
    );
  }
}
