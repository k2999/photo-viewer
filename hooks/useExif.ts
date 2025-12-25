"use client";

import { useEffect, useMemo, useState } from "react";

function isAbortError(e: any): boolean {
  return (
    e?.name === "AbortError" ||
    e instanceof DOMException && e.name === "AbortError"
  );
}

// ---- Shared (module-level) cache / queue ----
export type ExifPayload = { exif?: any; error?: string };

const cache = new Map<string, ExifPayload>(); // relativePath -> payload
const inflight = new Map<string, Promise<ExifPayload>>(); // relativePath -> promise

type QueueItem = {
  path: string;
  gen: number;
  ctrl: AbortController;
  resolve: (v: ExifPayload) => void;
  reject: (e: any) => void;
};
const queue: QueueItem[] = [];

let active = 0;
const MAX_CONCURRENCY = 5;

let generation = 0;
const controllers = new Set<AbortController>();

function runQueue() {
  while (active < MAX_CONCURRENCY && queue.length > 0) {
    const item = queue.shift()!;

    // 既に世代が変わっていれば処理しない（移動後に古いdirのEXIFが走るのを防ぐ）
    if (item.gen !== generation) {
      try {
        item.ctrl.abort();
      } catch {}
      item.reject(new DOMException("Aborted", "AbortError"));
      continue;
    }

    active++;
    fetchExifOnce(item.path, item.ctrl.signal)
      .then((payload) => {
        cache.set(item.path, payload);
        item.resolve(payload);
      })
      .catch((e) => {
        item.reject(e);
      })
      .finally(() => {
        controllers.delete(item.ctrl);
        active--;
        runQueue();
      });
  }
}

async function fetchExifOnce(path: string, signal: AbortSignal): Promise<ExifPayload> {
  try {
    const r = await fetch(`/api/exif?path=${encodeURIComponent(path)}`, {
      cache: "no-store",
      signal,
    });
    if (!r.ok) return { exif: undefined, error: `HTTP ${r.status}` };
    const data = await r.json();
    return { exif: data?.exif };
  } catch (e: any) {
    if (isAbortError(e)) throw e;
    return { exif: undefined, error: e?.message ?? "fetch failed" };
  }
}

async function doFetchImpl(path: string): Promise<ExifPayload> {
  // cache
  const hit = cache.get(path);
  if (hit) return hit;

  // inflight
  const inf = inflight.get(path);
  if (inf) return inf;

  const p = new Promise<ExifPayload>((resolve, reject) => {
    const ctrl = new AbortController();
    controllers.add(ctrl);
    queue.push({ path, gen: generation, ctrl, resolve, reject });
    runQueue();
  })
    .finally(() => {
      inflight.delete(path);
    });

  inflight.set(path, p);
  return p;
}

// ---- Public API ----
export function prefetchExif(path: string) {
  void doFetchImpl(path).catch(() => {});
}

export function getCachedExif(path: string): ExifPayload | undefined {
  return cache.get(path);
}

/**
 * フォルダ移動など「いま走っている / 待っている EXIF 取得」を全部キャンセルしたいときに呼ぶ。
 * - 進行中 fetch を abort
 * - queue 待ちを reject（AbortError）
 * - 世代を進め、古い request を無効化
 */
export function abortAllExifRequests() {
  generation++;

  // queue 待ちを全 reject
  while (queue.length > 0) {
    const item = queue.shift()!;
    try {
      item.ctrl.abort();
    } catch {}
    item.reject(new DOMException("Aborted", "AbortError"));
  }

  // 進行中 fetch を abort
  for (const ctrl of Array.from(controllers)) {
    try {
      ctrl.abort();
    } catch {}
  }
  controllers.clear();
}

export function useExif(path: string | null | undefined, enabled: boolean) {
  const key = path ?? null;

  const initial = useMemo(() => {
    if (!key) return undefined;
    return cache.get(key);
  }, [key]);

  const [payload, setPayload] = useState<ExifPayload | undefined>(initial);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!key) {
      setPayload(undefined);
      setLoading(false);
      return;
    }
    if (!enabled) return;

    const hit = cache.get(key);
    if (hit) {
      setPayload(hit);
      setLoading(false);
      return;
    }

    let alive = true;
    setLoading(true);

    doFetchImpl(key)
      .then((p) => {
        if (!alive) return;
        setPayload(p);
        setLoading(false);
      })
      .catch((e) => {
        if (!alive) return;
        // フォルダ移動等による abort は正常系（UIをエラー扱いにしない）
        if (isAbortError(e)) {
          setLoading(false);
          return;
        }
        // それ以外は error として保持（必要なら UI 側で表示）
        setPayload({ exif: undefined, error: e?.message ?? "fetch failed" });
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [key, enabled]);

  return { exif: payload?.exif, error: payload?.error, loading };
}
