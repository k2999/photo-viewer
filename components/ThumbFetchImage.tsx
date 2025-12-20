"use client";

import { useEffect, useRef, useState } from "react";
import { useViewer } from "@/components/ViewerContext";

type Props = {
  src: string; // /api/thumb?... など
  alt: string;
  className?: string;
};

// 同時実行制限（サムネが遷移を詰まらせないためのQoS）
const MAX_CONCURRENCY = 5;

type Waiter = {
  signal: AbortSignal;
  resolve: () => void;
  reject: (e: unknown) => void;
  onAbort: () => void;
};

let running = 0;
const queue: Waiter[] = [];

function pump() {
  while (running < MAX_CONCURRENCY && queue.length > 0) {
    const w = queue.shift()!;
    if (w.signal.aborted) {
      // 既に abort 済みなら捨てる
      continue;
    }
    w.signal.removeEventListener("abort", w.onAbort);
    running++;
    w.resolve();
  }
}

async function acquire(signal: AbortSignal) {
  if (signal.aborted) throw new DOMException("Aborted", "AbortError");
  if (running < MAX_CONCURRENCY) {
    running++;
    return;
  }
  await new Promise<void>((resolve, reject) => {
    const waiter: Waiter = {
      signal,
      resolve,
      reject,
      onAbort: () => {
        // キューから自分を取り除く（ここが詰まり防止の肝）
        const idx = queue.indexOf(waiter);
        if (idx >= 0) queue.splice(idx, 1);
        reject(new DOMException("Aborted", "AbortError"));
      },
    };
    signal.addEventListener("abort", waiter.onAbort, { once: true });
    queue.push(waiter);
  });
}

function release() {
  running = Math.max(0, running - 1);
  pump();
}

export function ThumbFetchImage({ src, alt, className }: Props) {
  const { navGen, isNavigating } = useViewer();

  const imgRef = useRef<HTMLImageElement | null>(null);
  const ctrlRef = useRef<AbortController | null>(null);
  const urlRef = useRef<string | null>(null);

  const [loaded, setLoaded] = useState(false);

  // 既存 objectURL を破棄する
  const revoke = () => {
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
  };

  // navGen 変更 or unmount で「確実にキャンセル」
  useEffect(() => {
    // in-flight を止める
    ctrlRef.current?.abort();
    ctrlRef.current = null;

    // 既存表示も破棄（サムネを残したければここは消してOK）
    revoke();
    if (imgRef.current) imgRef.current.src = "";
    setLoaded(false);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navGen]);

  // src が変わったら取得（navGen が変わると上の effect が先に走る）
  useEffect(() => {
    if (!src) return;
    if (isNavigating) return;

    let alive = true;
	let acquired = false;

    // すでに走っているものがあれば中断
    ctrlRef.current?.abort();
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;

    // 前の objectURL を破棄してから新規取得
    revoke();
    if (imgRef.current) imgRef.current.src = "";
    setLoaded(false);

    (async () => {
      let acquired = false;
      try {
        // 同時実行制限（待っている間に navGen が変わったら abort される）
        await acquire(ctrl.signal);
        acquired = true;

        const res = await fetch(src, {
          signal: ctrl.signal,
          cache: "force-cache",
        });
        if (!res.ok) throw new Error(`thumb fetch failed: ${res.status}`);

        const blob = await res.blob();
        if (!alive || ctrl.signal.aborted) return;

        const objUrl = URL.createObjectURL(blob);
        urlRef.current = objUrl;

        if (imgRef.current) {
          imgRef.current.src = objUrl;
        }
        setLoaded(true);
      } catch (e) {
        if (!alive) return;
        // abort は正常系
        if (ctrl.signal.aborted) return;
        // 必要なら console.error(e);
      } finally {
        if (acquired) release();
      }
    })();

    return () => {
      alive = false;
      ctrl.abort();
      // ここでは revoke しない（navGen で統制、または次回 src 変更時に revoke）
      // unmount 時は下で revoke する
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, navGen, isNavigating]);

  // unmount 時に確実に解放
  useEffect(() => {
    return () => {
      ctrlRef.current?.abort();
      ctrlRef.current = null;
      revoke();
    };
  }, []);

  return (
    <img
      ref={imgRef}
      alt={alt}
      className={className}
      decoding="async"
      // loading="lazy" は fetch 方式では意味が薄いので外す（置いても害は少ないが）
      style={{ opacity: loaded ? 1 : 0 }}
    />
  );
}
