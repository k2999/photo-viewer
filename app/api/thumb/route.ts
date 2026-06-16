// app/api/thumb/route.ts
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import sharp from "sharp";
import { spawn } from "child_process";
import { ROOT_DIR, resolveSafePath } from "../../../lib/fs";

export const runtime = "nodejs";

const IMAGE_EXTS = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".heic"];
const VIDEO_EXTS = [".mp4", ".mov", ".m4v", ".avi", ".mkv"];

const THUMB_MAX_WIDTH = 500;
const THUMB_MAX_HEIGHT = 500;
const THUMB_CACHE_DIR = path.join(ROOT_DIR, ".photo-viewer", "thumb-cache");

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

function cacheKeyFor(args: {
  relativePath: string;
  mtimeMs: number;
  size: number;
  width: number;
  height: number;
}) {
  return crypto
    .createHash("sha256")
    .update(
      JSON.stringify({
        v: 1,
        path: args.relativePath,
        mtimeMs: Math.trunc(args.mtimeMs),
        size: args.size,
        width: args.width,
        height: args.height,
      })
    )
    .digest("hex");
}

async function readCachedThumbnail(cachePath: string) {
  try {
    return await fs.readFile(cachePath);
  } catch {
    return null;
  }
}

async function writeCachedThumbnail(cachePath: string, buf: Buffer) {
  await fs.mkdir(path.dirname(cachePath), { recursive: true });
  const tmp = `${cachePath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, buf);
  await fs.rename(tmp, cachePath);
}

function jpegResponse(buf: Buffer, cacheStatus: "HIT" | "MISS") {
  return new NextResponse(bufferToArrayBuffer(buf), {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Thumb-Cache": cacheStatus,
    },
  });
}

export async function GET(req: NextRequest) {
  const relativePath = req.nextUrl.searchParams.get("path") ?? "";

  try {
    const { abs, relative } = resolveSafePath(relativePath);
    const ext = path.extname(abs).toLowerCase();
    const stat = await fs.stat(abs);
    const cacheKey = cacheKeyFor({
      relativePath: relative,
      mtimeMs: stat.mtimeMs,
      size: stat.size,
      width: THUMB_MAX_WIDTH,
      height: THUMB_MAX_HEIGHT,
    });
    const cachePath = path.join(THUMB_CACHE_DIR, `${cacheKey}.jpg`);
    const cached = await readCachedThumbnail(cachePath);
    if (cached) return jpegResponse(cached, "HIT");

    // 画像サムネイル
    if (IMAGE_EXTS.includes(ext)) {
      const buf = await generateImageThumbnail(abs);
      await writeCachedThumbnail(cachePath, buf);
      return jpegResponse(buf, "MISS");
    }

    // 動画サムネイル
    if (VIDEO_EXTS.includes(ext)) {
      const buf = await generateVideoThumbnail(abs);
      await writeCachedThumbnail(cachePath, buf);
      return jpegResponse(buf, "MISS");
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
