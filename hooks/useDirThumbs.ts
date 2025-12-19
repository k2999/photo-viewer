"use client";

import { useCallback, useRef, useState } from "react";

export function useDirThumbs() {
  const [dirThumbs, setDirThumbs] = useState<Record<string, string[]>>({});
  const inflightRef = useRef<Set<string>>(new Set());

  const resetDirThumbs = useCallback(() => {
    setDirThumbs({});
    inflightRef.current = new Set();
  }, []);

  const fetchDirThumbs = useCallback(async (dirPath: string) => {
    // inflight ガード（現状維持）
    if (inflightRef.current.has(dirPath)) return;

    // 既にあるかどうかは setDirThumbs の中で判定する（関数を stable にするため）
    // ただし、ここで即 return してしまうと stale な dirThumbs 参照が必要になるのでやらない。

    inflightRef.current.add(dirPath);
    try {
      const r = await fetch(
        `/api/dir-thumbs?path=${encodeURIComponent(dirPath)}`
      );
      const data = await r.json();
      const thumbs: string[] = data.thumbs ?? [];

      setDirThumbs((prev) => {
        // 既にあれば何もしない（現状維持）
        if (prev[dirPath]) return prev;
        return { ...prev, [dirPath]: thumbs };
      });
    } finally {
      inflightRef.current.delete(dirPath);
    }
  }, []);

  return {
    dirThumbs,
    fetchDirThumbs,
    resetDirThumbs,
  };
}
