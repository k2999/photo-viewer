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
export type ExifRefreshResult = ExifPayload & { path: string };

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
const MAX_CONCURRENCY = 2;
const MAX_BATCH_SIZE = 80;
const BATCH_DELAY_MS = 25;

let generation = 0;
const controllers = new Set<AbortController>();
let queueTimer: number | null = null;

function runQueue() {
  if (queueTimer) {
    window.clearTimeout(queueTimer);
    queueTimer = null;
  }

  while (active < MAX_CONCURRENCY && queue.length > 0) {
    const batch: QueueItem[] = [];
    while (batch.length < MAX_BATCH_SIZE && queue.length > 0) {
      const item = queue.shift()!;

      // 既に世代が変わっていれば処理しない（移動後に古いdirのEXIFが走るのを防ぐ）
      if (item.gen !== generation) {
        try {
          item.ctrl.abort();
        } catch {}
        item.reject(new DOMException("Aborted", "AbortError"));
        continue;
      }

      batch.push(item);
    }
    if (batch.length === 0) continue;

    const ctrl = new AbortController();
    controllers.add(ctrl);
    active++;
    fetchExifBatchOnce(batch.map((item) => item.path), ctrl.signal)
      .then((payloads) => {
        for (const item of batch) {
          const payload = payloads.get(item.path) ?? { exif: undefined, error: "exif unavailable" };
          cache.set(item.path, payload);
          item.resolve(payload);
        }
      })
      .catch((e) => {
        for (const item of batch) item.reject(e);
      })
      .finally(() => {
        controllers.delete(ctrl);
        active--;
        runQueue();
      });
  }
}

function scheduleQueue() {
  if (queueTimer) return;
  queueTimer = window.setTimeout(runQueue, BATCH_DELAY_MS);
}

async function fetchExifBatchOnce(paths: string[], signal: AbortSignal): Promise<Map<string, ExifPayload>> {
  try {
    const r = await fetch("/api/exif/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      signal,
      body: JSON.stringify({ paths }),
    });
    const out = new Map<string, ExifPayload>();
    if (!r.ok) {
      for (const path of paths) out.set(path, { exif: undefined, error: `HTTP ${r.status}` });
      return out;
    }
    const data = await r.json();
    for (const result of data?.results ?? []) {
      out.set(result.path, { exif: result.exif, error: result.error });
    }
    return out;
  } catch (e: any) {
    if (isAbortError(e)) throw e;
    const out = new Map<string, ExifPayload>();
    for (const path of paths) out.set(path, { exif: undefined, error: e?.message ?? "fetch failed" });
    return out;
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
    queue.push({ path, gen: generation, ctrl, resolve, reject });
    scheduleQueue();
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

export function fetchExif(path: string): Promise<ExifPayload> {
  return doFetchImpl(path);
}

export function getCachedExif(path: string): ExifPayload | undefined {
  return cache.get(path);
}

export function invalidateExifCache(paths: string[]) {
  for (const path of paths) cache.delete(path);
}

export async function refreshExifCache(paths: string[], recursive = true): Promise<ExifRefreshResult[]> {
  const uniquePaths = Array.from(new Set(paths)).filter(Boolean);
  if (uniquePaths.length === 0) return [];

  const r = await fetch("/api/exif/batch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({ paths: uniquePaths, force: true, recursive }),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);

  const data = await r.json();
  const payloads: ExifRefreshResult[] = [];
  for (const result of data?.results ?? []) {
    const payload = { path: result.path, exif: result.exif, error: result.error };
    cache.set(result.path, payload);
    payloads.push(payload);
  }
  return payloads;
}

/**
 * フォルダ移動など「いま走っている / 待っている EXIF 取得」を全部キャンセルしたいときに呼ぶ。
 * - 進行中 fetch を abort
 * - queue 待ちを reject（AbortError）
 * - 世代を進め、古い request を無効化
 */
export function abortAllExifRequests() {
  generation++;

  if (queueTimer) {
    window.clearTimeout(queueTimer);
    queueTimer = null;
  }

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
