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

  const reload = useCallback(() => {
    // 前回のリクエストが残っていれば中断
    abortRef.current?.abort();

    setEntries([]);
    resetViewState();

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
  };
}
