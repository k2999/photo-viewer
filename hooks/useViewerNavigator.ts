"use client";

import { useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { dirToUrl, normalizeDir, parentDir } from "@/lib/path";
import { useViewer } from "@/components/ViewerContext";
import type { Entry } from "@/components/ViewerContext";

function listDirChildren(parent: string): Promise<Entry[]> {
  return fetch(`/api/tree?path=${encodeURIComponent(parent)}`)
    .then((r) => r.json())
    .then((data) => (data.entries ?? []) as Entry[]);
}

export type ViewerNavigator = {
  pushDir: (dirPath: string) => void;
  goParent: () => void;
  goSiblingDir: (delta: -1 | 1) => void;
};

export function useViewerNavigator(): ViewerNavigator {
  const router = useRouter();
  const { currentDir, bumpNavGen } = useViewer();

  // parent dir -> normalized sibling dir list
  const siblingsCacheRef = useRef<Map<string, string[]>>(new Map());

  const pushDir = useCallback(
    (dirPath: string) => {
      bumpNavGen();
      router.push(dirToUrl(dirPath));
    },
    [bumpNavGen, router]
  );

  const goParent = useCallback(() => {
    const cur = normalizeDir(currentDir);
    if (cur === ".") return;
    bumpNavGen();
    router.push(dirToUrl(parentDir(cur)));
  }, [currentDir, bumpNavGen, router]);

  const goSiblingDir = useCallback(
    (delta: -1 | 1) => {
      const cur = normalizeDir(currentDir);
      if (cur === ".") return;

      const parent = normalizeDir(parentDir(cur));

      const run = async () => {
        let siblings = siblingsCacheRef.current.get(parent);
        if (!siblings) {
          const entries = await listDirChildren(parent);
          siblings = entries
            .filter((e) => e.type === "dir")
            .map((e) => normalizeDir(e.relativePath))
            .sort((a, b) => a.localeCompare(b));
          siblingsCacheRef.current.set(parent, siblings);
        }

        if (siblings.length === 0) return;
        const idx = siblings.indexOf(cur);
        if (idx < 0) return;
        const nextIdx = idx + delta;
        if (nextIdx < 0 || nextIdx >= siblings.length) return;

        bumpNavGen();
        router.push(dirToUrl(siblings[nextIdx]));
      };

      void run();
    },
    [currentDir, bumpNavGen, router]
  );

  return { pushDir, goParent, goSiblingDir };
}
