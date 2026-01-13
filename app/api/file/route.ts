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

function buildEtag(stat: { size: number; mtimeMs: number }, variant: string) {
  // weak ETag: サイズ/更新時刻/変換パラメータ相当で十分
  return `W/"${stat.size}-${Math.floor(stat.mtimeMs)}-${variant}"`;
}

function cachingHeaders(args: {
  contentType: string;
  etag: string;
  lastModified: Date;
  contentLength?: number;
  acceptRanges?: boolean;
}) {
  const h: Record<string, string> = {
    "Content-Type": args.contentType,
    ETag: args.etag,
    "Last-Modified": args.lastModified.toUTCString(),
    // 即時反映を優先：キャッシュは許可するが毎回 revalidate させる
    // (ETag が一致すれば 304 で軽くなる)
    "Cache-Control": "private, max-age=0, must-revalidate",
  };
  if (args.contentLength != null) h["Content-Length"] = String(args.contentLength);
  if (args.acceptRanges) h["Accept-Ranges"] = "bytes";
  return h;
}

function isNotModified(req: NextRequest, etag: string) {
  const inm = req.headers.get("if-none-match");
  if (!inm) return false;
  // 複数ETag / * は最低限対応
  if (inm.trim() === "*") return true;
  return inm
    .split(",")
    .map((s) => s.trim())
    .some((v) => v === etag);
}

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

    const stat = await fsPromises.stat(abs);
    if (!stat.isFile()) {
      return NextResponse.json({ error: "Not a file" }, { status: 400 });
    }
    const size = stat.size;

    const baseContentType = mimeMap[ext] ?? "application/octet-stream";

    if (ext === ".heic") {
      const etag = buildEtag(stat, "heic->jpeg:q90");
      if (isNotModified(req, etag)) {
        return new NextResponse(null, {
          status: 304,
          headers: cachingHeaders({
            contentType: "image/jpeg",
            etag,
            lastModified: stat.mtime,
          }),
        });
      }

      const src = await fsPromises.readFile(abs);

      // 必要ならサイズや画質は調整可能
      const jpegBuffer = await sharp(src, { failOn: "none", limitInputPixels: false })
        .rotate() // EXIF の向きを反映
        .jpeg({ quality: 90 })
        .toBuffer();

      const body = new Uint8Array(jpegBuffer);
      return new NextResponse(body, {
        headers: {
          ...cachingHeaders({
            contentType: "image/jpeg",
            etag,
            lastModified: stat.mtime,
            contentLength: body.byteLength,
          }),
        },
      });
    }

    const etag = buildEtag(stat, "raw");
    if (isNotModified(req, etag)) {
      return new NextResponse(null, {
        status: 304,
        headers: cachingHeaders({
          contentType: baseContentType,
          etag,
          lastModified: stat.mtime,
        }),
      });
    }

    // 動画は Range 対応（シークに必須）
    if (VIDEO_EXTS.has(ext)) {
      const range = req.headers.get("range");
      const ifRange = req.headers.get("if-range");
      const rangeAllowed = !ifRange || ifRange.trim() === etag;

      // Range なし：全量をストリーム
      if (!range || !rangeAllowed) {
        const stream = fs.createReadStream(abs);
        return new NextResponse(nodeStreamToWeb(stream), {
          status: 200,
          headers: {
            ...cachingHeaders({
              contentType: baseContentType,
              etag,
              lastModified: stat.mtime,
              contentLength: size,
              acceptRanges: true,
            }),
          },
        });
      }

      const parsed = parseRange(range, size);
      if (!parsed) {
        return new NextResponse(null, {
          status: 416,
          headers: {
            "Content-Range": `bytes */${size}`,
            ...cachingHeaders({
              contentType: baseContentType,
              etag,
              lastModified: stat.mtime,
              acceptRanges: true,
            }),
          },
        });
      }

      const { start, end } = parsed;
      const chunkSize = end - start + 1;
      const stream = fs.createReadStream(abs, { start, end });

      return new NextResponse(nodeStreamToWeb(stream), {
        status: 206,
        headers: {
          "Content-Length": String(chunkSize),
          "Content-Range": `bytes ${start}-${end}/${size}`,
          ...cachingHeaders({
            contentType: baseContentType,
            etag,
            lastModified: stat.mtime,
            acceptRanges: true,
          }),
        },
      });
    }

    // 画像/その他：全量 readFile ではなくストリーム（メモリ負荷軽減）
    const stream = fs.createReadStream(abs);
    return new NextResponse(nodeStreamToWeb(stream), {
      status: 200,
      headers: {
        ...cachingHeaders({
          contentType: baseContentType,
          etag,
          lastModified: stat.mtime,
          contentLength: size,
        }),
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
