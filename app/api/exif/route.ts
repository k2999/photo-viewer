import { NextRequest, NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";
import { resolveSafePath } from "@/lib/fs";

const execFileAsync = promisify(execFile);

export async function GET(req: NextRequest) {
  const rel = req.nextUrl.searchParams.get("path");
  if (!rel) {
    return NextResponse.json({ error: "path required" }, { status: 400 });
  }

  try {
    const { abs, relative } = resolveSafePath(rel);

    // 必要なタグだけに絞る（重要：高速化）
    const args = [
      "-j",
      "-a",
    //   "-G1",
    //   "-s",
      "-Model",
      "-LensModel",
      "-CreateDate",
      "-DateTimeOriginal",
      "-CreationDate",
      "-ImageWidth",
      "-ImageHeight",
      "-Duration",
      abs,
    ];

    const { stdout } = await execFileAsync("exiftool", args, {
      maxBuffer: 5 * 1024 * 1024,
    });

    const data = JSON.parse(stdout)[0] ?? {};

    return NextResponse.json({
      path: relative,
      exif: data,
    });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json(
      { error: e.message ?? "exif failed" },
      { status: 500 }
    );
  }
}
