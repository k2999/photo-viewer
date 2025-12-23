"use client";

import { useEffect } from "react";

export type SelectedEntryLike = {
  type: "dir" | "image" | "video" | "other";
  relativePath: string;
} | null;

function entryKeyOfSelected(e: SelectedEntryLike): string | null {
  if (!e) return null;
  return e.type === "dir" ? `${e.relativePath}/` : e.relativePath;
}

export type UseKeyboardNavArgs = {
  entriesLength: number;
  gridCols: number;

  selectedEntry: SelectedEntryLike;

  isPreviewOpen: boolean;
  setIsPreviewOpen: React.Dispatch<React.SetStateAction<boolean>>;

  setSelectedIndex: React.Dispatch<React.SetStateAction<number>>;

  toggleCheck: (key: string) => void;
  selectAll: () => void;
  deselectAll: () => void;

  goParent: () => void;
  pushDir: (dirPath: string) => void;
  goSiblingDir: (delta: -1 | 1) => void;
};

export function useKeyboardNav({
  entriesLength,
  gridCols,
  selectedEntry,
  isPreviewOpen,
  setIsPreviewOpen,
  setSelectedIndex,
  toggleCheck,
  selectAll,
  deselectAll,
  goParent,
  pushDir,
  goSiblingDir,
}: UseKeyboardNavArgs) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (entriesLength === 0) return;

      if (e.key === "h" || e.key === "ArrowLeft") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(0, i - 1));
      } else if (e.key === "l" || e.key === "ArrowRight") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(entriesLength - 1, i + 1));
      } else if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => {
          const next = i + gridCols;
          return next >= entriesLength ? i : next;
        });
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => {
          const next = i - gridCols;
          return next < 0 ? i : next;
        });
      } else if (e.key === "H" || e.key === "J") {
        e.preventDefault();
        goSiblingDir(1);
      } else if (e.key === "L" || e.key === "K") {
        e.preventDefault();
        goSiblingDir(-1);
      } else if (e.key === " ") {
        e.preventDefault();
        const key = entryKeyOfSelected(selectedEntry);
        if (!key) return;
        toggleCheck(key);
      } else if (e.metaKey && e.key === "a") {
        e.preventDefault();
        if (!e.shiftKey) {
          selectAll();
        } else {
          deselectAll();
        }
      } else if (e.key === "Escape") {
        setIsPreviewOpen(false);
      } else if (e.key === "Enter") {
        if (!e.shiftKey) {
          if (selectedEntry?.type === "dir") {
            e.preventDefault();
            pushDir(selectedEntry.relativePath);
          } else if (
            selectedEntry?.type === "image" ||
            selectedEntry?.type === "video"
          ) {
            setIsPreviewOpen((v) => !v);
          }
        } else {
          e.preventDefault();
          if (!isPreviewOpen) {
            goParent();
          } else {
            setIsPreviewOpen(false);
          }
        }
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    entriesLength,
    gridCols,
    selectedEntry,
    toggleCheck,
    isPreviewOpen,
    goParent,
    pushDir,
    goSiblingDir,
    selectAll,
    deselectAll,
    setIsPreviewOpen,
    setSelectedIndex,
  ]);
}
