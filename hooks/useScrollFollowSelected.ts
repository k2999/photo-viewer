"use client";

import { useEffect } from "react";

export type UseScrollFollowSelectedArgs = {
  selectedIndex: number;
  isPreviewOpen: boolean;
  // entries 配列そのものを依存に持つと無駄に再発火するので length を渡す（挙動は同じ）
  entriesLength: number;
};

export function useScrollFollowSelected({
  selectedIndex,
  isPreviewOpen,
  entriesLength,
}: UseScrollFollowSelectedArgs) {
  useEffect(() => {
    if (isPreviewOpen) return;
    if (entriesLength === 0) return;

    const el = document.querySelector<HTMLElement>(
      `[data-idx="${selectedIndex}"]`
    );
    if (!el) return;

    el.scrollIntoView({
      block: "nearest",
      inline: "nearest",
      behavior: "smooth",
    });
  }, [selectedIndex, entriesLength, isPreviewOpen]);
}
