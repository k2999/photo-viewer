"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { normalizeDir } from "@/lib/path";
import type { TreeNode } from "@/components/DirectoryTree";
import { ancestorPathsOf, findNodeByPath, hasChildren } from "@/lib/tree";

type DropPayload = { kind: "photoViewer:moveItems"; items: string[] };

export type UseDirectoryTreeControllerArgs = {
  tree: TreeNode | null;
  currentDir: string;
  isFocused: boolean;
  markedDir: string | null;
  onSelectDir: (path: string) => void;
  onMarkDir: (path: string | null) => void;
  onDropItems: (destDir: string, items: string[]) => void;
};

export type DirectoryTreeController = {
  expanded: Set<string>;
  focusedPath: string;
  dragOverPath: string | null;

  activeRef: React.RefObject<HTMLDivElement>;
  cursorRef: React.RefObject<HTMLDivElement>;

  setFocusedPath: (path: string) => void;
  toggleExpanded: (path: string) => void;

  isInternalMoveDnD: (dt: DataTransfer) => boolean;
  onRowDragEnter: (path: string, expandable: boolean, expandedOpen: boolean, dt: DataTransfer) => void;
  onRowDragOver: (path: string, expandable: boolean, expandedOpen: boolean, dt: DataTransfer) => void;
  onRowDragLeave: (path: string, currentTarget: HTMLElement, relatedTarget: Node | null) => void;
  onRowDrop: (path: string, dt: DataTransfer) => void;

  cursorDown: () => void;
  cursorUp: () => void;
  collapseOrParent: () => void;
  expandOrFirstChild: () => void;
  enter: () => void;
  toggleMark: () => void;
};

