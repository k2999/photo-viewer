"use client";

import { useEffect, useState } from "react";

export type DirThumbGridProps = {
  dirPath: string;
  thumbs?: string[]; // 既存に合わせる（thumb URL 配列など）
  onNeedThumbs: (dirPath: string) => void; // IntersectionObserver で呼ぶ
};

/**
 * フォルダの「最大4枚」サムネイル表示
 * - 画面内に見えたタイミングで onNeedThumbs(dirPath) を発火
 * - 取得・キャッシュ自体は親（page.tsx）の責務
 */
export function DirThumbGrid({
  dirPath,
  thumbs,
  onNeedThumbs,
}: DirThumbGridProps) {
    const [el, setEl] = useState<HTMLDivElement | null>(null);

    useEffect(() => {
      if (!el) return;
      if (thumbs && thumbs.length > 0) return;

      const obs = new IntersectionObserver(
        (ents) => {
          for (const ent of ents) {
            if (ent.isIntersecting) {
              onNeedThumbs(dirPath);
              obs.disconnect();
              break;
            }
          }
        },
        { root: null, rootMargin: "300px", threshold: 0.01 }
      );

      obs.observe(el);
      return () => obs.disconnect();
    }, [el, dirPath, thumbs, onNeedThumbs]);

    const list = (thumbs ?? []).slice(0, 4);
    const empty = Math.max(0, 4 - list.length);

    return (
      <div ref={setEl} className="dir-thumbs">
        {list.map((p) => (
          <img
            key={p}
            src={`/api/thumb?path=${encodeURIComponent(p)}`}
            loading="lazy"
            alt=""
          />
        ))}
        {Array.from({ length: empty }).map((_, i) => (
          <div key={i} className="dir-thumb-empty">
            📁
          </div>
        ))}
      </div>
    );
}
