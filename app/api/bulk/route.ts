import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { resolveSafePath } from "../../../lib/fs";

type BulkDelete = { action: "delete"; items: string[] };
type BulkMove = { action: "move"; items: string[]; dest: string };
type BulkBody = BulkDelete | BulkMove;

export async function POST(req: NextRequest) {
  const body = (await req.json()) as BulkBody;

  try {
    if (!body || !("action" in body)) {
      throw new Error("Invalid request body");
    }

    if (body.action === "delete") {
      for (const item of body.items) {
        const { abs } = resolveSafePath(item);
        await fs.rm(abs, { recursive: true, force: true });
      }
    } else if (body.action === "move") {
      const { abs: destAbs } = resolveSafePath(body.dest);
      await fs.mkdir(destAbs, { recursive: true });

      for (const item of body.items) {
        const { abs } = resolveSafePath(item);
        const basename = path.basename(abs);
        await fs.rename(abs, path.join(destAbs, basename));
      }
    } else {
      throw new Error("Unknown action");
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message ?? "Error" },
      { status: 400 }
    );
  }
}
