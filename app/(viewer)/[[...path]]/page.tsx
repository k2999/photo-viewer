"use client";

import { useMemo, useCallback, useEffect } from "react";
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
import { ThumbImage } from "@/components/ThumbImage";
import { useViewer } from "@/components/ViewerContext";

const GRID_COLS = 6;
const PENDING_KEY = "photoViewer:pendingSelectOnEnter";

export default function PhotoViewerPage() {
  const router = useRouter();
  const params = useParams<{ path?: string[] }>();

  const currentPath = useMemo(() => {
    return paramsToDir(params?.path);
  }, [params]);

  const { dirThumbs, fetchDirThumbs, resetDirThumbs, abortAllDirThumbs } = useDirThumbs();

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

  const { bumpNavGen } = useViewer();

  const pushDir = useCallback(
    (dirPath: string) => {
      abortAllDirThumbs();
      bumpNavGen();
      router.push(dirToUrl(dirPath));
    },
    [abortAllDirThumbs, bumpNavGen, router]
  );

  const goParent = useCallback(() => {
    if (normalizeDir(currentPath) === ".") return;
    const prev = normalizeDir(currentPath);
    const next = normalizeDir(parentDir(currentPath));
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
  }, [currentPath, pushDir]);

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
    if (payload?.targetDir !== normalizeDir(currentPath)) return;

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
  }, [currentPath, entries, setSelectedIndex]);

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
        <div className="grid" key={currentPath}>
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
