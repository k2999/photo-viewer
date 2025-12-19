"use client";

import { useCallback, useState } from "react";

export type EntryLike = {
  relativePath: string;
};

export function useCheckedSet<T extends EntryLike>(entries: T[]) {
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const toggleCheck = useCallback((path: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setChecked(new Set(entries.map((e) => e.relativePath)));
  }, [entries]);

  const deselectAll = useCallback(() => {
    setChecked(new Set());
  }, []);

  const setRangeChecked = useCallback(
    (fromIdx: number, toIdx: number, checkedState: boolean) => {
      const start = Math.min(fromIdx, toIdx);
      const end = Math.max(fromIdx, toIdx);

      setChecked((prev) => {
        const next = new Set(prev);
        for (let i = start; i <= end; i++) {
          const p = entries[i]?.relativePath;
          if (!p) continue;
          if (checkedState) next.add(p);
          else next.delete(p);
        }
        return next;
      });
    },
    [entries]
  );

  const resetChecked = useCallback(() => {
    setChecked(new Set());
  }, []);

  return {
    checked,
    setChecked, // 既存の bulk 後の setChecked(new Set()) を変えたくない場合に残す
    toggleCheck,
    selectAll,
    deselectAll,
    setRangeChecked,
    resetChecked,
  };
}
