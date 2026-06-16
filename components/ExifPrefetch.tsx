"use client";

import { useEffect, useState } from "react";
import { prefetchExif, useExif } from "@/hooks/useExif";
import { pickExifDateKey } from "@/lib/exifDateKey";

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

    const key = exif ? pickExifDateKey(exif) : null;
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
