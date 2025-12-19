import { NextRequest, NextResponse } from "next/server";
import { listDir } from "../../../lib/fs";

export async function GET(req: NextRequest) {
  const relativePath = req.nextUrl.searchParams.get("path") ?? ".";
  try {
    const entries = await listDir(relativePath);
    return NextResponse.json({ entries });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message ?? "Error" },
      { status: 400 }
    );
  }
}
