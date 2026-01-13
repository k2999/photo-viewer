"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { normalizeDir, parentDir } from "@/lib/path";
import {
  entryKeyOf,
  type Entry,
  type EntryKey,
  type GridKeyboardController,
} from "@/components/ViewerContext";
import type { GridControllerDeps } from "@/components/ViewerContext";
import { entryKeyOfSelected } from "@/lib/entryKey";
import { pickExifDateKey } from "@/lib/exifDateKey";
import { setStackedThumbDragImage } from "@/lib/dnd/stackedThumbDragImage";
import { useViewerNavigator } from "@/hooks/useViewerNavigator";
import { useDirThumbs } from "@/hooks/useDirThumbs";
import { useDirEntries } from "@/hooks/useDirEntries";
import { useBulkActions } from "@/hooks/useBulkActions";
import { useSelectedEntrySync } from "@/hooks/useSelectedEntrySync";
import { abortAllExifRequests, fetchExif, getCachedExif, useExif } from "@/hooks/useExif";
import { useScrollFollowSelected } from "@/hooks/useScrollFollowSelected";
import { PENDING_KEY, type ConflictDecision } from "@/lib/viewerGrid";

export type GridController = {
  currentDir: string;
  entries: Entry[];
  selectedIndex: number;
  setSelectedIndex: (i: number | ((prev: number) => number)) => void;
  selectedEntry: Entry | null;
  isPreviewOpen: boolean;
  setIsPreviewOpen: (v: boolean) => void;

  deleteReview: {
    open: boolean;
    entry: Entry | null;
    hasPrev: boolean;
    hasNext: boolean;
    onPrev: () => void;
    onNext: () => void;
    onMarkDelete: () => void;
    onReset: () => void;
    onConfirm: () => void;
    onCancel: () => void;
    busy: boolean;
    entries: Entry[];
    currentIndex: number;
    onSelectIndex: (idx: number) => void;
  };

  selectLeft: () => void;
  selectRight: () => void;
  selectUp: () => void;
  selectDown: () => void;
  toggleCheckSelected: () => void;
  selectBurst: () => void;
  escape: () => void;
  enter: () => void;
  shiftEnter: () => void;

  checked: Set<EntryKey>;
  toggleCheck: (key: EntryKey) => void;
  selectAll: () => void;
  deselectAll: () => void;
  setRangeChecked: (fromIdx: number, toIdx: number, nextState: boolean) => void;

  cardWidth: number;
  setCardWidth: (px: number) => void;
  focusTarget: "tree" | "grid";
  markedDir: string | null;

  dirThumbs: Record<string, string[]>;
  fetchDirThumbs: (dirPath: string) => void;

  pushDir: (dirPath: string) => void;
  goParent: () => void;
  goSiblingDir: (delta: -1 | 1) => void;

  handleBulkDelete: () => Promise<void> | void;
  handleMoveItemsToDest: (destDir: string, items: string[]) => Promise<string[] | null | undefined>;
  removeEntriesByRelativePath: (paths: string[]) => void;

  gridRef: React.RefObject<HTMLDivElement>;
  gridCols: number;

  dateKeyMap: Record<string, string | null>;
  dateKeyCounts: Record<string, number>;
  selectedDateKey: string | null;
  onDateKeyResolved: (entryKey: string, dk: string | null) => void;

  onCardDragStart: (ev: React.DragEvent<HTMLDivElement>, key: string) => void;

  conflictModal: {
    open: boolean;
    item: string;
    dest: string;
    existingName: string;
    onResolve: (d: ConflictDecision) => void;
  };
};

export type UseGridControllerArgs = {
  viewer: GridControllerDeps;
};

