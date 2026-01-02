import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { resolveSafePath } from "../../../lib/fs";

type BulkDelete = { action: "delete"; items: string[] };

type ConflictStrategy = "ask" | "overwrite" | "skip" | "rename";
type BulkMove = {
  action: "move";
  items: string[]; // 逐次でもOK（通常は1件ずつ送る）
  dest: string;
  onConflict?: ConflictStrategy; // ask(default) / overwrite / skip / rename
};

type BulkBody = BulkDelete | BulkMove;

async function exists(p: string): Promise<boolean> {
  try {
    await fs.stat(p);
    return true;
  } catch {
    return false;
  }
}

function splitNameExt(base: string): { name: string; ext: string } {
  const ext = path.extname(base);
  const name = ext ? base.slice(0, -ext.length) : base;
  return { name, ext };
}

async function makeTildeRenamePath(destAbs: string, base: string): Promise<string> {
  const { name, ext } = splitNameExt(base);
  for (let i = 2; i < 100; i++) {
    const candidate = `${name}~${i}${ext}`;
    const full = path.join(destAbs, candidate);
    if (!(await exists(full))) return full;
  }
  throw new Error("Failed to generate unique rename");
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as BulkBody;

  try {
    if (!body || !("action" in body)) throw new Error("Invalid request body");

    if (body.action === "delete") {
      for (const item of body.items) {
        const { abs } = resolveSafePath(item);
        await fs.rm(abs, { recursive: true, force: true });
      }
      return NextResponse.json({ ok: true });
    }

    if (body.action === "move") {
      const onConflict: ConflictStrategy = body.onConflict ?? "ask";

      const { abs: destAbs } = resolveSafePath(body.dest);
      await fs.mkdir(destAbs, { recursive: true });

      const results: Array<{
        item: string;
        status: "moved" | "skipped";
        destPath?: string;
      }> = [];

      for (const item of body.items) {
        const { abs: srcAbs } = resolveSafePath(item);
        const base = path.basename(srcAbs);

        // dest は常に「basename を維持」
        const destPath = path.join(destAbs, base);

        // src が無い（既に移動済み等）は skip 扱い
        if (!(await exists(srcAbs))) {
          results.push({ item, status: "skipped" });
          continue;
        }

        const destExists = await exists(destPath);
        if (!destExists) {
          await fs.rename(srcAbs, destPath);
          results.push({ item, status: "moved", destPath: base });
          continue;
        }

        // 衝突
        if (onConflict === "ask") {
          return NextResponse.json(
            {
              conflict: true,
              item,
              dest: body.dest,
              existingName: base,
            },
            { status: 409 }
          );
        }

        if (onConflict === "skip") {
          results.push({ item, status: "skipped" });
          continue;
        }

        if (onConflict === "overwrite") {
          // 既存を削除して上書き（ディレクトリも想定し recursive）
          await fs.rm(destPath, { recursive: true, force: true });
          await fs.rename(srcAbs, destPath);
          results.push({ item, status: "moved", destPath: base });
          continue;
        }

        if (onConflict === "rename") {
          const renamedFull = await makeTildeRenamePath(destAbs, base);
          await fs.rename(srcAbs, renamedFull);
          results.push({
            item,
            status: "moved",
            destPath: path.basename(renamedFull),
          });
          continue;
        }

        throw new Error("Unknown onConflict");
      }

      return NextResponse.json({ ok: true, results });
    }

    throw new Error("Unknown action");
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Error" }, { status: 400 });
  }
}
