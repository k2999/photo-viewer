import { normalizeDir } from "@/lib/path";

export type PathTreeNode = {
  path: string;
  children?: PathTreeNode[];
};

export function hasChildren(node: { children?: unknown[] } | null | undefined): boolean {
  return (node?.children?.length ?? 0) > 0;
}

export function findNodeByPath<T extends PathTreeNode>(node: T | null, path: string): T | null {
  if (!node) return null;
  if (normalizeDir(node.path) === normalizeDir(path)) return node;
  for (const c of node.children ?? []) {
    const found = findNodeByPath(c as T, path);
    if (found) return found;
  }
  return null;
}

export function ancestorPathsOf(currentDir: string): string[] {
  const norm = normalizeDir(currentDir || ".");
  if (norm === ".") return [];
  const parts = norm.split("/").filter(Boolean);

  const acc: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    acc.push(parts.slice(0, i + 1).join("/"));
  }
  return acc;
}
