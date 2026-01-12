"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { DirectoryTree, type TreeNode } from "@/components/DirectoryTree";
import { ExifPanel } from "@/components/ExifPanel";
import { useViewer } from "@/components/ViewerContext";
import { useDirectoryTreeController } from "@/hooks/useDirectoryTreeController";
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
    gridKeyboardControllerRef,
    markedDir,
    setMarkedDir,
    moveToDir,
  } = useViewer();

  const nav = useViewerNavigator();

  const treeCtrl = useDirectoryTreeController({
    tree,
    currentDir,
    isFocused: focusTarget === "tree",
    markedDir,
    onSelectDir: (p) => nav.pushDir(p),
    onMarkDir: (p) => setMarkedDir(p),
    onDropItems: (destDir, items) => {
      moveToDir?.(destDir, items);
    },
  });

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

  // 全体共通のキーハンドラ：フォーカスに応じて Tree / Grid へ振り分け
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Tab") {
        e.preventDefault();
        setFocusTarget(focusTarget === "tree" ? "grid" : "tree");
        return;
      }

      if (focusTarget === "tree") {
        // Tree用キーだけ拾う（それ以外は何もしない）
        if (e.key === "j") {
          e.preventDefault();
          treeCtrl.cursorDown();
        } else if (e.key === "k") {
          e.preventDefault();
          treeCtrl.cursorUp();
        } else if (e.key === "h") {
          e.preventDefault();
          treeCtrl.collapseOrParent();
        } else if (e.key === "l") {
          e.preventDefault();
          treeCtrl.expandOrFirstChild();
        } else if (e.key === "Enter") {
          e.preventDefault();
          treeCtrl.enter();
        } else if (e.key === " ") {
          e.preventDefault();
          treeCtrl.toggleMark();
        }
        return;
      }

      if (focusTarget === "grid") {
        const grid = gridKeyboardControllerRef.current;
        if (!grid) return;

        if (e.key === "h" || e.key === "ArrowLeft") {
          e.preventDefault();
          grid.selectLeft();
        } else if (e.key === "l" || e.key === "ArrowRight") {
          e.preventDefault();
          grid.selectRight();
        } else if (e.key === "j" || e.key === "ArrowDown") {
          e.preventDefault();
          grid.selectDown();
        } else if (e.key === "k" || e.key === "ArrowUp") {
          e.preventDefault();
          grid.selectUp();
        } else if (e.key === "H" || e.key === "J") {
          e.preventDefault();
          grid.goSiblingDir(1);
        } else if (e.key === "L" || e.key === "K") {
          e.preventDefault();
          grid.goSiblingDir(-1);
        } else if (e.key === " ") {
          e.preventDefault();
          grid.toggleCheckSelected();
        } else if (e.metaKey && e.key === "a") {
          e.preventDefault();
          if (!e.shiftKey) grid.selectAll();
          else grid.deselectAll();
        } else if (e.key === "b") {
          e.preventDefault();
          grid.selectBurst();
        } else if (e.key === "Escape") {
          grid.escape();
        } else if (e.key === "Enter") {
          if (!e.shiftKey) {
            e.preventDefault();
            grid.enter();
          } else {
            e.preventDefault();
            grid.shiftEnter();
          }
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [focusTarget, setFocusTarget, gridKeyboardControllerRef, treeCtrl]);

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
          tree={tree}
          currentDir={currentDir}
          isFocused={focusTarget === "tree"}
          markedDir={markedDir}
          expanded={treeCtrl.expanded}
          focusedPath={treeCtrl.focusedPath}
          dragOverPath={treeCtrl.dragOverPath}
          activeRef={treeCtrl.activeRef}
          cursorRef={treeCtrl.cursorRef}
          setFocusedPath={treeCtrl.setFocusedPath}
          toggleExpanded={treeCtrl.toggleExpanded}
          isInternalMoveDnD={treeCtrl.isInternalMoveDnD}
          onRowDragEnter={treeCtrl.onRowDragEnter}
          onRowDragOver={treeCtrl.onRowDragOver}
          onRowDragLeave={treeCtrl.onRowDragLeave}
          onRowDrop={treeCtrl.onRowDrop}
          onMarkDir={(p) => setMarkedDir(p)}
          onSelectDir={(p) => nav.pushDir(p)}
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
