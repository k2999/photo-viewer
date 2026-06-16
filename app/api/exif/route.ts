import { NextRequest, NextResponse } from "next/server";
import { getExifForPaths } from "@/lib/exifCacheServer";

export async function GET(req: NextRequest) {
  const rel = req.nextUrl.searchParams.get("path");
  const force = req.nextUrl.searchParams.get("force") === "1";
  if (!rel) {
    return NextResponse.json({ error: "path required" }, { status: 400 });
  }

  try {
    const [result] = await getExifForPaths([rel], { force });
    if (!result?.exif) {
      return NextResponse.json(
        { path: result?.path ?? rel, error: result?.error ?? "exif unavailable" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      path: result.path,
      exif: result.exif,
      cached: result.cached,
    });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json(
      { error: e.message ?? "exif failed" },
      { status: 500 }
    );
  }
}
