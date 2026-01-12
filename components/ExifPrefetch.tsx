"use client";

import { useEffect, useState } from "react";
import { prefetchExif, useExif } from "@/hooks/useExif";

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

  const m = s.match(/^(\d{4})[:\-](\d{2})[:\-](\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (!m) return null;

  const [, Y, M, D, h, mi, sec] = m;
  return `${Y}-${M}-${D}T${h}:${mi}:${sec}`;
}

function pickDateKey(exif: any): string | null {
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
 * 可視になったら EXIF を prefetch してキャッシュを温める。
 */
export function ExifPrefetch({
  path,
  onDateKeyResolved,
  rootMargin = "800px",
}: {
  path: string;
  onDateKeyResolved?: (dateKey: string | null) => void;
  rootMargin?: string;
}) {
  const [el, setEl] = useState<HTMLSpanElement | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [doneDateKey, setDoneDateKey] = useState(false);

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

  useEffect(() => {
    if (!enabled) return;
    prefetchExif(path);
  }, [enabled, path]);

  const needDateKey = !!onDateKeyResolved;
  const { exif, error, loading } = useExif(needDateKey ? path : null, enabled && needDateKey);

  useEffect(() => {
    if (!needDateKey) return;
    if (!enabled) return;
    if (doneDateKey) return;
    if (loading) return;
    if (exif === undefined && error === undefined) return;

    const key = exif ? pickDateKey(exif) : null;
    onDateKeyResolved?.(key);
    setDoneDateKey(true);
  }, [needDateKey, enabled, doneDateKey, loading, exif, error, onDateKeyResolved]);

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
