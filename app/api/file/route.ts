import { NextRequest, NextResponse } from "next/server";
import fsPromises from "node:fs/promises";
import fs from "node:fs";
import path from "node:path";
import { resolveSafePath } from "../../../lib/fs";
import sharp from "sharp";

export const runtime = "nodejs";

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

const VIDEO_EXTS = new Set([".mp4", ".mov", ".avi", ".mkv"]);

function nodeStreamToWeb(stream: fs.ReadStream): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      stream.on("data", (chunk: Buffer | string) => {
        const buf = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
        controller.enqueue(new Uint8Array(buf));
      });
      stream.on("end", () => controller.close());
      stream.on("error", (err) => controller.error(err));
    },
    cancel() {
      stream.destroy();
    },
  });
}

function parseRange(rangeHeader: string, size: number) {
  // "bytes=0-" / "bytes=100-200" のみ対応
  const m = /^bytes=(\d+)-(\d+)?$/i.exec(rangeHeader.trim());
  if (!m) return null;
  const start = Number(m[1]);
  let end = m[2] ? Number(m[2]) : size - 1;
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  if (start < 0 || start >= size) return null;
  if (end < start) return null;
  if (end >= size) end = size - 1;
  return { start, end };
}

export async function GET(req: NextRequest) {
  const relativePath = req.nextUrl.searchParams.get("path") ?? "";
  try {
    const { abs } = resolveSafePath(relativePath);
    const ext = path.extname(abs).toLowerCase();

    if (ext === ".heic") {
      const src = await fsPromises.readFile(abs);

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

    const contentType = mimeMap[ext] ?? "application/octet-stream";

    const stat = await fsPromises.stat(abs);
    if (!stat.isFile()) {
      return NextResponse.json({ error: "Not a file" }, { status: 400 });
    }
    const size = stat.size;

    // 動画は Range 対応（シークに必須）
    if (VIDEO_EXTS.has(ext)) {
      const range = req.headers.get("range");

      // Range なし：全量をストリーム
      if (!range) {
        const stream = fs.createReadStream(abs);
        return new NextResponse(nodeStreamToWeb(stream), {
          status: 200,
          headers: {
            "Content-Type": contentType,
            "Content-Length": String(size),
            "Accept-Ranges": "bytes",
            "Cache-Control": "no-store",
          },
        });
      }

      const parsed = parseRange(range, size);
      if (!parsed) {
        return new NextResponse(null, {
          status: 416,
          headers: {
            "Content-Range": `bytes */${size}`,
            "Accept-Ranges": "bytes",
            "Cache-Control": "no-store",
          },
        });
      }

      const { start, end } = parsed;
      const chunkSize = end - start + 1;
      const stream = fs.createReadStream(abs, { start, end });

      return new NextResponse(nodeStreamToWeb(stream), {
        status: 206,
        headers: {
          "Content-Type": contentType,
          "Content-Length": String(chunkSize),
          "Content-Range": `bytes ${start}-${end}/${size}`,
          "Accept-Ranges": "bytes",
          "Cache-Control": "no-store",
        },
      });
    }

    // 画像/その他：全量 readFile ではなくストリーム（メモリ負荷軽減）
    const stream = fs.createReadStream(abs);
    return new NextResponse(nodeStreamToWeb(stream), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(size),
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
