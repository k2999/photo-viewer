"use client";

import { useMemo, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { paramsToDir, dirToUrl, parentDir, normalizeDir } from "@/lib/path";
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

const GRID_COLS = 6;

export default function PhotoViewerPage() {
  const router = useRouter();
  const params = useParams<{ path?: string[] }>();

  const currentPath = useMemo(() => {
    return paramsToDir(params?.path);
  }, [params]);

  const { dirThumbs, fetchDirThumbs, resetDirThumbs } = useDirThumbs();

  const {
    entries,
    selectedIndex,
    setSelectedIndex,
    isPreviewOpen,
    setIsPreviewOpen,
    reload,
  } = useDirEntries(currentPath);

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

  useCallback(() => {
    resetChecked();
    resetDirThumbs();
  }, [reload, resetChecked, resetDirThumbs]);

  useSelectedEntrySync(selectedEntry);

  const pushDir = useCallback(
    (dirPath: string) => {
      router.push(dirToUrl(dirPath));
    },
    [router]
  );

  const goParent = useCallback(() => {
    if (normalizeDir(currentPath) === ".") return;
    pushDir(parentDir(currentPath));
  }, [currentPath, pushDir]);

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
        <div className="grid">
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
                <img
                  src={`/api/thumb?path=${encodeURIComponent(e.relativePath)}`}
                  loading="lazy"
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
