"use client";

import { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFolder } from "@fortawesome/free-solid-svg-icons";
import { Image } from "@/components/Image";

export type DirectoryThumbnailProps = {
  dirPath: string;
  thumbs?: string[];
  onNeedThumbs: (dirPath: string) => void;
  resetOnNavigation?: boolean;
};

/**
 * フォルダの「最大4枚」サムネイル表示
 * - 画面内に見えたタイミングで onNeedThumbs(dirPath) を発火
 * - 取得・キャッシュ自体は親の責務
 */
export function DirectoryThumbnail({
  dirPath,
  thumbs,
  onNeedThumbs,
  resetOnNavigation = true,
}: DirectoryThumbnailProps) {
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
        <Image
          key={p}
          src={`/api/thumb?path=${encodeURIComponent(p)}`}
          alt={""}
          resetOnNavigation={resetOnNavigation}
        />
      ))}
      {Array.from({ length: empty }).map((_, i) => (
        <div key={i} className="dir-thumb-empty">
          <FontAwesomeIcon icon={faFolder} />
        </div>
      ))}
    </div>
  );
}
