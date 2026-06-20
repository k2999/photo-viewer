"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeft, faFile, faXmark } from "@fortawesome/free-solid-svg-icons";
import { DirectoryThumbnail } from "@/components/DirectoryThumbnail";
import { EntryCard } from "@/components/EntryCard";
import { PhotoThumbnail } from "@/components/PhotoThumbnail";
import { PreviewOverlay } from "@/components/PreviewOverlay";
import { VideoBadge } from "@/components/VideoBadge";
import { ConflictModal } from "@/components/ConflictModal";
import { entryKeyOf, type EntryKey, type FocusTarget, type GridKeyboardController } from "@/components/ViewerContext";
import { useDirEntries } from "@/hooks/useDirEntries";
import { useDirThumbs } from "@/hooks/useDirThumbs";
import { useBulkActions, type ConflictDecision } from "@/hooks/useBulkActions";
import { normalizeDir, parentDir } from "@/lib/path";
import { setStackedThumbDragImage } from "@/lib/dnd/stackedThumbDragImage";
import { hasMoveItems, readMoveItems, writeMoveItems } from "@/lib/dnd/movePayload";

export type SecondaryPaneProps = {
  dir: string;
  cardWidth: number;
  reloadSignal: number;
  onMoveToMain: (items: string[]) => Promise<string[] | null | undefined>;
  onMainNeedsReload: () => void;
  onClose: () => void;
  setFocusTarget: (target: FocusTarget) => void;
  setSecondaryDir: (dir: string) => void;
  setSecondaryGridKeyboardController: (controller: GridKeyboardController | null) => void;
};

function itemParentDir(item: string) {
  return normalizeDir(parentDir(item.replace(/\/$/, "")));
}

