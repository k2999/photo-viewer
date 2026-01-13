"use client";

import React, {
  createContext,
  useContext,
  useMemo,
  useState,
  useCallback,
  useRef,
  useEffect,
} from "react";
import { usePathname } from "next/navigation";
import { pathnameToDir } from "@/lib/path";

export type Entry = {
  name: string;
  relativePath: string;
  type: "dir" | "image" | "video" | "other";
};
export type EntryKey = string;
export type CardWidthPx = number;

export type GridKeyboardController = {
  selectLeft: () => void;
  selectRight: () => void;
  selectUp: () => void;
  selectDown: () => void;
  goSiblingDir: (delta: -1 | 1) => void;
  toggleCheckSelected: () => void;
  selectAll: () => void;
  deselectAll: () => void;
  selectBurst: () => void;
  commandEnter: () => void;
  deleteReviewMarkDelete: () => void;
  escape: () => void;
  enter: () => void;
  shiftEnter: () => void;
};

export function entryKeyOf(entry: Entry): EntryKey {
  return entry.type === "dir" ? `${entry.relativePath}/` : entry.relativePath;
}

export type ViewerContextValue = {
  selectedEntry: Entry | null;
  setSelectedEntry: (e: Entry | null) => void;
  currentDir: string;
  focusTarget: "tree" | "grid";
  setFocusTarget: (t: "tree" | "grid") => void;
  gridKeyboardControllerRef: React.MutableRefObject<GridKeyboardController | null>;
  setGridKeyboardController: (c: GridKeyboardController | null) => void;
  markedDir: string | null;
  setMarkedDir: (dir: string | null) => void;
  moveToDir: ((destDir: string, items: string[]) => void) | null;
  setMoveToDir: (fn: ((destDir: string, items: string[]) => void) | null) => void;
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

export type GridControllerDeps = Pick<
  ViewerContextValue,
  | "currentDir"
  | "focusTarget"
  | "checked"
  | "setChecked"
  | "toggleCheck"
  | "registerListedKeys"
  | "selectAll"
  | "deselectAll"
  | "cardWidth"
  | "setCardWidth"
  | "setMoveToDir"
  | "setGridKeyboardController"
  | "markedDir"
>;

const ViewerContext = createContext<ViewerContextValue | null>(null);

export function ViewerProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const currentDir = useMemo(() => pathnameToDir(pathname), [pathname]);

  const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null);
  const [focusTarget, setFocusTarget] = useState<"tree" | "grid">("grid");
  const [markedDir, setMarkedDirState] = useState<string | null>(null);
  const [moveToDir, _setMoveToDir] = useState<((destDir: string, items: string[]) => void) | null>(null);
  const [navGen, setNavGen] = useState(0);
  const [isNavigating, setIsNavigating] = useState(false);
  const [checked, setChecked] = useState<Set<EntryKey>>(() => new Set());
  const [cardWidth, setCardWidthState] = useState<CardWidthPx>(220);
  const listedKeysRef = useRef<EntryKey[]>([]);
  const prevDirRef = useRef<string>(currentDir);
  const gridKeyboardControllerRef = useRef<GridKeyboardController | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("photoViewer:cardWidth");
      const n = raw ? Number(raw) : NaN;
      if (Number.isFinite(n)) setCardWidthState(n);
    } catch {
      // ignore
    }
  }, []);

  // markedDir: restore
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("photoViewer:markedDir");
      if (raw && typeof raw === "string") {
        setMarkedDirState(raw);
      }
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

  // URL(=currentDir) 変更に追従して、ディレクトリに紐づく state をリセット
  useEffect(() => {
    if (prevDirRef.current === currentDir) return;
    prevDirRef.current = currentDir;
    setChecked(new Set());
    listedKeysRef.current = [];
  }, [currentDir]);

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

  const setMarkedDir = useCallback((dir: string | null) => {
    setMarkedDirState(dir);
    try {
      if (!dir) window.localStorage.removeItem("photoViewer:markedDir");
      else window.localStorage.setItem("photoViewer:markedDir", dir);
    } catch {
      // ignore
    }
  }, []);

  const setMoveToDir = useCallback(
    (fn: ((destDir: string, items: string[]) => void) | null) => {
      if (fn == null) {
        _setMoveToDir(null);
      } else {
        _setMoveToDir(() => fn);
      }
    },
    []
  );

  const setGridKeyboardController = useCallback((c: GridKeyboardController | null) => {
    gridKeyboardControllerRef.current = c;
  }, []);

  const value = useMemo(
    () => ({
      selectedEntry,
      setSelectedEntry,
      currentDir,
      focusTarget,
      setFocusTarget,
      gridKeyboardControllerRef,
      setGridKeyboardController,
      markedDir,
      setMarkedDir,
      moveToDir,
      setMoveToDir,
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
      focusTarget,
      markedDir,
      setMarkedDir,
      moveToDir,
      setMoveToDir,
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
      gridKeyboardControllerRef,
      setGridKeyboardController,
    ]
  );

  return <ViewerContext.Provider value={value}>{children}</ViewerContext.Provider>;
}

export function useViewer() {
  const ctx = useContext(ViewerContext);
  if (!ctx) throw new Error("useViewer must be used within ViewerProvider");
  return ctx;
}
