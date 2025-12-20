"use client";

import React, { createContext, useContext, useMemo, useState, useCallback } from "react";

export type Entry = {
  name: string;
  relativePath: string;
  type: "dir" | "image" | "video" | "other";
};

type ViewerContextValue = {
  selectedEntry: Entry | null;
  setSelectedEntry: (e: Entry | null) => void;
  navGen: number;
  bumpNavGen: () => void;
  isNavigating: boolean;
  endNavigating: () => void;
};

const ViewerContext = createContext<ViewerContextValue | null>(null);

export function ViewerProvider({ children }: { children: React.ReactNode }) {
  const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null);
  const [navGen, setNavGen] = useState(0);
  const [isNavigating, setIsNavigating] = useState(false);

  const bumpNavGen = useCallback(() => {
    // フォルダ移動開始：サムネの新規取得を一時的に抑制し、遷移系APIを優先させる
    setIsNavigating(true);
    setNavGen((n) => n + 1);
    window.setTimeout(() => setIsNavigating(false), 150);
  }, []);

  const endNavigating = useCallback(() => {
    setIsNavigating(false);
  }, []);

  const value = useMemo(
    () => ({
      selectedEntry,
      setSelectedEntry,
      navGen,
      bumpNavGen,
      isNavigating,
      endNavigating,
    }),
    [selectedEntry, navGen, bumpNavGen, isNavigating, endNavigating]
  );

  return (
    <ViewerContext.Provider value={value}>{children}</ViewerContext.Provider>
  );
}

export function useViewer() {
  const ctx = useContext(ViewerContext);
  if (!ctx) throw new Error("useViewer must be used within ViewerProvider");
  return ctx;
}
