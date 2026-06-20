"use client";

import React, {
  createContext,
  useContext,
  useMemo,
  useState,
  useCallback,
  useRef,
  useEffect,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { normalizeDir, pathnameToDir } from "@/lib/path";
import type { FolderDecoration } from "@/lib/folderDecorationsTypes";

export type Entry = {
  name: string;
  relativePath: string;
  type: "dir" | "image" | "video" | "other";
};
export type EntryKey = string;
export type CardWidthPx = number;
export type ViewMode = "grid" | "timeline" | "calendar";
export const TIMELINE_SLOT_MINUTES_OPTIONS = [60, 30, 20, 15, 12, 10, 6, 5, 4, 3, 2, 1] as const;
export type TimelineSlotMinutes = (typeof TIMELINE_SLOT_MINUTES_OPTIONS)[number];
export type CalendarWeekStart = "sunday" | "monday";
export type FocusTarget = "tree" | "grid" | "secondaryGrid";

export type PrimaryPaneController = {
  moveItemsToCurrentDir: (items: string[]) => Promise<string[] | null | undefined>;
  reload: () => void;
};

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
  focusTarget: FocusTarget;
  setFocusTarget: (t: FocusTarget) => void;
  gridKeyboardControllerRef: React.MutableRefObject<GridKeyboardController | null>;
  setGridKeyboardController: (c: GridKeyboardController | null) => void;
  secondaryGridKeyboardControllerRef: React.MutableRefObject<GridKeyboardController | null>;
  setSecondaryGridKeyboardController: (c: GridKeyboardController | null) => void;
  secondaryDir: string | null;
  isSecondaryPaneOpen: boolean;
  openSecondaryPane: (dir: string) => void;
  closeSecondaryPane: () => void;
  setSecondaryDir: (dir: string) => void;
  secondaryReloadSignal: number;
  bumpSecondaryReloadSignal: () => void;
  setPrimaryPaneController: (controller: PrimaryPaneController | null) => void;
  moveItemsToPrimaryDir: (items: string[]) => Promise<string[] | null | undefined>;
  reloadPrimaryPane: () => void;
  setPrimaryToolbar: (toolbar: ReactNode | null) => void;
  registerPrimaryToolbarHost: (setter: ((toolbar: ReactNode | null) => void) | null) => void;
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
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  timelineTrimEmptyHours: boolean;
  setTimelineTrimEmptyHours: (trim: boolean) => void;
  timelineCollapseEmptyHourGaps: boolean;
  setTimelineCollapseEmptyHourGaps: (collapse: boolean) => void;
  timelineSlotMinutes: TimelineSlotMinutes;
  setTimelineSlotMinutes: (minutes: TimelineSlotMinutes) => void;
  calendarWeekStart: CalendarWeekStart;
  setCalendarWeekStart: (weekStart: CalendarWeekStart) => void;
  getFolderDecoration: (path: string) => FolderDecoration | null;
  setFolderDecoration: (path: string, decoration: FolderDecoration | null) => Promise<boolean>;
  initFolderDecorations: (
    decorations: Record<string, FolderDecoration>,
    setFn: (path: string, deco: FolderDecoration | null) => Promise<boolean>
  ) => void;
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
  | "viewMode"
  | "setViewMode"
  | "timelineTrimEmptyHours"
  | "setTimelineTrimEmptyHours"
  | "timelineCollapseEmptyHourGaps"
  | "setTimelineCollapseEmptyHourGaps"
  | "timelineSlotMinutes"
  | "setTimelineSlotMinutes"
  | "calendarWeekStart"
  | "setCalendarWeekStart"
  | "setGridKeyboardController"
>;

const ViewerContext = createContext<ViewerContextValue | null>(null);

export function ViewerProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const currentDir = useMemo(() => pathnameToDir(pathname), [pathname]);

  const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null);
  const [focusTarget, setFocusTarget] = useState<FocusTarget>("grid");
  const [secondaryDir, setSecondaryDirState] = useState<string | null>(null);
  const [isSecondaryPaneOpen, setIsSecondaryPaneOpen] = useState(false);
  const [secondaryReloadSignal, setSecondaryReloadSignal] = useState(0);
  const [navGen, setNavGen] = useState(0);
  const [isNavigating, setIsNavigating] = useState(false);
  const [checked, setChecked] = useState<Set<EntryKey>>(() => new Set());
  const [cardWidth, setCardWidthState] = useState<CardWidthPx>(220);
  const [viewMode, setViewModeState] = useState<ViewMode>("grid");
  const [timelineTrimEmptyHours, setTimelineTrimEmptyHoursState] = useState(false);
  const [timelineCollapseEmptyHourGaps, setTimelineCollapseEmptyHourGapsState] = useState(false);
  const [timelineSlotMinutes, setTimelineSlotMinutesState] = useState<TimelineSlotMinutes>(60);
  const [calendarWeekStart, setCalendarWeekStartState] = useState<CalendarWeekStart>("sunday");
  const listedKeysRef = useRef<EntryKey[]>([]);
  const prevDirRef = useRef<string>(currentDir);
  const gridKeyboardControllerRef = useRef<GridKeyboardController | null>(null);
  const secondaryGridKeyboardControllerRef = useRef<GridKeyboardController | null>(null);
  const primaryPaneControllerRef = useRef<PrimaryPaneController | null>(null);
  const primaryToolbarHostRef = useRef<((toolbar: ReactNode | null) => void) | null>(null);
  const folderDecorationsRef = useRef<Record<string, FolderDecoration>>({});
  const setFolderDecorationFnRef = useRef<((path: string, deco: FolderDecoration | null) => Promise<boolean>) | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("photoViewer:cardWidth");
      const n = raw ? Number(raw) : NaN;
      if (Number.isFinite(n)) setCardWidthState(n);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("photoViewer:viewMode");
      if (raw === "grid" || raw === "timeline" || raw === "calendar") setViewModeState(raw);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      const oldCollapse = window.localStorage.getItem("photoViewer:timelineCollapseEmptyHours") === "1";
      setTimelineTrimEmptyHoursState(
        oldCollapse || window.localStorage.getItem("photoViewer:timelineTrimEmptyHours") === "1"
      );
      setTimelineCollapseEmptyHourGapsState(
        oldCollapse || window.localStorage.getItem("photoViewer:timelineCollapseEmptyHourGaps") === "1"
      );
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      const raw = Number(window.localStorage.getItem("photoViewer:timelineSlotMinutes"));
      if (TIMELINE_SLOT_MINUTES_OPTIONS.includes(raw as TimelineSlotMinutes)) {
        setTimelineSlotMinutesState(raw as TimelineSlotMinutes);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("photoViewer:calendarWeekStart");
      if (raw === "sunday" || raw === "monday") setCalendarWeekStartState(raw);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("photoViewer:secondaryDir");
      if (raw && typeof raw === "string") {
        setSecondaryDirState(raw);
      }
      setIsSecondaryPaneOpen(window.localStorage.getItem("photoViewer:secondaryPaneOpen") === "1");
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

  const setViewMode = useCallback((mode: ViewMode) => {
    setViewModeState(mode);
    try {
      window.localStorage.setItem("photoViewer:viewMode", mode);
    } catch {
      // ignore
    }
  }, []);

  const setTimelineTrimEmptyHours = useCallback((trim: boolean) => {
    setTimelineTrimEmptyHoursState(trim);
    try {
      window.localStorage.setItem(
        "photoViewer:timelineTrimEmptyHours",
        trim ? "1" : "0"
      );
    } catch {
      // ignore
    }
  }, []);

  const setTimelineCollapseEmptyHourGaps = useCallback((collapse: boolean) => {
    setTimelineCollapseEmptyHourGapsState(collapse);
    try {
      window.localStorage.setItem(
        "photoViewer:timelineCollapseEmptyHourGaps",
        collapse ? "1" : "0"
      );
    } catch {
      // ignore
    }
  }, []);

  const setTimelineSlotMinutes = useCallback((minutes: TimelineSlotMinutes) => {
    setTimelineSlotMinutesState(minutes);
    try {
      window.localStorage.setItem("photoViewer:timelineSlotMinutes", String(minutes));
    } catch {
      // ignore
    }
  }, []);

  const setCalendarWeekStart = useCallback((weekStart: CalendarWeekStart) => {
    setCalendarWeekStartState(weekStart);
    try {
      window.localStorage.setItem("photoViewer:calendarWeekStart", weekStart);
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

  const setSecondaryDir = useCallback((dir: string) => {
    setSecondaryDirState(dir);
    try {
      window.localStorage.setItem("photoViewer:secondaryDir", dir);
    } catch {
      // ignore
    }
  }, []);

  const openSecondaryPane = useCallback((dir: string) => {
    const nextDir = normalizeDir(dir);
    if (isSecondaryPaneOpen && secondaryDir && normalizeDir(secondaryDir) === nextDir) {
      setIsSecondaryPaneOpen(false);
      setFocusTarget((target) => (target === "secondaryGrid" ? "grid" : target));
      try {
        window.localStorage.setItem("photoViewer:secondaryPaneOpen", "0");
      } catch {
        // ignore
      }
      return;
    }

    setSecondaryDir(nextDir);
    setIsSecondaryPaneOpen(true);
    try {
      window.localStorage.setItem("photoViewer:secondaryPaneOpen", "1");
    } catch {
      // ignore
    }
  }, [isSecondaryPaneOpen, secondaryDir, setSecondaryDir]);

  const closeSecondaryPane = useCallback(() => {
    setIsSecondaryPaneOpen(false);
    setFocusTarget((target) => (target === "secondaryGrid" ? "grid" : target));
    try {
      window.localStorage.setItem("photoViewer:secondaryPaneOpen", "0");
    } catch {
      // ignore
    }
  }, []);

  const bumpSecondaryReloadSignal = useCallback(() => {
    setSecondaryReloadSignal((n) => n + 1);
  }, []);

  const setPrimaryPaneController = useCallback((controller: PrimaryPaneController | null) => {
    primaryPaneControllerRef.current = controller;
  }, []);

  const moveItemsToPrimaryDir = useCallback((items: string[]) => {
    return primaryPaneControllerRef.current?.moveItemsToCurrentDir(items) ?? Promise.resolve([]);
  }, []);

  const reloadPrimaryPane = useCallback(() => {
    primaryPaneControllerRef.current?.reload();
  }, []);

  const setPrimaryToolbar = useCallback((toolbar: ReactNode | null) => {
    primaryToolbarHostRef.current?.(toolbar);
  }, []);

  const registerPrimaryToolbarHost = useCallback(
    (setter: ((toolbar: ReactNode | null) => void) | null) => {
      primaryToolbarHostRef.current = setter;
      if (!setter) return;
      setter(null);
    },
    []
  );

  const setGridKeyboardController = useCallback((c: GridKeyboardController | null) => {
    gridKeyboardControllerRef.current = c;
  }, []);

  const setSecondaryGridKeyboardController = useCallback((c: GridKeyboardController | null) => {
    secondaryGridKeyboardControllerRef.current = c;
  }, []);

  const getFolderDecoration = useCallback((path: string): FolderDecoration | null => {
    return folderDecorationsRef.current[path] ?? null;
  }, []);

  const setFolderDecoration = useCallback(
    async (path: string, decoration: FolderDecoration | null): Promise<boolean> => {
      const fn = setFolderDecorationFnRef.current;
      if (!fn) return false;
      return await fn(path, decoration);
    },
    []
  );

  const initFolderDecorations = useCallback(
    (
      decorations: Record<string, FolderDecoration>,
      setFn: (path: string, deco: FolderDecoration | null) => Promise<boolean>
    ) => {
      folderDecorationsRef.current = decorations;
      setFolderDecorationFnRef.current = setFn;
    },
    []
  );

  const value = useMemo(
    () => ({
      selectedEntry,
      setSelectedEntry,
      currentDir,
      focusTarget,
      setFocusTarget,
      gridKeyboardControllerRef,
      setGridKeyboardController,
      secondaryGridKeyboardControllerRef,
      setSecondaryGridKeyboardController,
      secondaryDir,
      isSecondaryPaneOpen,
      openSecondaryPane,
      closeSecondaryPane,
      setSecondaryDir,
      secondaryReloadSignal,
      bumpSecondaryReloadSignal,
      setPrimaryPaneController,
      moveItemsToPrimaryDir,
      reloadPrimaryPane,
      setPrimaryToolbar,
      registerPrimaryToolbarHost,
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
      viewMode,
      setViewMode,
      timelineTrimEmptyHours,
      setTimelineTrimEmptyHours,
      timelineCollapseEmptyHourGaps,
      setTimelineCollapseEmptyHourGaps,
      timelineSlotMinutes,
      setTimelineSlotMinutes,
      calendarWeekStart,
      setCalendarWeekStart,
      getFolderDecoration,
      setFolderDecoration,
      initFolderDecorations,
    }),
    [
      selectedEntry,
      currentDir,
      focusTarget,
      secondaryDir,
      isSecondaryPaneOpen,
      openSecondaryPane,
      closeSecondaryPane,
      setSecondaryDir,
      secondaryReloadSignal,
      bumpSecondaryReloadSignal,
      setPrimaryPaneController,
      moveItemsToPrimaryDir,
      reloadPrimaryPane,
      setPrimaryToolbar,
      registerPrimaryToolbarHost,
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
      viewMode,
      setViewMode,
      timelineTrimEmptyHours,
      setTimelineTrimEmptyHours,
      timelineCollapseEmptyHourGaps,
      setTimelineCollapseEmptyHourGaps,
      timelineSlotMinutes,
      setTimelineSlotMinutes,
      calendarWeekStart,
      setCalendarWeekStart,
      gridKeyboardControllerRef,
      setGridKeyboardController,
      secondaryGridKeyboardControllerRef,
      setSecondaryGridKeyboardController,
      getFolderDecoration,
      setFolderDecoration,
      initFolderDecorations,
    ]
  );

  return <ViewerContext.Provider value={value}>{children}</ViewerContext.Provider>;
}

export function useViewer() {
  const ctx = useContext(ViewerContext);
  if (!ctx) throw new Error("useViewer must be used within ViewerProvider");
  return ctx;
}
