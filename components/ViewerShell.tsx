"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { DirectoryTree, type TreeNode } from "@/components/DirectoryTree";
import { ExifPanel } from "@/components/ExifPanel";
import { SecondaryPane } from "@/components/SecondaryPane";
import { useViewer, type FocusTarget } from "@/components/ViewerContext";
import { useDirectoryTreeController } from "@/hooks/useDirectoryTreeController";
import { useViewerNavigator } from "@/hooks/useViewerNavigator";
import { useFolderDecorations } from "@/hooks/useFolderDecorations";
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
  const [isPaneStateRestored, setIsPaneStateRestored] = useState(false);
  const [isTreeCollapsed, setIsTreeCollapsed] = useState(false);
  const [isExifCollapsed, setIsExifCollapsed] = useState(false);
  const [isCheatSheetOpen, setIsCheatSheetOpen] = useState(false);
  const [primaryToolbar, setPrimaryToolbar] = useState<ReactNode | null>(null);

  useEffect(() => {
    try {
      setIsTreeCollapsed(window.localStorage.getItem("photoViewer:paneCollapsed:tree") === "1");
      setIsExifCollapsed(window.localStorage.getItem("photoViewer:paneCollapsed:exif") === "1");
    } catch {
      // ignore
    } finally {
      setIsPaneStateRestored(true);
    }
  }, []);

  // Pane collapsed state: persist
  useEffect(() => {
    if (!isPaneStateRestored) return;
    try {
      window.localStorage.setItem(
        "photoViewer:paneCollapsed:tree",
        isTreeCollapsed ? "1" : "0"
      );
    } catch {
      // ignore
    }
  }, [isPaneStateRestored, isTreeCollapsed]);

  useEffect(() => {
    if (!isPaneStateRestored) return;
    try {
      window.localStorage.setItem(
        "photoViewer:paneCollapsed:exif",
        isExifCollapsed ? "1" : "0"
      );
    } catch {
      // ignore
    }
  }, [isPaneStateRestored, isExifCollapsed]);

  const {
    selectedEntry,
    endNavigating,
    currentDir,
    cardWidth,
    focusTarget,
    setFocusTarget,
    gridKeyboardControllerRef,
    secondaryGridKeyboardControllerRef,
    secondaryDir,
    isSecondaryPaneOpen,
    openSecondaryPane,
    closeSecondaryPane,
    setSecondaryDir,
    setSecondaryGridKeyboardController,
    secondaryReloadSignal,
    moveItemsToPrimaryDir,
    reloadPrimaryPane,
    registerPrimaryToolbarHost,
  } = useViewer();

  useEffect(() => {
    registerPrimaryToolbarHost(setPrimaryToolbar);
    return () => registerPrimaryToolbarHost(null);
  }, [registerPrimaryToolbarHost]);

  const nav = useViewerNavigator();
  const folderDecorations = useFolderDecorations();

  const treeCtrl = useDirectoryTreeController({
    tree,
    currentDir,
    isFocused: focusTarget === "tree",
    onSelectDir: (p) => nav.pushDir(p),
    onOpenSecondaryDir: (p) => openSecondaryPane(p),
    onDropItems: () => {},
  });

  const secondaryPane = useMemo(() => {
    if (!isSecondaryPaneOpen || !secondaryDir) return null;
    return (
      <SecondaryPane
        dir={secondaryDir}
        cardWidth={cardWidth}
        reloadSignal={secondaryReloadSignal}
        onMoveToMain={moveItemsToPrimaryDir}
        onMainNeedsReload={reloadPrimaryPane}
        onClose={closeSecondaryPane}
        setFocusTarget={setFocusTarget}
        setSecondaryDir={setSecondaryDir}
        setSecondaryGridKeyboardController={setSecondaryGridKeyboardController}
      />
    );
  }, [
    cardWidth,
    closeSecondaryPane,
    isSecondaryPaneOpen,
    moveItemsToPrimaryDir,
    reloadPrimaryPane,
    secondaryDir,
    secondaryReloadSignal,
    setFocusTarget,
    setSecondaryDir,
    setSecondaryGridKeyboardController,
  ]);

  useEffect(() => {
    fetch(`/api/dir-tree?path=.&depth=10`)
      .then((r) => r.json())
      .then((data) => setTree(data.tree ?? null))
      .catch(() => setTree(null));
  }, []);

  useEffect(() => {
    if (!secondaryDir) return;
    if (!tree) return;
    const found = findNodeByPath(tree, secondaryDir);
    if (!found && focusTarget === "secondaryGrid") setFocusTarget("grid");
  }, [tree, secondaryDir, focusTarget, setFocusTarget]);

  useEffect(() => {
    endNavigating();
  }, [pathname, endNavigating]);

  // 全体共通のキーハンドラ：フォーカスに応じて Tree / Grid へ振り分け
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT" ||
        target?.isContentEditable;

      if (!isTyping && (e.key === "?" || (e.key === "/" && e.shiftKey))) {
        e.preventDefault();
        setIsCheatSheetOpen((open) => !open);
        return;
      }

      if (isCheatSheetOpen) {
        if (e.key === "Escape") {
          e.preventDefault();
          setIsCheatSheetOpen(false);
        }
        return;
      }

      if (e.key === "Tab") {
        e.preventDefault();
        const targets: FocusTarget[] =
          isSecondaryPaneOpen && secondaryDir
            ? ["tree", "grid", "secondaryGrid"]
            : ["tree", "grid"];
        const currentIndex = targets.indexOf(focusTarget);
        const baseIndex = currentIndex >= 0 ? currentIndex : targets.indexOf("grid");
        const nextIndex = e.shiftKey
          ? (baseIndex - 1 + targets.length) % targets.length
          : (baseIndex + 1) % targets.length;
        setFocusTarget(targets[nextIndex]);
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
          if (e.shiftKey) treeCtrl.openSecondary();
          else treeCtrl.enter();
        }
        return;
      }

      if (focusTarget === "grid" || focusTarget === "secondaryGrid") {
        const grid =
          focusTarget === "secondaryGrid"
            ? secondaryGridKeyboardControllerRef.current
            : gridKeyboardControllerRef.current;
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
        } else if (e.key === "d") {
          e.preventDefault();
          grid.deleteReviewMarkDelete?.();
        } else if (e.key === "Escape") {
          grid.escape();
        } else if (e.key === "Enter") {
          if (e.metaKey) {
            e.preventDefault();
            grid.commandEnter();
            return;
          }
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
  }, [
    focusTarget,
    isCheatSheetOpen,
    isSecondaryPaneOpen,
    secondaryDir,
    setFocusTarget,
    gridKeyboardControllerRef,
    secondaryGridKeyboardControllerRef,
    treeCtrl,
  ]);

  return (
    <>
      <div className="app-root" data-focus={focusTarget}>
        <aside
          className="sidebar sidebar-left"
          data-pane="tree"
          data-collapsed={isTreeCollapsed ? "true" : "false"}
          onMouseDown={() => setFocusTarget("tree")}
        >
          <div className="pane-header">
            <button
              type="button"
              className="pane-toggle"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setIsTreeCollapsed((v) => !v)}
              aria-label={isTreeCollapsed ? "Expand tree pane" : "Collapse tree pane"}
              title={isTreeCollapsed ? "ツリーを開く" : "ツリーを折り畳む"}
            >
              {isTreeCollapsed ? "»" : "«"}
            </button>
          </div>

          {!isTreeCollapsed && (
            <>

              <DirectoryTree
                tree={tree}
                currentDir={currentDir}
                isFocused={focusTarget === "tree"}
                secondaryDir={isSecondaryPaneOpen ? secondaryDir : null}
                expanded={treeCtrl.expanded}
                focusedPath={treeCtrl.focusedPath}
                dragOverPath={treeCtrl.dragOverPath}
                activeRef={treeCtrl.activeRef}
                cursorRef={treeCtrl.cursorRef}
                setFocusedPath={treeCtrl.setFocusedPath}
                toggleExpanded={treeCtrl.toggleExpanded}
                isInternalMoveDnD={() => false}
                onRowDragEnter={treeCtrl.onRowDragEnter}
                onRowDragOver={treeCtrl.onRowDragOver}
                onRowDragLeave={treeCtrl.onRowDragLeave}
                onRowDrop={treeCtrl.onRowDrop}
                onOpenSecondaryDir={(p) => openSecondaryPane(p)}
                onSelectDir={(p) => nav.pushDir(p)}
                getDecoration={folderDecorations.getDecoration}
                onEditDecoration={folderDecorations.setDecoration}
              />
            </>
          )}
        </aside>

        <main
          className="main"
          data-pane="grid"
          style={
            {
              ["--card-w" as any]: `${cardWidth}px`,
              ["--grid-gap" as any]: `${Math.max(8, Math.round(cardWidth * 0.04))}px`,
            } as React.CSSProperties
          }
        >
          {primaryToolbar}
          <div
            className="main-pane-layout"
            data-secondary-open={isSecondaryPaneOpen ? "true" : "false"}
          >
            <div className="primary-pane" onMouseDown={() => setFocusTarget("grid")}>
              {children}
            </div>
            {secondaryPane}
          </div>
        </main>

        <aside
          className="sidebar sidebar-right"
          data-pane="exif"
          data-collapsed={isExifCollapsed ? "true" : "false"}
          onMouseDown={() => setFocusTarget("grid")}
        >
          <div className="pane-header">
            <button
              type="button"
              className="pane-toggle"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setIsExifCollapsed((v) => !v)}
              aria-label={isExifCollapsed ? "Expand exif pane" : "Collapse exif pane"}
              title={isExifCollapsed ? "EXIFを開く" : "EXIFを折り畳む"}
            >
              {isExifCollapsed ? "«" : "»"}
            </button>
          </div>

          {!isExifCollapsed && <ExifPanel entry={selectedEntry} />}
        </aside>
      </div>

      {isCheatSheetOpen && (
        <div
          className="cheatsheet-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cheatsheet-title"
          onMouseDown={() => setIsCheatSheetOpen(false)}
        >
          <div className="cheatsheet" onMouseDown={(e) => e.stopPropagation()}>
            <div className="cheatsheet-header">
              <h2 id="cheatsheet-title">チートシート</h2>
              <button
                type="button"
                className="cheatsheet-close"
                aria-label="閉じる"
                onClick={() => setIsCheatSheetOpen(false)}
              >
                x
              </button>
            </div>
            <div className="cheatsheet-grid">
              <section>
                <h3>共通</h3>
                <dl>
                  <dt>?</dt>
                  <dd>チートシートを表示 / 閉じる</dd>
                  <dt>Tab</dt>
                  <dd>ツリー / 左ペイン / 右ペインのフォーカス切替</dd>
                  <dt>Shift + Tab</dt>
                  <dd>逆順にフォーカス切替</dd>
                  <dt>Esc</dt>
                  <dd>プレビュー / 削除レビュー / チートシートを閉じる</dd>
                </dl>
              </section>
              <section>
                <h3>一覧</h3>
                <dl>
                  <dt>h / ←</dt>
                  <dd>左へ移動</dd>
                  <dt>l / →</dt>
                  <dd>右へ移動</dd>
                  <dt>j / ↓</dt>
                  <dd>下へ移動</dd>
                  <dt>k / ↑</dt>
                  <dd>上へ移動</dd>
                  <dt>H / J</dt>
                  <dd>次の兄弟フォルダへ移動</dd>
                  <dt>L / K</dt>
                  <dd>前の兄弟フォルダへ移動</dd>
                  <dt>Space</dt>
                  <dd>チェック切替</dd>
                  <dt>Enter</dt>
                  <dd>フォルダに入る / 写真・動画をプレビュー</dd>
                  <dt>Shift + Enter</dt>
                  <dd>一つ上のフォルダへ移動 / プレビューを閉じる</dd>
                  <dt>Cmd + Enter</dt>
                  <dd>削除レビューを開く</dd>
                  <dt>Cmd + A</dt>
                  <dd>表示中の項目をすべてチェック</dd>
                  <dt>Cmd + Shift + A</dt>
                  <dd>表示中のチェックを解除</dd>
                  <dt>b</dt>
                  <dd>バースト選択</dd>
                </dl>
              </section>
              <section>
                <h3>削除レビュー</h3>
                <dl>
                  <dt>h / ←</dt>
                  <dd>前の候補へ移動</dd>
                  <dt>l / →</dt>
                  <dd>次の候補へ移動</dd>
                  <dt>d</dt>
                  <dd>現在の候補に削除マーク</dd>
                  <dt>Esc</dt>
                  <dd>削除レビューを閉じる</dd>
                </dl>
              </section>
              <section>
                <h3>ツリー</h3>
                <dl>
                  <dt>j / k</dt>
                  <dd>カーソル移動</dd>
                  <dt>h / l</dt>
                  <dd>閉じる / 開く</dd>
                  <dt>Enter</dt>
                  <dd>フォルダへ移動</dd>
                  <dt>Shift + Enter</dt>
                  <dd>右ペインでフォルダを開く</dd>
                </dl>
              </section>
              <section>
                <h3>マウス操作</h3>
                <dl>
                  <dt>ダブルクリック</dt>
                  <dd>フォルダに入る / 写真・動画をプレビュー</dd>
                  <dt>Shift + チェック</dt>
                  <dd>前回チェック位置から範囲チェック</dd>
                  <dt>Shift + ツリークリック</dt>
                  <dd>右ペインでフォルダを開く</dd>
                  <dt>ドラッグ</dt>
                  <dd>チェック項目を左右ペイン間で移動</dd>
                  <dt>ツリーの右ペインボタン</dt>
                  <dd>右ペインでフォルダを開く</dd>
                </dl>
              </section>
              <section>
                <h3>タイムライン</h3>
                <dl>
                  <dt>クリック</dt>
                  <dd>スロット内の写真・動画を下に一覧表示</dd>
                  <dt>Option + ホイール</dt>
                  <dd>スロット間隔を変更</dd>
                  <dt>サブツールバー</dt>
                  <dd>間隔と空き時間の詰め方を変更</dd>
                </dl>
              </section>
              <section>
                <h3>カレンダー</h3>
                <dl>
                  <dt>対象フォルダ</dt>
                  <dd>yyyy/mm 形式の月フォルダで表示</dd>
                  <dt>ダブルクリック</dt>
                  <dd>日付フォルダに入る</dd>
                  <dt>サブツールバー</dt>
                  <dd>週の始まりを変更</dd>
                </dl>
              </section>
              <section>
                <h3>ツールバー</h3>
                <dl>
                  <dt>削除</dt>
                  <dd>チェック項目を削除</dd>
                  <dt>移動</dt>
                  <dd>左右ペイン間でチェック項目を移動</dd>
                  <dt>EXIF更新</dt>
                  <dd>選択したファイル / フォルダのキャッシュを更新</dd>
                  <dt>サイズ</dt>
                  <dd>一覧とタイムライン下のサムネイルサイズを変更</dd>
                </dl>
              </section>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
