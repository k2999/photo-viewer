import { NextRequest, NextResponse } from "next/server";
import {
  readFolderDecorations,
  setFolderDecoration,
  validateAndNormalizeDir,
  validateDecoration,
} from "@/lib/folderDecorationsServer";

export async function GET() {
  try {
    const decorations = await readFolderDecorations();
    return NextResponse.json({ decorations });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json(
      { error: e?.message ?? "folder-decorations error" },
      { status: 500 }
    );
  }
}

type PostBody = {
  path: string;
  decoration?: unknown;
  clear?: boolean;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as PostBody;
    const dir = validateAndNormalizeDir(body?.path);

    const clear = body?.clear === true;
    const decoration = clear ? null : validateDecoration(body?.decoration);

    const decorations = await setFolderDecoration(dir, decoration);
    return NextResponse.json({ decorations });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "folder-decorations error" },
      { status: 400 }
    );
  }
}
