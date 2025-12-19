import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { resolveSafePath } from "@/lib/fs";

type TreeNode = {
  name: string;
  path: string; // ROOT_DIR からの相対
  children: TreeNode[];
};

function nodeName(relPath: string) {
  if (relPath === "." || relPath === "") return "ROOT";
  return relPath.split("/").filter(Boolean).at(-1) ?? relPath;
}

// 深掘りしすぎ防止（重くなるので）
const DEFAULT_MAX_DEPTH = 3;

async function buildTree(
  absDir: string,
  relDir: string,
  depth: number,
  maxDepth: number
): Promise<TreeNode> {
  const name = nodeName(relDir);
  const node: TreeNode = { name, path: relDir || ".", children: [] };

  if (depth >= maxDepth) return node;

  const items = await fs.readdir(absDir, { withFileTypes: true });
  const dirs = items
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort((a, b) => a.localeCompare(b, "ja"));

  for (const d of dirs) {
    const childRel = relDir === "." || relDir === "" ? d : `${relDir}/${d}`;
    const { abs: childAbs } = resolveSafePath(childRel);

    // 例外は握り潰してスキップ（Dropbox権限など）
    try {
      const child = await buildTree(childAbs, childRel, depth + 1, maxDepth);
      node.children.push(child);
    } catch {
      // skip
    }
  }

  return node;
}

export async function GET(req: NextRequest) {
  const rel = req.nextUrl.searchParams.get("path") ?? ".";
  const maxDepth = Number(
    req.nextUrl.searchParams.get("depth") ?? DEFAULT_MAX_DEPTH
  );
  const depth = Number.isFinite(maxDepth)
    ? Math.max(1, Math.min(10, maxDepth))
    : DEFAULT_MAX_DEPTH;

  try {
    const { abs, relative } = resolveSafePath(rel);
    const tree = await buildTree(abs, relative || ".", 0, depth);
    return NextResponse.json({ tree });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json(
      { error: e.message ?? "dir-tree error" },
      { status: 400 }
    );
  }
}
