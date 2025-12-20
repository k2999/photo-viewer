"use client";

import { useCallback, useRef, useState } from "react";

export function useDirThumbs() {
  const [dirThumbs, setDirThumbs] = useState<Record<string, string[]>>({});
  const inflightRef = useRef<Set<string>>(new Set());
  const ctrlsRef = useRef<Map<string, AbortController>>(new Map());

  const resetDirThumbs = useCallback(() => {
    for (const ctrl of ctrlsRef.current.values()) ctrl.abort();
    ctrlsRef.current.clear();
    setDirThumbs({});
    inflightRef.current = new Set();
  }, []);

  const fetchDirThumbs = useCallback(async (dirPath: string) => {
    // inflight ガード（現状維持）
    if (inflightRef.current.has(dirPath)) return;

    // 既にあるかどうかは setDirThumbs の中で判定する（関数を stable にするため）
    // ただし、ここで即 return してしまうと stale な dirThumbs 参照が必要になるのでやらない。
    inflightRef.current.add(dirPath);

    // 同じ dirPath の未完了リクエストがあれば中断して張り替え
    const prevCtrl = ctrlsRef.current.get(dirPath);
    prevCtrl?.abort();
    const ctrl = new AbortController();
    ctrlsRef.current.set(dirPath, ctrl);

    try {
      const r = await fetch(
        `/api/dir-thumbs?path=${encodeURIComponent(dirPath)}`,
        { signal: ctrl.signal }
      );
      const data = await r.json();
      const thumbs: string[] = data.thumbs ?? [];

      setDirThumbs((prev) => {
        // 既にあれば何もしない（現状維持）
        if (prev[dirPath]) return prev;
        return { ...prev, [dirPath]: thumbs };
      });
    } catch (e) {
      // abort は正常系（ログ汚染を避ける）
      if (ctrl.signal.aborted) return;
      throw e;
    } finally {
      inflightRef.current.delete(dirPath);
      // 最新の controller だけ掃除（競合対策）
      if (ctrlsRef.current.get(dirPath) === ctrl) {
        ctrlsRef.current.delete(dirPath);
      }
    }
  }, []);

  // フォルダ移動時に呼ぶ：待機中の dir-thumbs をまとめて中断
  const abortAllDirThumbs = useCallback(() => {
    for (const ctrl of ctrlsRef.current.values()) ctrl.abort();
    ctrlsRef.current.clear();
    inflightRef.current.clear();
  }, []);

  return {
    dirThumbs,
    fetchDirThumbs,
    resetDirThumbs,
    abortAllDirThumbs,
  };
}
