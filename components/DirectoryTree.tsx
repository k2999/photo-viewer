"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  forwardRef,
  useImperativeHandle,
} from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChevronDown,
  faChevronRight,
  faFolder,
  faFolderOpen,
  faBookmark,
} from "@fortawesome/free-solid-svg-icons";
import { normalizeDir } from "@/lib/path";

export type TreeNode = {
  name: string;
  path: string;
  children: TreeNode[];
};

export type DirectoryTreeHandle = {
  handleKey: (e: KeyboardEvent) => void;
};

type DropPayload = { kind: "photoViewer:moveItems"; items: string[] };

type Props = {
  tree: TreeNode | null;
  currentDir: string;
  onSelectDir: (path: string) => void;
  isFocused: boolean;
  markedDir: string | null;
  onMarkDir: (path: string | null) => void;
  onDropItems: (destDir: string, items: string[]) => void;
};

function hasChildren(n: TreeNode) {
  return (n.children?.length ?? 0) > 0;
}

export const DirectoryTree = forwardRef<DirectoryTreeHandle, Props>(
  function DirectoryTreeInner(
    {
      tree,
      currentDir,
      onSelectDir,
      isFocused,
      markedDir,
      onMarkDir,
      onDropItems,
    },
    ref
  ) {
    const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

    // ツリー内カーソル（currentDir とは独立）
    const [focusedPath, setFocusedPath] = useState<string>(".");

    const activeRef = useRef<HTMLDivElement | null>(null); // currentDir の行
    const cursorRef = useRef<HTMLDivElement | null>(null); // focusedPath の行

    // ===== DnD: dragOver + hover(600ms) auto expand =====
    const [dragOverPath, setDragOverPath] = useState<string | null>(null);
    const hoverTimerRef = useRef<number | null>(null);
    const hoverPathRef = useRef<string | null>(null);

    const clearHoverTimer = useCallback(() => {
      if (hoverTimerRef.current != null) {
        window.clearTimeout(hoverTimerRef.current);
        hoverTimerRef.current = null;
      }
      hoverPathRef.current = null;
    }, []);

    useEffect(() => {
      return () => clearHoverTimer();
    }, [clearHoverTimer]);

    const scheduleAutoExpand = useCallback(
      (p: string, expandable: boolean, alreadyOpen: boolean) => {
        if (!expandable) return;
        if (alreadyOpen) return;

        if (hoverPathRef.current === p && hoverTimerRef.current != null) return;

        clearHoverTimer();
        hoverPathRef.current = p;
        hoverTimerRef.current = window.setTimeout(() => {
          setExpanded((prev) => {
            const next = new Set(prev);
            next.add(p);
            return next;
          });
          hoverTimerRef.current = null;
        }, 600);
      },
      [clearHoverTimer]
    );

    const readMoveItemsFromDataTransfer = useCallback(
      (dt: DataTransfer): string[] | null => {
        try {
          const raw = dt.getData("application/json");
          if (!raw) return null;
          const parsed = JSON.parse(raw) as DropPayload;
          if (parsed?.kind !== "photoViewer:moveItems") return null;
          if (!Array.isArray(parsed.items)) return null;
          return parsed.items.map(String);
        } catch {
          return null;
        }
      },
      []
    );

    const isInternalMoveDnD = useCallback((dt: DataTransfer) => {
      const types = Array.from(dt.types ?? []);
      return types.includes("application/json");
    }, []);

    // ===== tree expand =====
    const toggle = useCallback((path: string) => {
      setExpanded((prev) => {
        const next = new Set(prev);
        if (next.has(path)) next.delete(path);
        else next.add(path);
        return next;
      });
    }, []);

    // currentDir までの「祖先パスの配列」
    const ancestorPaths = useMemo(() => {
      const norm = normalizeDir(currentDir || ".");
      if (norm === ".") return [];
      const parts = norm.split("/").filter(Boolean);

      const acc: string[] = [];
      for (let i = 0; i < parts.length; i++) {
        acc.push(parts.slice(0, i + 1).join("/"));
      }
      return acc;
    }, [currentDir]);

    // 現在ディレクトリまでの祖先を「自動で展開」
    useEffect(() => {
      if (!tree) return;
      if (ancestorPaths.length === 0) return;

      setExpanded((prev) => {
        let changed = false;
        const next = new Set(prev);
        for (const p of ancestorPaths) {
          if (!next.has(p)) {
            next.add(p);
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, [tree, ancestorPaths]);

    // currentDir が見えるようにスクロール（現状維持）
    useEffect(() => {
      if (!activeRef.current) return;
      activeRef.current.scrollIntoView({ block: "nearest" });
    }, [currentDir]);

    // Tree カーソルが動いたら、Tree フォーカス中のみ追従スクロール
    useEffect(() => {
      if (!isFocused) return;
      if (!cursorRef.current) return;
      cursorRef.current.scrollIntoView({ block: "nearest" });
    }, [focusedPath, isFocused]);

    // Tree 初期化：tree が来たタイミングで focusedPath を適切に
    useEffect(() => {
      if (!tree) return;

      // 既存 focusedPath がツリー内にあるなら保持。なければ currentDir、なければ root。
      const normFocused = normalizeDir(focusedPath || ".");
      const normCur = normalizeDir(currentDir || ".");

      const exists = (node: TreeNode, p: string): boolean => {
        if (normalizeDir(node.path) === p) return true;
        for (const c of node.children ?? []) {
          if (exists(c, p)) return true;
        }
        return false;
      };

      if (exists(tree, normFocused)) return;
      if (exists(tree, normCur)) {
        setFocusedPath(normCur);
        return;
      }
      setFocusedPath(normalizeDir(tree.path || "."));
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tree]);

    // 「見た目順（表示順）」のフラット配列と parent/firstChild を構築
    const flat = useMemo(() => {
      if (!tree) {
        return {
          visible: [] as string[],
          parentOf: new Map<string, string | null>(),
          firstChildOf: new Map<string, string | null>(),
          nodeByPath: new Map<string, TreeNode>(),
        };
      }

      const visible: string[] = [];
      const parentOf = new Map<string, string | null>();
      const firstChildOf = new Map<string, string | null>();
      const nodeByPath = new Map<string, TreeNode>();

      const norm = (p: string) => normalizeDir(p || ".");
      const isRoot = (p: string) => norm(p) === ".";

      const isExpandedOpen = (p: string) => {
        const np = norm(p);
        return isRoot(np) ? true : expanded.has(np);
      };

      const walk = (node: TreeNode, parent: string | null) => {
        const p = norm(node.path);
        nodeByPath.set(p, node);
        parentOf.set(p, parent);
        visible.push(p);

        const kids = node.children ?? [];
        if (kids.length > 0) firstChildOf.set(p, norm(kids[0].path));
        else firstChildOf.set(p, null);

        const expandable = kids.length > 0;
        const open = expandable ? isExpandedOpen(p) : false;

        if (expandable && open) {
          for (const c of kids) walk(c, p);
        }
      };

      walk(tree, null);

      return { visible, parentOf, firstChildOf, nodeByPath };
    }, [tree, expanded]);

    const moveCursorBy = useCallback(
      (delta: -1 | 1) => {
        const arr = flat.visible;
        if (arr.length === 0) return;
        const cur = normalizeDir(focusedPath || ".");
        const idx = arr.indexOf(cur);
        if (idx < 0) return;
        const next = idx + delta;
        if (next < 0 || next >= arr.length) return; // 端は停止（ループなし）
        setFocusedPath(arr[next]);
      },
      [flat.visible, focusedPath]
    );

    const doH = useCallback(() => {
      const p = normalizeDir(focusedPath || ".");
      const node = flat.nodeByPath.get(p);
      if (!node) return;

      const expandable = hasChildren(node);
      const open = expandable ? (p === "." ? true : expanded.has(p)) : false;

      // 開いているなら閉じる最優先（rootは閉じない）
      if (expandable && open && p !== ".") {
        toggle(p);
        return;
      }

      // それ以外は親へ移動（閉じられない場合の副作用）
      const parent = flat.parentOf.get(p) ?? null;
      if (parent) setFocusedPath(parent);
    }, [expanded, flat.nodeByPath, flat.parentOf, focusedPath, toggle]);

    const doL = useCallback(() => {
      const p = normalizeDir(focusedPath || ".");
      const node = flat.nodeByPath.get(p);
      if (!node) return;

      const expandable = hasChildren(node);
      const open = expandable ? (p === "." ? true : expanded.has(p)) : false;

      // 閉じているなら開く最優先（rootは常にopen扱い）
      if (expandable && !open) {
        toggle(p);
        return;
      }

      // それ以外は先頭の子へ移動（開けない場合の副作用）
      const first = flat.firstChildOf.get(p) ?? null;
      if (first) setFocusedPath(first);
    }, [expanded, flat.firstChildOf, flat.nodeByPath, focusedPath, toggle]);

    const doEnter = useCallback(() => {
      const p = normalizeDir(focusedPath || ".");
      onSelectDir(p);
      // カーソルはそのまま（仕様）
    }, [focusedPath, onSelectDir]);

    const doMarkToggle = useCallback(() => {
      const p = normalizeDir(focusedPath || ".");
      const isMarked = !!markedDir && normalizeDir(markedDir) === p;
      onMarkDir(isMarked ? null : p);
    }, [focusedPath, markedDir, onMarkDir]);

    useImperativeHandle(
      ref,
      () => ({
        handleKey: (e: KeyboardEvent) => {
          if (!tree) return;
          if (!isFocused) return;

          if (e.key === "j") {
            e.preventDefault();
            moveCursorBy(1);
          } else if (e.key === "k") {
            e.preventDefault();
            moveCursorBy(-1);
          } else if (e.key === "h") {
            e.preventDefault();
            doH();
          } else if (e.key === "l") {
            e.preventDefault();
            doL();
          } else if (e.key === "Enter") {
            e.preventDefault();
            doEnter();
          } else if (e.key === " ") {
            e.preventDefault();
            doMarkToggle();
          }
        },
      }),
      [tree, isFocused, moveCursorBy, doH, doL, doEnter, doMarkToggle]
    );

    const renderNode = (node: TreeNode) => {
      const p = normalizeDir(node.path);
      const isRoot = p === ".";
      const active = normalizeDir(currentDir) === p;
      const expandable = hasChildren(node);
      const expandedOpen = expanded.has(p) || isRoot;
      const open = expandable ? expandedOpen : active;
      const isAncestor = ancestorPaths.includes(p);

      const isCursor = normalizeDir(focusedPath) === p;
      const isMarked = !!markedDir && normalizeDir(markedDir) === p;

      return (
        <li key={p} className="tree-item">
          <div
            ref={active ? activeRef : isCursor ? cursorRef : null}
            className={[
              "tree-row",
              active ? "is-active" : "",
              isAncestor ? "is-ancestor" : "",
              isCursor ? "is-cursor" : "",
              isMarked ? "is-marked" : "",
              dragOverPath === p ? "is-dropover" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onMouseDown={() => setFocusedPath(p)}
            onDragEnter={(ev) => {
              if (!isInternalMoveDnD(ev.dataTransfer)) return;
              setDragOverPath(p);
              scheduleAutoExpand(p, expandable, expandedOpen);
            }}
            onDragOver={(ev) => {
              if (!isInternalMoveDnD(ev.dataTransfer)) return;
              ev.preventDefault();           // ★これがないとdrop発火しない
              ev.dataTransfer.dropEffect = "move";
              setDragOverPath(p);
              scheduleAutoExpand(p, expandable, expandedOpen);
            }}
            onDragLeave={(ev) => {
              // row 内の移動で leave が発火するのを避ける
              const cur = ev.currentTarget;
              const rt = ev.relatedTarget as Node | null;
              if (rt && cur.contains(rt)) return;
              if (dragOverPath === p) setDragOverPath(null);
              clearHoverTimer();
            }}
            onDrop={(ev) => {
              ev.preventDefault();
              setDragOverPath(null);
              clearHoverTimer();

              const items = readMoveItemsFromDataTransfer(ev.dataTransfer);
              if (!items || items.length === 0) return;
              onDropItems(p, items);
            }}
          >
            {expandable ? (
              <button
                type="button"
                className="tree-toggle"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={() => toggle(p)}
                aria-label={expandedOpen ? "collapse" : "expand"}
              >
                <FontAwesomeIcon
                  icon={expandedOpen ? faChevronDown : faChevronRight}
                />
              </button>
            ) : (
              <span className="tree-toggle tree-toggle-spacer" />
            )}

            <button
              type="button"
              className="tree-label"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={() => onSelectDir(p)}
              title={p}
            >
              <FontAwesomeIcon
                className="tree-icon"
                icon={open ? faFolderOpen : faFolder}
              />
              <span className="tree-name">{node.name}</span>
            </button>

            {/* Mark (move destination) */}
            <button
              type="button"
              className="tree-mark"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={() => onMarkDir(isMarked ? null : p)}
              aria-label={isMarked ? "unmark" : "mark as destination"}
              title={isMarked ? "移動先マーク解除" : "移動先にマーク"}
            >
              <FontAwesomeIcon icon={faBookmark} />
            </button>
          </div>

          {expandable && expandedOpen && (
            <ul className="tree-children">
              {node.children.map((c) => renderNode(c))}
            </ul>
          )}
        </li>
      );
    };

    if (!tree) return null;

    return (
      <div className={["tree-root", isFocused ? "is-focused" : ""].join(" ")}>
        <ul className="tree-list">{renderNode(tree)}</ul>
      </div>
    );
  }
);
