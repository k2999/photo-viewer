"use client";

import { useEffect, useMemo, useState, useCallback, useRef, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { DirectoryTree, type TreeNode, type DirectoryTreeHandle } from "@/components/DirectoryTree";
import { ExifPanel } from "@/components/ExifPanel";
import { useViewer, type ViewerNavigator } from "@/components/ViewerContext";
import { pathnameToDir, dirToUrl, parentDir, normalizeDir } from "@/lib/path";

function findNodeByPath(node: TreeNode | null, path: string): TreeNode | null {
  if (!node) return null;
  if (normalizeDir(node.path) === normalizeDir(path)) return node;
  for (const c of node.children ?? []) {
    const found = findNodeByPath(c, path);
    if (found) return found;
  }
  return null;
}

export function ViewerShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [tree, setTree] = useState<TreeNode | null>(null);

  const {
    selectedEntry,
    bumpNavGen,
    endNavigating,
    currentDir,
    setCurrentDir,
    setNavigator,
    cardWidth,
    focusTarget,
    setFocusTarget,
    markedDir,
    setMarkedDir,
    moveToDir,
  } = useViewer();

  const treeRef = useRef<DirectoryTreeHandle | null>(null);

  const dirFromUrl = useMemo(() => pathnameToDir(pathname), [pathname]);

  useEffect(() => {
    fetch(`/api/dir-tree?path=.&depth=3`)
      .then((r) => r.json())
      .then((data) => setTree(data.tree ?? null))
      .catch(() => setTree(null));
  }, []);

  // markedDir がツリー内に存在しないなら解除（外部変更検知はしない方針の一部として起動時/ツリー更新時のみ）
  useEffect(() => {
    if (!markedDir) return;
    if (!tree) return;
    const found = findNodeByPath(tree, markedDir);
    if (!found) {
      setMarkedDir(null);
    }
  }, [tree, markedDir, setMarkedDir]);

  useEffect(() => {
    endNavigating();
  }, [pathname, endNavigating]);

  useEffect(() => {
    setCurrentDir(dirFromUrl);
  }, [dirFromUrl, setCurrentDir]);

  const pushDir = useCallback(
    (dirPath: string) => {
      bumpNavGen();
      router.push(dirToUrl(dirPath));
    },
    [bumpNavGen, router]
  );

  const goParent = useCallback(() => {
    const cur = normalizeDir(currentDir);
    if (cur === ".") return;
    bumpNavGen();
    router.push(dirToUrl(parentDir(cur)));
  }, [currentDir, bumpNavGen, router]);

  const goSiblingDir = useCallback(
    (delta: -1 | 1) => {
      const cur = normalizeDir(currentDir);
      if (cur === ".") return;
      const parent = normalizeDir(parentDir(cur));
      const parentNode = findNodeByPath(tree, parent);
      const siblingsRaw = parentNode?.children?.map((c) => c.path) ?? [];
      const siblings = siblingsRaw.map((p) => normalizeDir(p));
      if (siblings.length === 0) return;
      const idx = siblings.indexOf(cur);
      if (idx < 0) return;
      const nextIdx = idx + delta;
      if (nextIdx < 0 || nextIdx >= siblings.length) return;
      bumpNavGen();
      router.push(dirToUrl(siblings[nextIdx]));
    },
    [currentDir, tree, bumpNavGen, router]
  );

  useEffect(() => {
    const nav: ViewerNavigator = { pushDir, goParent, goSiblingDir };
    setNavigator(nav);
    return () => setNavigator(null);
  }, [pushDir, goParent, goSiblingDir, setNavigator]);

  // Tabで Tree ⇄ Grid
  // Tree フォーカス中は hjkl/Enter を Tree へ転送
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Tab") {
        e.preventDefault();
        setFocusTarget(focusTarget === "tree" ? "grid" : "tree");
        return;
      }
      if (focusTarget !== "tree") return;

      // Tree用キーだけ拾う（それ以外は何もしない）
      if (
        e.key === "h" ||
        e.key === "j" ||
        e.key === "k" ||
        e.key === "l" ||
        e.key === "Enter" ||
        e.key === " "
      ) {
        treeRef.current?.handleKey(e);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [focusTarget, setFocusTarget]);

  return (
    <div className="app-root" data-focus={focusTarget}>
      <aside
        className="sidebar"
        data-pane="tree"
        onMouseDown={() => setFocusTarget("tree")}
      >
        <div className="sidebar-title">Directory</div>

        <div className="sidebar-code">
          ROOT: <code>{process.env.NEXT_PUBLIC_ROOT_LABEL ?? "ROOT_DIR"}</code>
          <br />
          PATH: <code>{currentDir}</code>
        </div>

        <button
          className="sidebar-button"
          onClick={() => {
            goParent();
          }}
        >
          ↑ 親ディレクトリへ
        </button>

        <DirectoryTree
          ref={treeRef}
          tree={tree}
          currentDir={currentDir}
          isFocused={focusTarget === "tree"}
          markedDir={markedDir}
          onMarkDir={(p) => setMarkedDir(p)}
          onSelectDir={(p) => {
            pushDir(p);
          }}
          onDropItems={(destDir, items) => {
            moveToDir?.(destDir, items);
          }}
        />

        <ExifPanel entry={selectedEntry} />
      </aside>

      <main
        className="main"
        data-pane="grid"
        onMouseDown={() => setFocusTarget("grid")}
        style={
          {
            ["--card-w" as any]: `${cardWidth}px`,
            ["--grid-gap" as any]: `${Math.max(8, Math.round(cardWidth * 0.04))}px`,
          } as React.CSSProperties
        }
      >
        {children}
      </main>
    </div>
  );
}
