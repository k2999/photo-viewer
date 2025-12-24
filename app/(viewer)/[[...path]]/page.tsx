"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { parentDir, normalizeDir } from "@/lib/path";
import { DirThumbGrid } from "@/components/DirThumbGrid";
import { EntryCard } from "@/components/EntryCard";
import { useCheckedSet } from "@/hooks/useCheckedSet";
import { useKeyboardNav } from "@/hooks/useKeyboardNav";
import { useDirThumbs } from "@/hooks/useDirThumbs";
import { useDirEntries } from "@/hooks/useDirEntries";
import { useSelectedEntrySync } from "@/hooks/useSelectedEntrySync";
import { useScrollFollowSelected } from "@/hooks/useScrollFollowSelected";
import { PreviewOverlay } from "@/components/PreviewOverlay";
import { useBulkActions } from "@/hooks/useBulkActions";
import { ViewerToolbar } from "@/components/ViewerToolbar";
import { ThumbImage } from "@/components/ThumbImage";
import { entryKeyOf, useViewer, useViewerNav } from "@/components/ViewerContext";
import { VideoBadge } from "@/components/VideoBadge";

const GRID_COLS = 6;
const PENDING_KEY = "photoViewer:pendingSelectOnEnter";

export default function PhotoViewerPage() {
  const { currentDir, checked, setChecked, toggleCheck, registerListedKeys, selectAll, deselectAll, cardWidth, setCardWidth } = useViewer();
  const nav = useViewerNav();
  const { dirThumbs, fetchDirThumbs, resetDirThumbs, abortAllDirThumbs } = useDirThumbs();

  const {
    entries,
    selectedIndex,
    setSelectedIndex,
    isPreviewOpen,
    setIsPreviewOpen,
    reload,
  } = useDirEntries(currentDir);

  const listedKeys = useMemo(() => {
    return entries.map((e) => entryKeyOf(e));
  }, [entries]);

  useEffect(() => {
    registerListedKeys(listedKeys);
  }, [listedKeys, registerListedKeys]);

  const { handleBulkDelete, handleBulkMove } = useBulkActions({
    checked,
    setChecked,
    reload,
  });

  const selectedEntry = entries[selectedIndex] ?? null;

  const gridRef = useRef<HTMLDivElement | null>(null);
  const [gridCols, setGridCols] = useState<number>(1);

  useEffect(() => {
    abortAllDirThumbs();
    resetDirThumbs();
    setIsPreviewOpen(false);
    setSelectedIndex(0);
  }, [currentDir, abortAllDirThumbs, resetDirThumbs, setIsPreviewOpen, setSelectedIndex]);


  useSelectedEntrySync(selectedEntry);

  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;

    const measure = () => {
      const kids = Array.from(el.children) as HTMLElement[];
      if (kids.length === 0) {
        setGridCols(1);
        return;
      }
      const top = kids[0].offsetTop;
      let cols = 0;
      for (const k of kids) {
        if (k.offsetTop !== top) break;
        cols++;
      }
      setGridCols(Math.max(1, cols));
    };

    measure();

    const ro = new ResizeObserver(() => measure());
    ro.observe(el);

    return () => ro.disconnect();
  }, [currentDir, entries.length, cardWidth]);

  const pushDir = useCallback(
    (dirPath: string) => {
      abortAllDirThumbs();
      setIsPreviewOpen(false);
      nav.pushDir(dirPath);
    },
    [abortAllDirThumbs, nav, setIsPreviewOpen]
  );

  const goParent = useCallback(() => {
    if (normalizeDir(currentDir) === ".") return;
    const prev = normalizeDir(currentDir);
    const next = normalizeDir(parentDir(currentDir));
    try {
      sessionStorage.setItem(
        PENDING_KEY,
        JSON.stringify({
          targetDir: next,
          kind: "entryByRelativePath",
          relativePath: prev,
          ts: Date.now(),
        })
      );
    } catch {
    }
    pushDir(next);
  }, [currentDir, pushDir]);

  const goSiblingDir = useCallback(
    (delta: -1 | 1) => {
      abortAllDirThumbs();
      setIsPreviewOpen(false);
      nav.goSiblingDir(delta);
    },
    [abortAllDirThumbs, nav, setIsPreviewOpen]
  );

  // 親へ戻った直後、entries が揃ったら「元いた子フォルダ」を選択する（1回限り）
  useEffect(() => {
    if (!entries || entries.length === 0) return;

    let raw: string | null = null;
    try {
      raw = sessionStorage.getItem(PENDING_KEY);
    } catch {
      return;
    }
    if (!raw) return;

    let payload: any;
    try {
      payload = JSON.parse(raw);
    } catch {
      try { sessionStorage.removeItem(PENDING_KEY); } catch {}
      return;
    }

    // このディレクトリに入ったときだけ適用
    if (payload?.targetDir !== normalizeDir(currentDir)) return;

    if (
      payload?.kind === "entryByRelativePath" &&
      typeof payload?.relativePath === "string"
    ) {
      const want = normalizeDir(payload.relativePath);
      const idx = entries.findIndex(
        (e) => e.type === "dir" && normalizeDir(e.relativePath) === want
      );
      if (idx >= 0) {
        setSelectedIndex(idx);
      }
    }

    // 1回限りで消費
    try { sessionStorage.removeItem(PENDING_KEY); } catch {}
  }, [currentDir, entries, setSelectedIndex]);

  const setRangeChecked = useCallback(
    (fromIdx: number, toIdx: number, nextState: boolean) => {
      const a = Math.min(fromIdx, toIdx);
      const b = Math.max(fromIdx, toIdx);
      const keys = entries.slice(a, b + 1).map((e) => entryKeyOf(e));
      setChecked((prev) => {
        const next = new Set(prev);
        for (const k of keys) {
          if (nextState) next.add(k);
          else next.delete(k);
        }
        return next;
      });
    },
    [entries, setChecked]
  );

  useKeyboardNav({
    entriesLength: entries.length,
    gridCols,
    selectedEntry: selectedEntry,
    isPreviewOpen,
    setIsPreviewOpen,
    setSelectedIndex,
    toggleCheck,
    selectAll,
    deselectAll,
    goParent,
    pushDir,
    goSiblingDir,
  });

  useScrollFollowSelected({
    selectedIndex,
    isPreviewOpen,
    entriesLength: entries.length,
  });

  return (
    <>
      <ViewerToolbar
        checkedCount={checked.size}
        onBulkDelete={handleBulkDelete}
        onBulkMove={handleBulkMove}
        cardWidth={cardWidth}
        onCardWidthChange={setCardWidth}
      />

      <div className="grid-container">
        <div className="grid" key={currentDir} ref={gridRef}>
          {entries.map((e, idx) => {
            const isSelected = idx === selectedIndex;
            const key = entryKeyOf(e);
            const isChecked = checked.has(key);
            const cardClasses = [
              "card",
              isSelected ? "card-selected" : "",
              isChecked ? "card-checked" : "",
            ]
              .filter(Boolean)
              .join(" ");

            const thumb =
              e.type === "image" ? (
                <ThumbImage
                  src={`/api/thumb?path=${encodeURIComponent(e.relativePath)}`}
                  alt={e.name}
                />
              ) : e.type === "video" ? (
                <>
                  <ThumbImage
                    src={`/api/thumb?path=${encodeURIComponent(e.relativePath)}`}
                    alt={e.name}
                  />
                  <VideoBadge entry={e} />
                </>
              ) : e.type === "dir" ? (
                <DirThumbGrid
                  dirPath={e.relativePath}
                  thumbs={dirThumbs[e.relativePath]}
                  onNeedThumbs={fetchDirThumbs}
                />
              ) : (
                <span>📄</span>
              );

            return (
              <EntryCard
                key={e.relativePath}
                idx={idx}
                className={cardClasses}
                title={e.name}
                name={e.name}
                isChecked={isChecked}
                onClick={() => setSelectedIndex(idx)}
                onDoubleClick={() => {
                  if (e.type === "dir") {
                    pushDir(e.relativePath);
                  } else {
                    setIsPreviewOpen(true);
                  }
                }}
                onCheckboxChange={(ev) => {
                  ev.stopPropagation();
                  const nextState = ev.target.checked;
                  const isShift = (ev.nativeEvent as MouseEvent).shiftKey;

                  if (isShift) {
                    setRangeChecked(selectedIndex, idx, nextState);
                  } else {
                    toggleCheck(key);
                  }
                }}
                thumb={thumb}
              />
            );
          })}
        </div>
      </div>

      <PreviewOverlay
        isOpen={isPreviewOpen}
        entry={selectedEntry}
        onClose={() => setIsPreviewOpen(false)}
        hasPrev={selectedIndex > 0}
        hasNext={selectedIndex < entries.length - 1}
        onPrev={() => {
          setSelectedIndex((i) => Math.max(0, i - 1));
        }}
        onNext={() => {
          setSelectedIndex((i) => Math.min(entries.length - 1, i + 1));
        }}
      />
    </>
  );
}
