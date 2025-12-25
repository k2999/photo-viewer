"use client";

import { useEffect, useState } from "react";
import { useExif } from "@/hooks/useExif";

/**
 * exiftool の日時文字列例:
 * - "2024:08:01 12:34:56"
 * - "2024:08:01 12:34:56+09:00"
 * - "2024-08-01 12:34:56"
 */
function normalizeExifDateTime(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;

  // 先頭から "YYYY:MM:DD HH:MM:SS" か "YYYY-MM-DD HH:MM:SS" を拾う
  const m = s.match(
    /^(\d{4})[:\-](\d{2})[:\-](\d{2})[ T](\d{2}):(\d{2}):(\d{2})/
  );
  if (!m) return null;

  const [, Y, M, D, h, mi, sec] = m;
  return `${Y}-${M}-${D}T${h}:${mi}:${sec}`; // 秒まで
}

function pickDateKey(exif: any): string | null {
  // 静止画/動画で揺れるので広めに拾う（優先順）
  const candidates = [
    exif?.DateTimeOriginal,
    exif?.CreateDate,
    exif?.CreationDate,
    exif?.MediaCreateDate,
    exif?.TrackCreateDate,
    exif?.ModifyDate,
    exif?.FileModifyDate,
  ];

  for (const c of candidates) {
    const k = normalizeExifDateTime(c);
    if (k) return k;
  }
  return null;
}

/**
 * 可視になったタイミングで useExif により EXIF を読み、
 * dateKey（秒まで）を 1回だけ onResolved で返す。
 *
 * - display:none にすると IntersectionObserver が反応しないので、
 *   レイアウト上に存在する invisible 要素として置く。
 */
export function DateKeyPrefetch({
  path,
  onResolved,
  rootMargin = "800px",
}: {
  path: string;
  onResolved: (dateKey: string | null) => void;
  rootMargin?: string;
}) {
  const [el, setEl] = useState<HTMLSpanElement | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!el) return;
    if (enabled) return;

    const obs = new IntersectionObserver(
      (ents) => {
        for (const ent of ents) {
          if (ent.isIntersecting) {
            setEnabled(true);
            obs.disconnect();
            break;
          }
        }
      },
      { root: null, rootMargin, threshold: 0.01 }
    );

    obs.observe(el);
    return () => obs.disconnect();
  }, [el, enabled, rootMargin]);

  const { exif, error, loading } = useExif(path, enabled);

  useEffect(() => {
    if (!enabled) return;
    if (done) return;
    if (loading) return;
    if (exif === undefined && error === undefined) return;

    const key = exif ? pickDateKey(exif) : null;
    onResolved(key);
    setDone(true);
  }, [enabled, done, loading, exif, error, onResolved]);

  return (
    <span
      ref={setEl}
      aria-hidden
      style={{
        position: "absolute",
        width: 1,
        height: 1,
        opacity: 0,
        pointerEvents: "none",
      }}
    />
  );
}
