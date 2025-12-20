"use client";

import { useEffect, useMemo, useState } from "react";

type Props = {
  src: string;
  alt: string;
  className?: string;
  rootMargin?: string; // 例: "600px"
};

export function ThumbImage({
  src,
  alt,
  className,
  rootMargin = "600px",
}: Props) {
  const [el, setEl] = useState<HTMLElement | null>(null);
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

  const actualSrc = enabled ? src : "";

  return (
    <span
      ref={(n) => setEl(n)}
      className={className}
      style={{ display: "block", width: "100%", height: "100%" }}
    >
      {enabled ? (
        <img
          src={actualSrc}
          alt={alt}
          loading="lazy"
          decoding="async"
          fetchPriority="low"
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        // ここは見た目に合わせてスケルトン等
        <span style={{ display: "block", width: "100%", height: "100%" }} />
      )}
    </span>
  );
}
