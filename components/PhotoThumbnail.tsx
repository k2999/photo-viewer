"use client";

import { useEffect, useRef, useState } from "react";
import { Image } from "@/components/Image";

type Props = {
  src: string;
  alt: string;
  className?: string;
  rootMargin?: string;
};

export function PhotoThumbnail({ src, alt, className, rootMargin = "600px" }: Props) {
  const elRef = useRef<HTMLElement | null>(null);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const el = elRef.current;
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
  }, [enabled, rootMargin]);

  const actualSrc = enabled ? src : "";

  return (
    <span
      ref={(n) => {
        elRef.current = n;
      }}
      className={className}
      style={{ display: "block", width: "100%", height: "100%" }}
    >
      {enabled ? (
        <Image src={actualSrc} alt={alt} />
      ) : (
        <span style={{ display: "block", width: "100%", height: "100%" }} />
      )}
    </span>
  );
}
