"use client";

import { useEffect, useState, useRef, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { DirectoryTree, type TreeNode, type DirectoryTreeHandle } from "@/components/DirectoryTree";
import { ExifPanel } from "@/components/ExifPanel";
import { useViewer } from "@/components/ViewerContext";
import { useViewerNavigator } from "@/hooks/useViewerNavigator";
import { normalizeDir } from "@/lib/path";

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
  const pathname = usePathname();
  const [tree, setTree] = useState<TreeNode | null>(null);

  const {
    selectedEntry,
    endNavigating,
    currentDir,
    cardWidth,
    focusTarget,
    setFocusTarget,
    markedDir,
    setMarkedDir,
    moveToDir,
  } = useViewer();

  const nav = useViewerNavigator();

  const treeRef = useRef<DirectoryTreeHandle | null>(null);

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
            nav.goParent();
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
            nav.pushDir(p);
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