function SecondaryPaneInner({
  dir,
  cardWidth,
  reloadSignal,
  onMoveToMain,
  onMainNeedsReload,
  onClose,
  setFocusTarget,
  setSecondaryDir,
  setSecondaryGridKeyboardController,
}: SecondaryPaneProps) {
  const {
    entries,
    selectedIndex,
    setSelectedIndex,
    reload,
    removeEntriesByRelativePath,
  } = useDirEntries(dir);
  const { dirThumbs, fetchDirThumbs } = useDirThumbs();
  const [checked, setChecked] = useState<Set<EntryKey>>(() => new Set());
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const [gridCols, setGridCols] = useState(1);
  const [conflictState, setConflictState] = useState<{
    open: boolean;
    item: string;
    dest: string;
    existingName: string;
    resolve: ((d: ConflictDecision) => void) | null;
  }>({ open: false, item: "", dest: "", existingName: "", resolve: null });

  const askConflict = useCallback((args: { item: string; dest: string; existingName: string }) => {
    return new Promise<ConflictDecision>((resolve) => {
      setConflictState({ open: true, resolve, ...args });
    });
  }, []);

  const { handleMoveItemsToDest } = useBulkActions({
    checked,
    setChecked,
    reload,
    askConflict,
  });

  useEffect(() => {
    setChecked(new Set());
    setSelectedIndex(0);
    setIsPreviewOpen(false);
  }, [dir, setSelectedIndex]);

  useEffect(() => {
    if (reloadSignal <= 0) return;
    reload();
  }, [reloadSignal, reload]);

  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const measure = () => {
      const kids = Array.from(el.querySelectorAll<HTMLElement>("[data-idx]"));
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
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [entries.length, cardWidth]);

  const selectedEntry = entries[selectedIndex] ?? null;

  const toggleCheck = useCallback((key: EntryKey) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const buildDragItems = useCallback(
    (key: string) => (checked.size > 0 && checked.has(key) ? Array.from(checked) : [key]),
    [checked]
  );

  const onCardDragStart = useCallback(
    (ev: React.DragEvent<HTMLDivElement>, key: string) => {
      const items = buildDragItems(key);
      writeMoveItems(ev.dataTransfer, items);
      ev.dataTransfer.effectAllowed = "move";
      setStackedThumbDragImage({
        dataTransfer: ev.dataTransfer,
        entryKeys: items,
        getThumbSrc: (entryKey) => {
          const selector = `.secondary-pane [data-entry-key="${CSS.escape(entryKey)}"] .card-thumb img`;
          const srcImg = document.querySelector(selector) as HTMLImageElement | null;
          return srcImg?.src ?? null;
        },
      });
    },
    [buildDragItems]
  );

  const moveSelectedToMain = useCallback(async () => {
    if (checked.size === 0) return;
    const moved = await onMoveToMain(Array.from(checked));
    if (moved && moved.length > 0) {
      removeEntriesByRelativePath(moved);
      setChecked((prev) => {
        const next = new Set(prev);
        for (const key of moved) next.delete(key);
        return next;
      });
      onMainNeedsReload();
    }
  }, [checked, onMainNeedsReload, onMoveToMain, removeEntriesByRelativePath]);

  const moveDroppedHere = useCallback(
    async (items: string[]) => {
      const movable = items.filter((item) => itemParentDir(item) !== normalizeDir(dir));
      if (movable.length === 0) return;
      const moved = await handleMoveItemsToDest(dir, movable);
      if (moved && moved.length > 0) {
        reload();
        onMainNeedsReload();
      }
    },
    [dir, handleMoveItemsToDest, onMainNeedsReload, reload]
  );

  const keyboard: GridKeyboardController = useMemo(
    () => ({
      selectLeft: () => {
        if (entries.length === 0) return;
        setSelectedIndex((i) => Math.max(0, i - 1));
      },
      selectRight: () => {
        if (entries.length === 0) return;
        setSelectedIndex((i) => Math.min(entries.length - 1, i + 1));
      },
      selectUp: () => {
        if (entries.length === 0) return;
        setSelectedIndex((i) => Math.max(0, i - gridCols));
      },
      selectDown: () => {
        if (entries.length === 0) return;
        setSelectedIndex((i) => Math.min(entries.length - 1, i + gridCols));
      },
      goSiblingDir: () => {},
      toggleCheckSelected: () => {
        if (!selectedEntry) return;
        toggleCheck(entryKeyOf(selectedEntry));
      },
      selectAll: () => setChecked(new Set(entries.map((e) => entryKeyOf(e)))),
      deselectAll: () => setChecked(new Set()),
      selectBurst: () => {},
      commandEnter: () => {},
      deleteReviewMarkDelete: () => {},
      escape: () => {
        if (isPreviewOpen) setIsPreviewOpen(false);
        else onClose();
      },
      enter: () => {
        if (selectedEntry?.type === "dir") setSecondaryDir(selectedEntry.relativePath);
        else if (selectedEntry?.type === "image" || selectedEntry?.type === "video") {
          setIsPreviewOpen((v) => !v);
        }
      },
      shiftEnter: () => {
        if (isPreviewOpen) {
          setIsPreviewOpen(false);
        } else if (normalizeDir(dir) !== ".") {
          setSecondaryDir(normalizeDir(parentDir(dir)));
        }
      },
    }),
    [
      dir,
      entries,
      gridCols,
      isPreviewOpen,
      onClose,
      selectedEntry,
      setSecondaryDir,
      setSelectedIndex,
      toggleCheck,
    ]
  );

  useEffect(() => {
    setSecondaryGridKeyboardController(keyboard);
    return () => setSecondaryGridKeyboardController(null);
  }, [keyboard, setSecondaryGridKeyboardController]);

  const canMoveToMain = checked.size > 0;

  return (
    <section
      className="secondary-pane"
      onMouseDown={(e) => {
        e.stopPropagation();
        setFocusTarget("secondaryGrid");
      }}
      style={
        {
          ["--card-w" as any]: `${cardWidth}px`,
          ["--grid-gap" as any]: `${Math.max(8, Math.round(cardWidth * 0.04))}px`,
        } as React.CSSProperties
      }
    >
      <div className="secondary-pane-header">
        <div className="secondary-pane-title" title={dir}>{dir}</div>
        <span className="secondary-pane-count">{checked.size} 件選択中</span>
        <button
          type="button"
          className="toolbar-button"
          onClick={moveSelectedToMain}
          disabled={!canMoveToMain}
          aria-label="選択項目を左ペインへ移動"
          title="選択項目を左ペインへ移動"
        >
          <FontAwesomeIcon icon={faArrowLeft} />
        </button>
        <button
          type="button"
          className="secondary-pane-close"
          onClick={onClose}
          aria-label="右ペインを閉じる"
          title="右ペインを閉じる"
        >
          <FontAwesomeIcon icon={faXmark} />
        </button>
      </div>

      <div
        className="grid secondary-grid"
        ref={gridRef}
        onDragOver={(ev) => {
          if (!hasMoveItems(ev.dataTransfer)) return;
          ev.preventDefault();
          ev.dataTransfer.dropEffect = "move";
        }}
        onDrop={(ev) => {
          const items = readMoveItems(ev.dataTransfer);
          if (!items || items.length === 0) return;
          ev.preventDefault();
          ev.stopPropagation();
          void moveDroppedHere(items);
        }}
      >
        {entries.map((e, idx) => {
          const key = entryKeyOf(e);
          const isSelected = idx === selectedIndex;
          const isChecked = checked.has(key);
          const thumb =
            e.type === "dir" ? (
              <DirectoryThumbnail
                dirPath={e.relativePath}
                thumbs={dirThumbs[e.relativePath]}
                onNeedThumbs={fetchDirThumbs}
                resetOnNavigation={false}
              />
            ) : e.type === "image" || e.type === "video" ? (
              <>
                <PhotoThumbnail
                  src={`/api/thumb?path=${encodeURIComponent(e.relativePath)}`}
                  alt={e.name}
                  resetOnNavigation={false}
                />
                {e.type === "video" && <div className="card-badges"><VideoBadge entry={e} /></div>}
              </>
            ) : (
              <span title="ファイル"><FontAwesomeIcon icon={faFile} /></span>
            );

          return (
            <EntryCard
              key={e.relativePath}
              idx={idx}
              entryKey={key}
              className={[
                "card",
                isSelected ? "card-selected" : "",
                isChecked ? "card-checked" : "",
              ].filter(Boolean).join(" ")}
              title={e.name}
              name={e.name}
              isChecked={isChecked}
              draggable={true}
              onDragStart={(ev) => onCardDragStart(ev, key)}
              onClick={() => setSelectedIndex(idx)}
              onDoubleClick={() => {
                if (e.type === "dir") setSecondaryDir(e.relativePath);
                else if (e.type === "image" || e.type === "video") setIsPreviewOpen(true);
              }}
              onCheckboxChange={(ev) => {
                ev.stopPropagation();
                toggleCheck(key);
              }}
              thumb={thumb}
            />
          );
        })}
      </div>

      <PreviewOverlay
        isOpen={isPreviewOpen}
        entry={selectedEntry}
        onClose={() => setIsPreviewOpen(false)}
        hasPrev={selectedIndex > 0}
        hasNext={selectedIndex < entries.length - 1}
        onPrev={() => setSelectedIndex((i) => Math.max(0, i - 1))}
        onNext={() => setSelectedIndex((i) => Math.min(entries.length - 1, i + 1))}
        isChecked={selectedEntry ? checked.has(entryKeyOf(selectedEntry)) : false}
        onToggleCheck={() => {
          if (!selectedEntry) return;
          toggleCheck(entryKeyOf(selectedEntry));
        }}
      />

      <ConflictModal
        open={conflictState.open}
        item={conflictState.item}
        dest={conflictState.dest}
        existingName={conflictState.existingName}
        onResolve={(d) => {
          const resolve = conflictState.resolve;
          setConflictState((s) => ({ ...s, open: false, resolve: null }));
          resolve?.(d);
        }}
      />
    </section>
  );
}

export const SecondaryPane = React.memo(
  SecondaryPaneInner,
  (prev, next) =>
    prev.dir === next.dir &&
    prev.cardWidth === next.cardWidth &&
    prev.reloadSignal === next.reloadSignal
);
