"use client";

import React, { createContext, useContext, useMemo, useState, useCallback, useRef, useEffect } from "react";

export type Entry = {
  name: string;
  relativePath: string;
  type: "dir" | "image" | "video" | "other";
};
export type EntryKey = string;
export type CardWidthPx = number;

export function entryKeyOf(entry: Entry): EntryKey {
  return entry.type === "dir" ? `${entry.relativePath}/` : entry.relativePath;
}

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
  checked: Set<EntryKey>;
  setChecked: React.Dispatch<React.SetStateAction<Set<EntryKey>>>;
  toggleCheck: (key: EntryKey) => void;
  registerListedKeys: (keys: EntryKey[]) => void;
  selectAll: () => void;
  deselectAll: () => void;
  cardWidth: CardWidthPx;
  setCardWidth: (px: CardWidthPx) => void;
};

const ViewerContext = createContext<ViewerContextValue | null>(null);

export function ViewerProvider({ children }: { children: React.ReactNode }) {
  const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null);
  const [currentDir, setCurrentDirState] = useState<string>(".");
  const [navigator, setNavigator] = useState<ViewerNavigator | null>(null);
  const [navGen, setNavGen] = useState(0);
  const [isNavigating, setIsNavigating] = useState(false);
  const [checked, setChecked] = useState<Set<EntryKey>>(() => new Set());
  const [cardWidth, setCardWidthState] = useState<CardWidthPx>(220);
  const listedKeysRef = useRef<EntryKey[]>([]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("photoViewer:cardWidth");
      const n = raw ? Number(raw) : NaN;
      if (Number.isFinite(n)) setCardWidthState(n);
    } catch {
      // ignore
    }
  }, []);

  const bumpNavGen = useCallback(() => {
    setIsNavigating(true);
    setNavGen((n) => n + 1);
    window.setTimeout(() => setIsNavigating(false), 150);
  }, []);

  const endNavigating = useCallback(() => {
    setIsNavigating(false);
  }, []);

  const setCurrentDir = useCallback((dir: string) => {
    setCurrentDirState(dir);
    setChecked(new Set());
    listedKeysRef.current = [];
  }, []);

  const toggleCheck = useCallback((key: EntryKey) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const registerListedKeys = useCallback((keys: EntryKey[]) => {
    listedKeysRef.current = keys;
  }, []);

  const selectAll = useCallback(() => {
    const keys = listedKeysRef.current;
    setChecked((prev) => {
      const next = new Set(prev);
      for (const k of keys) next.add(k);
      return next;
    });
  }, []);

  const setCardWidth = useCallback((px: CardWidthPx) => {
    setCardWidthState(px);
    try {
      window.localStorage.setItem("photoViewer:cardWidth", String(px));
    } catch {
      // ignore
    }
  }, []);

  const deselectAll = useCallback(() => {
    const keys = listedKeysRef.current;
    setChecked((prev) => {
      const next = new Set(prev);
      for (const k of keys) next.delete(k);
      return next;
    });
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
      checked,
      setChecked,
      toggleCheck,
      registerListedKeys,
      selectAll,
      deselectAll,
      cardWidth,
      setCardWidth,
    }),
    [
      selectedEntry,
      currentDir,
      setCurrentDir,
      navigator,
      navGen,
      bumpNavGen,
      isNavigating,
      endNavigating,
      checked,
      toggleCheck,
      registerListedKeys,
      selectAll,
      deselectAll,
      cardWidth,
      setCardWidth,
    ]
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
