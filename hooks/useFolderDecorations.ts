"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  FolderDecoration,
  FolderDecorationsMap,
} from "@/lib/folderDecorationsTypes";

export function useFolderDecorations() {
  const [decorations, setDecorations] = useState<FolderDecorationsMap>({});
  const [loading, setLoading] = useState(true);

  const fetchDecorations = useCallback(async () => {
    try {
      const r = await fetch("/api/folder-decorations");
      const data = await r.json();
      setDecorations(data.decorations ?? {});
    } catch (e) {
      console.error("Failed to fetch folder decorations:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDecorations();
  }, [fetchDecorations]);

  const setDecoration = useCallback(
    async (path: string, decoration: FolderDecoration | null) => {
      try {
        const r = await fetch("/api/folder-decorations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            path,
            decoration,
            clear: decoration == null,
          }),
        });
        const data = await r.json();
        if (r.ok) {
          setDecorations(data.decorations ?? {});
          return true;
        } else {
          console.error("Failed to set folder decoration:", data.error);
          return false;
        }
      } catch (e) {
        console.error("Failed to set folder decoration:", e);
        return false;
      }
    },
    []
  );

  const getDecoration = useCallback(
    (path: string): FolderDecoration | null => {
      return decorations[path] ?? null;
    },
    [decorations]
  );

  return {
    decorations,
    loading,
    getDecoration,
    setDecoration,
    refreshDecorations: fetchDecorations,
  };
}
