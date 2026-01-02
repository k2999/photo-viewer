"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Entry } from "@/components/ViewerContext";

export function useDirEntries(currentPath: string) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // 直近の reload だけを有効にするための AbortController
  const abortRef = useRef<AbortController | null>(null);

  const resetViewState = useCallback(() => {
    setSelectedIndex(0);
    setIsPreviewOpen(false);
  }, []);

  const removeEntriesByRelativePath = useCallback((paths: string[]) => {
    const removeSet = new Set(paths);

    setEntries((prev) => {
      if (prev.length === 0) return prev;

      // 現在選択中の相対パスを保持（消えたら近い位置へ寄せる）
      const cur = prev[selectedIndex]?.relativePath ?? null;

      const next = prev.filter((e) => !removeSet.has(e.relativePath));
      if (next.length === prev.length) return prev;

      // selectedIndex 補正
      setSelectedIndex((oldIdx) => {
        if (next.length === 0) return 0;

        if (cur) {
          const idx = next.findIndex((e) => e.relativePath === cur);
          if (idx >= 0) return idx;
        }

        // cur が消えた / cur が null の場合は、元の index 近辺に寄せる
        return Math.min(Math.max(0, oldIdx), next.length - 1);
      });

      // プレビュー中に対象が消えた可能性があるので閉じる（安全側）
      setIsPreviewOpen(false);

      return next;
    });
  }, [selectedIndex]);

  const reload = useCallback(() => {
    // 前回のリクエストが残っていれば中断
    abortRef.current?.abort();

    const controller = new AbortController();
    abortRef.current = controller;

    fetch(`/api/tree?path=${encodeURIComponent(currentPath)}`, {
      signal: controller.signal,
    })
      .then((r) => r.json())
      .then((data) => {
        // すでに abort 済みなら反映しない（保険）
        if (controller.signal.aborted) return;

        const list: Entry[] = data.entries ?? [];
        list.sort((a, b) => a.name.localeCompare(b.name));
        setEntries(list);
      })
      .catch((err) => {
        // abort は正常系として扱う（ログ汚染を避ける）
        if (controller.signal.aborted) return;
        console.error(err);
      });
  }, [currentPath, resetViewState]);

  useEffect(() => {
    reload();
    // unmount 時に in-flight を止める
    return () => {
      abortRef.current?.abort();
    };
  }, [reload]);

  return {
    entries,
    selectedIndex,
    setSelectedIndex,
    isPreviewOpen,
    setIsPreviewOpen,
    reload,
    removeEntriesByRelativePath,
  };
}
