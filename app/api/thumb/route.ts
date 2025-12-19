// app/api/thumb/route.ts
import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import sharp from "sharp";
import { spawn } from "child_process";
import { resolveSafePath } from "../../../lib/fs";

export const runtime = "nodejs";

const IMAGE_EXTS = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".heic"];
const VIDEO_EXTS = [".mp4", ".mov", ".m4v", ".avi", ".mkv"];

const THUMB_MAX_WIDTH = 320;
const THUMB_MAX_HEIGHT = 320;

/**
 * ffmpeg を使って動画から 1フレーム JPEG を生成
 */
async function generateVideoThumbnail(absPath: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const args = [
      "-i", absPath,
      "-frames:v", "1",
      "-f", "image2",
      "-vcodec", "mjpeg",
      "pipe:1",
    ];

    const ff = spawn("ffmpeg", args);

    const chunks: Uint8Array[] = [];
    const errors: Uint8Array[] = [];

    ff.stdout.on("data", (chunk: Uint8Array) => {
      chunks.push(chunk);
    });

    ff.stderr.on("data", (chunk: Uint8Array) => {
      errors.push(chunk);
    });

    ff.on("close", (code) => {
      if (code === 0) {
        resolve(Buffer.concat(chunks));
      } else {
        const msg = Buffer.concat(errors).toString("utf-8");
        reject(new Error(`ffmpeg failed with code ${code}: ${msg}`));
      }
    });
  });
}

/**
 * 画像ファイルからサムネイル JPEG を生成
 * HEIC は JPEG に変換
 */
async function generateImageThumbnail(absPath: string): Promise<Buffer> {
  const src = await fs.readFile(absPath);

  const jpegBuffer = await sharp(src, { failOn: "none", limitInputPixels: false })
    .rotate() // EXIF Orientation を適用
    .resize({
      width: THUMB_MAX_WIDTH,
      height: THUMB_MAX_HEIGHT,
      fit: "inside", // 長辺を合わせて等倍縮小
      withoutEnlargement: true,
    })
    .jpeg({ quality: 90 })
    .toBuffer();

  return jpegBuffer;
}

function bufferToArrayBuffer(buf: Buffer): ArrayBuffer {
  const u8 = new Uint8Array(buf.byteLength);
  u8.set(buf);
  return u8.buffer; // これは必ず ArrayBuffer
}

export async function GET(req: NextRequest) {
  const relativePath = req.nextUrl.searchParams.get("path") ?? "";

  try {
    const { abs } = resolveSafePath(relativePath);
    const ext = path.extname(abs).toLowerCase();

    // 画像サムネイル
    if (IMAGE_EXTS.includes(ext)) {
      const buf = await generateImageThumbnail(abs);
      return new NextResponse(bufferToArrayBuffer(buf), {
        headers: {
          "Content-Type": "image/jpeg",
          // サムネイルはある程度キャッシュしてもOKなら public に
          "Cache-Control": "public, max-age=86400",
        },
      });
    }

    // 動画サムネイル
    if (VIDEO_EXTS.includes(ext)) {
      const buf = await generateVideoThumbnail(abs);
      return new NextResponse(bufferToArrayBuffer(buf), {
        headers: {
          "Content-Type": "image/jpeg",
          "Cache-Control": "public, max-age=86400",
        },
      });
    }

    // それ以外は 400
    return NextResponse.json(
      { error: "Unsupported file type for thumbnail" },
      { status: 400 }
    );
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e?.message ?? "Error" }, { status: 400 });
  }
}