export function useDirectoryTreeController({
  tree,
  currentDir,
  isFocused,
  markedDir,
  onSelectDir,
  onMarkDir,
  onDropItems,
}: UseDirectoryTreeControllerArgs): DirectoryTreeController {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [focusedPath, setFocusedPathState] = useState<string>(".");

  const activeRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);

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

  const readMoveItemsFromDataTransfer = useCallback((dt: DataTransfer): string[] | null => {
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
  }, []);

  const isInternalMoveDnD = useCallback((dt: DataTransfer) => {
    const types = Array.from(dt.types ?? []);
    return types.includes("application/json");
  }, []);

  const toggleExpanded = useCallback((path: string) => {
    const p = normalizeDir(path || ".");
    if (p === ".") return;
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  }, []);

  const setFocusedPath = useCallback((path: string) => {
    setFocusedPathState(normalizeDir(path || "."));
  }, []);

  const ancestorPaths = useMemo(() => ancestorPathsOf(currentDir), [currentDir]);

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

  useEffect(() => {
    if (!activeRef.current) return;
    activeRef.current.scrollIntoView({ block: "nearest" });
  }, [currentDir]);

  useEffect(() => {
    if (!isFocused) return;
    if (!cursorRef.current) return;
    cursorRef.current.scrollIntoView({ block: "nearest" });
  }, [focusedPath, isFocused]);

  useEffect(() => {
    if (!tree) return;

    const normFocused = normalizeDir(focusedPath || ".");
    const normCur = normalizeDir(currentDir || ".");

    const focusedExists = !!findNodeByPath(tree, normFocused);
    if (focusedExists) return;

    const curExists = !!findNodeByPath(tree, normCur);
    if (curExists) {
      setFocusedPathState(normCur);
      return;
    }

    setFocusedPathState(normalizeDir(tree.path || "."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tree]);

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
      if (next < 0 || next >= arr.length) return;
      setFocusedPathState(arr[next]);
    },
    [flat.visible, focusedPath]
  );

  const doH = useCallback(() => {
    const p = normalizeDir(focusedPath || ".");
    const node = flat.nodeByPath.get(p);
    if (!node) return;

    const expandable = hasChildren(node);
    const open = expandable ? (p === "." ? true : expanded.has(p)) : false;

    if (expandable && open && p !== ".") {
      toggleExpanded(p);
      return;
    }

    const parent = flat.parentOf.get(p) ?? null;
    if (parent) setFocusedPathState(parent);
  }, [expanded, flat.nodeByPath, flat.parentOf, focusedPath, toggleExpanded]);

  const doL = useCallback(() => {
    const p = normalizeDir(focusedPath || ".");
    const node = flat.nodeByPath.get(p);
    if (!node) return;

    const expandable = hasChildren(node);
    const open = expandable ? (p === "." ? true : expanded.has(p)) : false;

    if (expandable && !open) {
      toggleExpanded(p);
      return;
    }

    const first = flat.firstChildOf.get(p) ?? null;
    if (first) setFocusedPathState(first);
  }, [expanded, flat.firstChildOf, flat.nodeByPath, focusedPath, toggleExpanded]);

  const doEnter = useCallback(() => {
    const p = normalizeDir(focusedPath || ".");
    onSelectDir(p);
  }, [focusedPath, onSelectDir]);

  const doMarkToggle = useCallback(() => {
    const p = normalizeDir(focusedPath || ".");
    const isMarked = !!markedDir && normalizeDir(markedDir) === p;
    onMarkDir(isMarked ? null : p);
  }, [focusedPath, markedDir, onMarkDir]);

  const onRowDragEnter = useCallback(
    (p: string, expandable: boolean, expandedOpen: boolean, dt: DataTransfer) => {
      if (!isInternalMoveDnD(dt)) return;
      const np = normalizeDir(p);
      setDragOverPath(np);
      scheduleAutoExpand(np, expandable, expandedOpen);
    },
    [isInternalMoveDnD, scheduleAutoExpand]
  );

  const onRowDragOver = useCallback(
    (p: string, expandable: boolean, expandedOpen: boolean, dt: DataTransfer) => {
      if (!isInternalMoveDnD(dt)) return;
      const np = normalizeDir(p);
      setDragOverPath(np);
      scheduleAutoExpand(np, expandable, expandedOpen);
    },
    [isInternalMoveDnD, scheduleAutoExpand]
  );

  const onRowDragLeave = useCallback(
    (p: string, currentTarget: HTMLElement, relatedTarget: Node | null) => {
      const rt = relatedTarget;
      if (rt && currentTarget.contains(rt)) return;
      const np = normalizeDir(p);
      if (dragOverPath === np) setDragOverPath(null);
      clearHoverTimer();
    },
    [clearHoverTimer, dragOverPath]
  );

  const onRowDrop = useCallback(
    (p: string, dt: DataTransfer) => {
      setDragOverPath(null);
      clearHoverTimer();
      const items = readMoveItemsFromDataTransfer(dt);
      if (!items || items.length === 0) return;
      onDropItems(normalizeDir(p), items);
    },
    [clearHoverTimer, onDropItems, readMoveItemsFromDataTransfer]
  );

  const cursorDown = useCallback(() => {
    if (!tree) return;
    if (!isFocused) return;
    moveCursorBy(1);
  }, [tree, isFocused, moveCursorBy]);

  const cursorUp = useCallback(() => {
    if (!tree) return;
    if (!isFocused) return;
    moveCursorBy(-1);
  }, [tree, isFocused, moveCursorBy]);

  const collapseOrParent = useCallback(() => {
    if (!tree) return;
    if (!isFocused) return;
    doH();
  }, [tree, isFocused, doH]);

  const expandOrFirstChild = useCallback(() => {
    if (!tree) return;
    if (!isFocused) return;
    doL();
  }, [tree, isFocused, doL]);

  const enter = useCallback(() => {
    if (!tree) return;
    if (!isFocused) return;
    doEnter();
  }, [tree, isFocused, doEnter]);

  const toggleMark = useCallback(() => {
    if (!tree) return;
    if (!isFocused) return;
    doMarkToggle();
  }, [tree, isFocused, doMarkToggle]);

  return {
    expanded,
    focusedPath,
    dragOverPath,
    activeRef,
    cursorRef,
    setFocusedPath,
    toggleExpanded,
    isInternalMoveDnD,
    onRowDragEnter,
    onRowDragOver,
    onRowDragLeave,
    onRowDrop,
    cursorDown,
    cursorUp,
    collapseOrParent,
    expandOrFirstChild,
    enter,
    toggleMark,
  };
}
