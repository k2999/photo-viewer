"use client";

import { useCallback, useEffect } from "react";
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
import { useViewer, useViewerNav } from "@/components/ViewerContext";

const GRID_COLS = 6;
const PENDING_KEY = "photoViewer:pendingSelectOnEnter";

export default function PhotoViewerPage() {
  const { currentDir } = useViewer();
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

  const {
    checked,
    setChecked,
    toggleCheck,
    selectAll,
    deselectAll,
    setRangeChecked,
    resetChecked,
  } = useCheckedSet(entries);

  const { handleBulkDelete, handleBulkMove } = useBulkActions({
    checked,
    setChecked,
    reload,
  });

  const selectedEntry = entries[selectedIndex] ?? null;

  useEffect(() => {
    resetChecked();
    abortAllDirThumbs();
    resetDirThumbs();
    setIsPreviewOpen(false);
    setSelectedIndex(0);
  }, [currentDir, abortAllDirThumbs, resetChecked, resetDirThumbs, setIsPreviewOpen, setSelectedIndex]);

  useSelectedEntrySync(selectedEntry);

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

  useKeyboardNav({
    entriesLength: entries.length,
    gridCols: GRID_COLS,
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
      />

      <div className="grid-container">
        <div className="grid" key={currentDir}>
          {entries.map((e, idx) => {
            const isSelected = idx === selectedIndex;
            const isChecked = checked.has(e.relativePath);
            const cardClasses = [
              "card",
              isSelected ? "card-selected" : "",
              isChecked ? "card-checked" : "",
            ]
              .filter(Boolean)
              .join(" ");

            const thumb =
              e.type === "image" || e.type === "video" ? (
                <ThumbImage
                  src={`/api/thumb?path=${encodeURIComponent(e.relativePath)}`}
                  alt={e.name}
                />
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
                    toggleCheck(e.relativePath);
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
      />
    </>
  );
}