export function useGridController({ viewer }: UseGridControllerArgs): GridController {
  if (!viewer) {
    throw new Error("useGridController requires viewer deps");
  }

  const {
    currentDir,
    focusTarget,
    checked,
    setChecked,
    toggleCheck,
    registerListedKeys,
    selectAll,
    deselectAll,
    cardWidth,
    setCardWidth,
    setMoveToDir,
    setGridKeyboardController,
    markedDir,
  } = viewer;

  const nav = useViewerNavigator();
  const { dirThumbs, fetchDirThumbs, resetDirThumbs, abortAllDirThumbs } = useDirThumbs();

  const {
    entries,
    selectedIndex,
    setSelectedIndex,
    isPreviewOpen,
    setIsPreviewOpen,
    reload,
    removeEntriesByRelativePath,
  } = useDirEntries(currentDir);

  const listedKeys = useMemo(() => entries.map((e) => entryKeyOf(e)), [entries]);

  useEffect(() => {
    registerListedKeys(listedKeys);
  }, [listedKeys, registerListedKeys]);

  const [conflictState, setConflictState] = useState<{
    open: boolean;
    item: string;
    dest: string;
    existingName: string;
    resolve: ((d: ConflictDecision) => void) | null;
  }>({
    open: false,
    item: "",
    dest: "",
    existingName: "",
    resolve: null,
  });

  const askConflict = useCallback((args: { item: string; dest: string; existingName: string }) => {
    return new Promise<ConflictDecision>((resolve) => {
      setConflictState({
        open: true,
        item: args.item,
        dest: args.dest,
        existingName: args.existingName,
        resolve,
      });
    });
  }, []);

  const { handleBulkDelete, handleMoveItemsToDest } = useBulkActions({
    checked,
    setChecked,
    reload,
    markedDir,
    askConflict,
  });

  useEffect(() => {
    setMoveToDir((destDir: string, items: string[]) => {
      void (async () => {
        const moved = await handleMoveItemsToDest(destDir, items);
        if (moved && moved.length > 0) {
          removeEntriesByRelativePath(moved);
        }
      })();
    });
    return () => setMoveToDir(null);
  }, [handleMoveItemsToDest, setMoveToDir, removeEntriesByRelativePath]);

  const selectedEntry = entries[selectedIndex] ?? null;

  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [dateKeyMap, setDateKeyMap] = useState<Record<string, string | null>>({});

  const dateKeyCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of entries) {
      if (e.type !== "image" && e.type !== "video") continue;
      const k = entryKeyOf(e);
      const dk = dateKeyMap[k];
      if (!dk) continue;
      counts[dk] = (counts[dk] ?? 0) + 1;
    }
    return counts;
  }, [entries, dateKeyMap]);

  const selectedEnabled =
    !!selectedEntry && selectedEntry.type !== "dir" && selectedEntry.type !== "other";
  const { exif: selectedExif } = useExif(
    selectedEnabled ? selectedEntry!.relativePath : null,
    selectedEnabled
  );

  useEffect(() => {
    if (!selectedEnabled) {
      setSelectedDateKey(null);
      return;
    }
    setSelectedDateKey(selectedExif ? pickExifDateKey(selectedExif) : null);
  }, [selectedEnabled, selectedExif]);

  const gridRef = useRef<HTMLDivElement | null>(null);
  const [gridCols, setGridCols] = useState<number>(1);

  const [deleteReviewState, setDeleteReviewState] = useState<{
    open: boolean;
    originalEntries: Entry[];
    entries: Entry[];
    idx: number;
    marked: string[];
    busy: boolean;
  }>({ open: false, originalEntries: [], entries: [], idx: 0, marked: [], busy: false });

  const deleteReviewEntry = deleteReviewState.entries[deleteReviewState.idx] ?? null;

  const closeDeleteReview = useCallback(() => {
    setDeleteReviewState({
      open: false,
      originalEntries: [],
      entries: [],
      idx: 0,
      marked: [],
      busy: false,
    });
  }, []);

  const openDeleteReview = useCallback(() => {
    // 「選択されている画像だけ」を表示対象にする
    const selectedImages = entries.filter(
      (e) => e.type === "image" && checked.has(entryKeyOf(e))
    );
    if (selectedImages.length === 0) return;

    // フォーカス中の画像が含まれていれば、そこから開始
    let startIdx = 0;
    if (selectedEntry?.type === "image") {
      const focusedKey = entryKeyOf(selectedEntry);
      const i = selectedImages.findIndex((e) => entryKeyOf(e) === focusedKey);
      if (i >= 0) startIdx = i;
    }

    setIsPreviewOpen(false);
    setDeleteReviewState({
      open: true,
      originalEntries: selectedImages,
      entries: selectedImages,
      idx: startIdx,
      marked: [],
      busy: false,
    });
  }, [entries, checked, selectedEntry, setIsPreviewOpen]);

  const deleteReviewReset = useCallback(() => {
    setDeleteReviewState((s) => {
      if (!s.open) return s;
      if (s.busy) return s;

      const cur = s.entries[s.idx] ?? null;
      const curKey = cur ? entryKeyOf(cur) : null;

      const restoredEntries = s.originalEntries;
      if (restoredEntries.length === 0) {
        return { ...s, entries: [], idx: 0, marked: [] };
      }

      let nextIdx = 0;
      if (curKey) {
        const i = restoredEntries.findIndex((e) => entryKeyOf(e) === curKey);
        if (i >= 0) nextIdx = i;
      }

      return { ...s, entries: restoredEntries, idx: nextIdx, marked: [] };
    });
  }, []);

  const deleteReviewPrev = useCallback(() => {
    setDeleteReviewState((s) => {
      if (!s.open) return s;
      const n = s.entries.length;
      if (n <= 1) return s;
      return { ...s, idx: (s.idx - 1 + n) % n };
    });
  }, []);

  const deleteReviewNext = useCallback(() => {
    setDeleteReviewState((s) => {
      if (!s.open) return s;
      const n = s.entries.length;
      if (n <= 1) return s;
      return { ...s, idx: (s.idx + 1) % n };
    });
  }, []);

  const deleteReviewMarkDelete = useCallback(() => {
    setDeleteReviewState((s) => {
      if (!s.open) return s;
      if (s.busy) return s;
      const cur = s.entries[s.idx] ?? null;
      if (!cur) return s;
      if (cur.type !== "image") return s;

      const key = entryKeyOf(cur);
      const nextMarked = s.marked.includes(key) ? s.marked : [...s.marked, key];
      const nextEntries = s.entries.filter((e) => entryKeyOf(e) !== key);
      const nextIdx = nextEntries.length === 0 ? 0 : Math.min(s.idx, nextEntries.length - 1);
      return { ...s, marked: nextMarked, entries: nextEntries, idx: nextIdx };
    });
  }, []);

  const deleteReviewConfirm = useCallback(() => {
    void (async () => {
      const marked = deleteReviewState.marked;
      if (marked.length === 0) {
        closeDeleteReview();
        return;
      }

      setDeleteReviewState((s) => (s.open ? { ...s, busy: true } : s));
      try {
        const res = await fetch("/api/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "delete", items: marked }),
        });
        if (!res.ok) throw new Error(await res.text());

        removeEntriesByRelativePath(marked);
        setChecked((prev) => {
          const next = new Set(prev);
          for (const k of marked) next.delete(k);
          return next;
        });

        closeDeleteReview();
      } catch (e) {
        console.error("delete failed", e);
        setDeleteReviewState((s) => (s.open ? { ...s, busy: false } : s));
      }
    })();
  }, [deleteReviewState.marked, closeDeleteReview, removeEntriesByRelativePath, setChecked]);

  useEffect(() => {
    abortAllExifRequests();
    abortAllDirThumbs();
    resetDirThumbs();
    setIsPreviewOpen(false);
    closeDeleteReview();
    setSelectedIndex(0);
    setSelectedDateKey(null);
    setDateKeyMap({});
  }, [currentDir, abortAllDirThumbs, resetDirThumbs, setIsPreviewOpen, setSelectedIndex, closeDeleteReview]);

  useSelectedEntrySync(selectedEntry);

  const pushDir = useCallback(
    (dirPath: string) => {
      abortAllDirThumbs();
      setIsPreviewOpen(false);
      nav.pushDir(dirPath);
    },
    [abortAllDirThumbs, nav, setIsPreviewOpen]
  );

  const goParent = useCallback(() => {
    if (normalizeDir(currentDir) === ".") return;
    const prev = normalizeDir(currentDir);
    const next = normalizeDir(parentDir(currentDir));
    try {
      sessionStorage.setItem(
        PENDING_KEY,
        JSON.stringify({
          targetDir: next,
          kind: "entryByRelativePath",
          relativePath: prev,
          ts: Date.now(),
        })
      );
    } catch {
      // ignore
    }
    pushDir(next);
  }, [currentDir, pushDir]);

  const goSiblingDir = useCallback(
    (delta: -1 | 1) => {
      abortAllDirThumbs();
      setIsPreviewOpen(false);
      nav.goSiblingDir(delta);
    },
    [abortAllDirThumbs, nav, setIsPreviewOpen]
  );

  const selectBurst = useCallback(() => {
    void (async () => {
      // 1. clear selection
      setChecked(new Set());

      const startIdx = selectedIndex;
      const startEntry = entries[startIdx] ?? null;
      if (!startEntry) return;
      if (startEntry.type !== "image" && startEntry.type !== "video") {
        // 「写真」以外は対象外（ディレクトリ等）
        return;
      }

      const timeCache = new Map<number, number | null>();

      const shotTimeMsAt = async (idx: number): Promise<number | null> => {
        if (timeCache.has(idx)) return timeCache.get(idx)!;
        const e = entries[idx] ?? null;
        if (!e) {
          timeCache.set(idx, null);
          return null;
        }
        if (e.type !== "image" && e.type !== "video") {
          timeCache.set(idx, null);
          return null;
        }

        try {
          const cached = getCachedExif(e.relativePath);
          const exif = cached?.exif ?? (await fetchExif(e.relativePath)).exif;
          const dk = pickExifDateKey(exif);
          if (!dk) {
            timeCache.set(idx, null);
            return null;
          }
          const ms = new Date(dk).getTime();
          if (!Number.isFinite(ms)) {
            timeCache.set(idx, null);
            return null;
          }
          timeCache.set(idx, ms);
          return ms;
        } catch {
          timeCache.set(idx, null);
          return null;
        }
      };

      // 2. select focused photo
      const selectedIndices = new Set<number>();
      selectedIndices.add(startIdx);

      // 3-4. expand to adjacent photos within 1s (transitive closure)
      let left = startIdx;
      while (left > 0) {
        const a = await shotTimeMsAt(left);
        const b = await shotTimeMsAt(left - 1);
        if (a == null || b == null) break;
        if (Math.abs(a - b) > 1000) break;
        selectedIndices.add(left - 1);
        left--;
      }

      let right = startIdx;
      while (right < entries.length - 1) {
        const a = await shotTimeMsAt(right);
        const b = await shotTimeMsAt(right + 1);
        if (a == null || b == null) break;
        if (Math.abs(a - b) > 1000) break;
        selectedIndices.add(right + 1);
        right++;
      }

      const next = new Set<EntryKey>();
      for (const idx of selectedIndices) {
        const e = entries[idx];
        if (!e) continue;
        next.add(entryKeyOf(e));
      }

      setChecked(next);
    })();
  }, [entries, selectedIndex, setChecked]);

  const keyboard: GridKeyboardController = useMemo(
    () => ({
      selectLeft: () => {
        if (deleteReviewState.open) {
          deleteReviewPrev();
          return;
        }
        const entriesLength = entries.length;
        if (entriesLength === 0) return;
        setSelectedIndex((i) => Math.max(0, i - 1));
      },
      selectRight: () => {
        if (deleteReviewState.open) {
          deleteReviewNext();
          return;
        }
        const entriesLength = entries.length;
        if (entriesLength === 0) return;
        setSelectedIndex((i) => Math.min(entriesLength - 1, i + 1));
      },
      selectDown: () => {
        if (deleteReviewState.open) return;
        const entriesLength = entries.length;
        if (entriesLength === 0) return;
        setSelectedIndex((i) => {
          const next = i + gridCols;
          return next >= entriesLength ? i : next;
        });
      },
      selectUp: () => {
        if (deleteReviewState.open) return;
        const entriesLength = entries.length;
        if (entriesLength === 0) return;
        setSelectedIndex((i) => {
          const next = i - gridCols;
          return next < 0 ? i : next;
        });
      },
      goSiblingDir: (delta: -1 | 1) => {
        if (deleteReviewState.open) return;
        goSiblingDir(delta);
      },
      toggleCheckSelected: () => {
        if (deleteReviewState.open) return;
        const key = entryKeyOfSelected(selectedEntry);
        if (!key) return;
        toggleCheck(key);
      },
      selectAll: () => {
        if (deleteReviewState.open) return;
        selectAll();
      },
      deselectAll: () => {
        if (deleteReviewState.open) return;
        deselectAll();
      },
      selectBurst: () => {
        if (deleteReviewState.open) return;
        selectBurst();
      },
      commandEnter: () => {
        if (deleteReviewState.open) return;
        openDeleteReview();
      },
      deleteReviewMarkDelete: () => {
        if (!deleteReviewState.open) return;
        deleteReviewMarkDelete();
      },
      escape: () => {
        if (deleteReviewState.open) {
          closeDeleteReview();
        } else {
          setIsPreviewOpen(false);
        }
      },
      enter: () => {
        if (deleteReviewState.open) return;
        if (selectedEntry?.type === "dir") {
          pushDir(selectedEntry.relativePath);
        } else if (selectedEntry?.type === "image" || selectedEntry?.type === "video") {
          setIsPreviewOpen((v) => !v);
        }
      },
      shiftEnter: () => {
        if (deleteReviewState.open) return;
        if (!isPreviewOpen) {
          goParent();
        } else {
          setIsPreviewOpen(false);
        }
      },
    }),
    [
      entries,
      gridCols,
      setSelectedIndex,
      goSiblingDir,
      selectedEntry,
      toggleCheck,
      selectAll,
      deselectAll,
      selectBurst,
      pushDir,
      setIsPreviewOpen,
      isPreviewOpen,
      goParent,
      deleteReviewState.open,
      openDeleteReview,
      closeDeleteReview,
      deleteReviewPrev,
      deleteReviewNext,
      deleteReviewMarkDelete,
    ]
  );

  useEffect(() => {
    setGridKeyboardController(keyboard);
    return () => setGridKeyboardController(null);
  }, [keyboard, setGridKeyboardController]);

  useScrollFollowSelected({
    selectedIndex,
    isPreviewOpen,
    entriesLength: entries.length,
  });

  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;

    const measure = () => {
      const kids = Array.from(el.children) as HTMLElement[];
      if (kids.length === 0) {
        setGridCols(1);
        return;
      }
      const top = kids[0].offsetTop;
      let cols = 0;
      for (const k of kids) {
        if (k.offsetTop !== top) break;
        cols++;
      }
      setGridCols(Math.max(1, cols));
    };

    measure();

    const ro = new ResizeObserver(() => measure());
    ro.observe(el);

    return () => ro.disconnect();
  }, [currentDir, entries.length, cardWidth]);

  useEffect(() => {
    if (!entries || entries.length === 0) return;

    let raw: string | null = null;
    try {
      raw = sessionStorage.getItem(PENDING_KEY);
    } catch {
      return;
    }
    if (!raw) return;

    let payload: any;
    try {
      payload = JSON.parse(raw);
    } catch {
      try {
        sessionStorage.removeItem(PENDING_KEY);
      } catch {}
      return;
    }

    if (payload?.targetDir !== normalizeDir(currentDir)) return;

    if (payload?.kind === "entryByRelativePath" && typeof payload?.relativePath === "string") {
      const want = normalizeDir(payload.relativePath);
      const idx = entries.findIndex((e) => e.type === "dir" && normalizeDir(e.relativePath) === want);
      if (idx >= 0) {
        setSelectedIndex(idx);
      }
    }

    try {
      sessionStorage.removeItem(PENDING_KEY);
    } catch {}
  }, [currentDir, entries, setSelectedIndex]);

  const setRangeChecked = useCallback(
    (fromIdx: number, toIdx: number, nextState: boolean) => {
      const a = Math.min(fromIdx, toIdx);
      const b = Math.max(fromIdx, toIdx);
      const keys = entries.slice(a, b + 1).map((e) => entryKeyOf(e));
      setChecked((prev) => {
        const next = new Set(prev);
        for (const k of keys) {
          if (nextState) next.add(k);
          else next.delete(k);
        }
        return next;
      });
    },
    [entries, setChecked]
  );

  const buildDragItems = useCallback(
    (key: string) => {
      if (checked.size > 0 && checked.has(key)) return Array.from(checked);
      return [key];
    },
    [checked]
  );

  const onCardDragStart = useCallback(
    (ev: React.DragEvent<HTMLDivElement>, key: string) => {
      const items = buildDragItems(key);
      const payload = JSON.stringify({ kind: "photoViewer:moveItems", items });
      ev.dataTransfer.setData("application/json", payload);
      ev.dataTransfer.effectAllowed = "move";

      setStackedThumbDragImage({
        dataTransfer: ev.dataTransfer,
        entryKeys: items,
        getThumbSrc: (entryKey) => {
          const selector = `[data-entry-key="${CSS.escape(entryKey)}"] .card-thumb img`;
          const srcImg = document.querySelector(selector) as HTMLImageElement | null;
          return srcImg?.src ?? null;
        },
      });
    },
    [buildDragItems]
  );

  const onDateKeyResolved = useCallback((key: string, dk: string | null) => {
    setDateKeyMap((prev) => {
      if (prev[key] === dk) return prev;
      return { ...prev, [key]: dk };
    });
  }, []);

  const onResolveConflict = useCallback(
    (d: ConflictDecision) => {
      const r = conflictState.resolve;
      setConflictState((s) => ({ ...s, open: false, resolve: null }));
      r?.(d);
    },
    [conflictState.resolve]
  );

  return {
    currentDir,
    entries,
    selectedIndex,
    setSelectedIndex,
    selectedEntry,
    isPreviewOpen,
    setIsPreviewOpen,

    deleteReview: {
      open: deleteReviewState.open,
      entry: deleteReviewEntry,
      hasPrev: deleteReviewState.entries.length > 1,
      hasNext: deleteReviewState.entries.length > 1,
      onPrev: deleteReviewPrev,
      onNext: deleteReviewNext,
      onMarkDelete: deleteReviewMarkDelete,
      onReset: deleteReviewReset,
      onConfirm: deleteReviewConfirm,
      onCancel: closeDeleteReview,
      busy: deleteReviewState.busy,
      entries: deleteReviewState.entries,
      currentIndex: deleteReviewState.idx,
      onSelectIndex: (idx: number) => {
        setDeleteReviewState((s) => {
          if (!s.open) return s;
          if (idx < 0 || idx >= s.entries.length) return s;
          return { ...s, idx };
        });
      },
    },

    selectLeft: keyboard.selectLeft,
    selectRight: keyboard.selectRight,
    selectUp: keyboard.selectUp,
    selectDown: keyboard.selectDown,
    toggleCheckSelected: keyboard.toggleCheckSelected,
    selectBurst: keyboard.selectBurst,
    escape: keyboard.escape,
    enter: keyboard.enter,
    shiftEnter: keyboard.shiftEnter,

    checked,
    toggleCheck,
    selectAll,
    deselectAll,
    setRangeChecked,

    cardWidth,
    setCardWidth,
    focusTarget,
    markedDir,

    dirThumbs,
    fetchDirThumbs,

    pushDir,
    goParent,
    goSiblingDir,

    handleBulkDelete,
    handleMoveItemsToDest,
    removeEntriesByRelativePath,

    gridRef,
    gridCols,

    dateKeyMap,
    dateKeyCounts,
    selectedDateKey,
    onDateKeyResolved,

    onCardDragStart,

    conflictModal: {
      open: conflictState.open,
      item: conflictState.item,
      dest: conflictState.dest,
      existingName: conflictState.existingName,
      onResolve: onResolveConflict,
    },
  };
}
