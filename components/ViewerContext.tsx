"use client";

import React, { createContext, useContext, useMemo, useState, useCallback } from "react";

export type Entry = {
  name: string;
  relativePath: string;
  type: "dir" | "image" | "video" | "other";
};

export type ViewerNavigator = {
  pushDir: (dirPath: string) => void;
  goParent: () => void;
  goSiblingDir: (delta: -1 | 1) => void;
};

const NOOP_NAVIGATOR: ViewerNavigator = {
  pushDir: () => {},
  goParent: () => {},
  goSiblingDir: () => {},
};

type ViewerContextValue = {
  selectedEntry: Entry | null;
  setSelectedEntry: (e: Entry | null) => void;
  currentDir: string;
  setCurrentDir: (dir: string) => void;
  navigator: ViewerNavigator | null;
  setNavigator: (nav: ViewerNavigator | null) => void;
  navGen: number;
  bumpNavGen: () => void;
  isNavigating: boolean;
  endNavigating: () => void;
};

const ViewerContext = createContext<ViewerContextValue | null>(null);

export function ViewerProvider({ children }: { children: React.ReactNode }) {
  const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null);
  const [currentDir, setCurrentDir] = useState<string>(".");
  const [navigator, setNavigator] = useState<ViewerNavigator | null>(null);
  const [navGen, setNavGen] = useState(0);
  const [isNavigating, setIsNavigating] = useState(false);

  const bumpNavGen = useCallback(() => {
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
      currentDir,
      setCurrentDir,
      navigator,
      setNavigator,
      navGen,
      bumpNavGen,
      isNavigating,
      endNavigating,
    }),
    [selectedEntry, currentDir, navigator, navGen, bumpNavGen, isNavigating, endNavigating]
  );

  return <ViewerContext.Provider value={value}>{children}</ViewerContext.Provider>;
}

export function useViewer() {
  const ctx = useContext(ViewerContext);
  if (!ctx) throw new Error("useViewer must be used within ViewerProvider");
  return ctx;
}

export function useViewerNav() {
  const { navigator } = useViewer();
  return navigator ?? NOOP_NAVIGATOR;
}
