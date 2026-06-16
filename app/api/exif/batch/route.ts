import { NextRequest, NextResponse } from "next/server";
import { getExifForPaths } from "@/lib/exifCacheServer";

type BatchBody = {
  paths?: string[];
  force?: boolean;
  recursive?: boolean;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as BatchBody;
    const paths = Array.isArray(body.paths) ? body.paths.filter((p) => typeof p === "string") : [];
    if (paths.length === 0) {
      return NextResponse.json({ error: "paths required" }, { status: 400 });
    }

    const results = await getExifForPaths(paths, {
      force: body.force === true,
      recursive: body.recursive === true,
    });

    return NextResponse.json({ ok: true, results });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json(
      { error: e.message ?? "exif batch failed" },
      { status: 500 }
    );
  }
}
