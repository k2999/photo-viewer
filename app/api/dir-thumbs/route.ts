import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { resolveSafePath } from "@/lib/fs";

const IMAGE_EXTS = [".jpg", ".jpeg", ".png", ".heic", ".webp"];

export async function GET(req: NextRequest) {
  const rel = req.nextUrl.searchParams.get("path") ?? ".";
  const { abs, relative } = resolveSafePath(rel);

  const entries = await fs.readdir(abs, { withFileTypes: true });

  // ① 画像ファイルだけ
  const images = entries
    .filter(
      (e) =>
        e.isFile() && IMAGE_EXTS.includes(path.extname(e.name).toLowerCase())
    )
    // ② ファイル名順（ここがポイント）
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b, "ja"))
    // ③ 最大4件
    .slice(0, 4)
    // ④ relative path に変換
    .map((name) => path.posix.join(relative, name));

  return NextResponse.json({
    thumbs: images,
  });
}
