"use client";

import { useCallback, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import {
  entryKeyOf,
  type Entry,
  type EntryKey,
} from "@/components/ViewerContext";

export type DeleteReviewController = {
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

type DeleteReviewState = {
  open: boolean;
  originalEntries: Entry[];
  entries: Entry[];
  idx: number;
  marked: string[];
  busy: boolean;
};

type UseDeleteReviewArgs = {
  entries: Entry[];
  checked: Set<EntryKey>;
  selectedEntry: Entry | null;
  setIsPreviewOpen: (v: boolean) => void;
  removeEntriesByRelativePath: (paths: string[]) => void;
  setChecked: Dispatch<SetStateAction<Set<EntryKey>>>;
};

const INITIAL_STATE: DeleteReviewState = {
  open: false,
  originalEntries: [],
  entries: [],
  idx: 0,
  marked: [],
  busy: false,
};

export function useDeleteReview({
  entries,
  checked,
  selectedEntry,
  setIsPreviewOpen,
  removeEntriesByRelativePath,
  setChecked,
}: UseDeleteReviewArgs) {
  const [state, setState] = useState<DeleteReviewState>(INITIAL_STATE);
  const currentEntry = state.entries[state.idx] ?? null;

  const close = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  const open = useCallback(() => {
    const selectedImages = entries.filter(
      (e) => e.type === "image" && checked.has(entryKeyOf(e))
    );
    if (selectedImages.length === 0) return;

    let startIdx = 0;
    if (selectedEntry?.type === "image") {
      const focusedKey = entryKeyOf(selectedEntry);
      const i = selectedImages.findIndex((e) => entryKeyOf(e) === focusedKey);
      if (i >= 0) startIdx = i;
    }

    setIsPreviewOpen(false);
    setState({
      open: true,
      originalEntries: selectedImages,
      entries: selectedImages,
      idx: startIdx,
      marked: [],
      busy: false,
    });
  }, [entries, checked, selectedEntry, setIsPreviewOpen]);

  const reset = useCallback(() => {
    setState((s) => {
      if (!s.open || s.busy) return s;

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

  const prev = useCallback(() => {
    setState((s) => {
      if (!s.open) return s;
      const n = s.entries.length;
      if (n <= 1) return s;
      return { ...s, idx: (s.idx - 1 + n) % n };
    });
  }, []);

  const next = useCallback(() => {
    setState((s) => {
      if (!s.open) return s;
      const n = s.entries.length;
      if (n <= 1) return s;
      return { ...s, idx: (s.idx + 1) % n };
    });
  }, []);

  const markDelete = useCallback(() => {
    setState((s) => {
      if (!s.open || s.busy) return s;
      const cur = s.entries[s.idx] ?? null;
      if (!cur || cur.type !== "image") return s;

      const key = entryKeyOf(cur);
      const nextMarked = s.marked.includes(key) ? s.marked : [...s.marked, key];
      const nextEntries = s.entries.filter((e) => entryKeyOf(e) !== key);
      const nextIdx = nextEntries.length === 0 ? 0 : Math.min(s.idx, nextEntries.length - 1);
      return { ...s, marked: nextMarked, entries: nextEntries, idx: nextIdx };
    });
  }, []);

  const confirm = useCallback(() => {
    void (async () => {
      const marked = state.marked;
      if (marked.length === 0) {
        close();
        return;
      }

      setState((s) => (s.open ? { ...s, busy: true } : s));
      try {
        const res = await fetch("/api/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "delete", items: marked }),
        });
        if (!res.ok) throw new Error(await res.text());

        removeEntriesByRelativePath(marked);
        setChecked((prevChecked) => {
          const nextChecked = new Set(prevChecked);
          for (const k of marked) nextChecked.delete(k);
          return nextChecked;
        });

        close();
      } catch (e) {
        console.error("delete failed", e);
        setState((s) => (s.open ? { ...s, busy: false } : s));
      }
    })();
  }, [state.marked, close, removeEntriesByRelativePath, setChecked]);

  const selectIndex = useCallback((idx: number) => {
    setState((s) => {
      if (!s.open) return s;
      if (idx < 0 || idx >= s.entries.length) return s;
      return { ...s, idx };
    });
  }, []);

  const controller: DeleteReviewController = useMemo(
    () => ({
      open: state.open,
      entry: currentEntry,
      hasPrev: state.entries.length > 1,
      hasNext: state.entries.length > 1,
      onPrev: prev,
      onNext: next,
      onMarkDelete: markDelete,
      onReset: reset,
      onConfirm: confirm,
      onCancel: close,
      busy: state.busy,
      entries: state.entries,
      currentIndex: state.idx,
      onSelectIndex: selectIndex,
    }),
    [state, currentEntry, prev, next, markDelete, reset, confirm, close, selectIndex]
  );

  return {
    controller,
    isOpen: state.open,
    open,
    close,
    prev,
    next,
    markDelete,
  };
}
