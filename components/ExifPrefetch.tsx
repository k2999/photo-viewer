"use client";

import { useEffect, useState } from "react";
import { prefetchExif } from "@/hooks/useExif";

/**
 * 可視になったら EXIF を prefetch してキャッシュを温める。
 */
export function ExifPrefetch({
  path,
  rootMargin = "800px",
}: {
  path: string;
  rootMargin?: string;
}) {
  const [el, setEl] = useState<HTMLSpanElement | null>(null);
  const [enabled, setEnabled] = useState(false);

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
