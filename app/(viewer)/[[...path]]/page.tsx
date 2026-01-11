"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { parentDir, normalizeDir } from "@/lib/path";
import { DirThumbGrid } from "@/components/DirThumbGrid";
import { EntryCard } from "@/components/EntryCard";
import { useKeyboardNav } from "@/hooks/useKeyboardNav";
import { useDirThumbs } from "@/hooks/useDirThumbs";
import { useDirEntries } from "@/hooks/useDirEntries";
import { useSelectedEntrySync } from "@/hooks/useSelectedEntrySync";
import { useScrollFollowSelected } from "@/hooks/useScrollFollowSelected";
import { PreviewOverlay } from "@/components/PreviewOverlay";
import { useBulkActions } from "@/hooks/useBulkActions";
import { ViewerToolbar } from "@/components/ViewerToolbar";
import { ThumbImage } from "@/components/ThumbImage";
import { entryKeyOf, useViewer } from "@/components/ViewerContext";
import { useViewerNavigator } from "@/hooks/useViewerNavigator";
import { VideoBadge } from "@/components/VideoBadge";
import { ExifPrefetch } from "@/components/ExifPrefetch";
import { abortAllExifRequests } from "@/hooks/useExif";
import { useExif } from "@/hooks/useExif";
import { DateKeyPrefetch } from "@/components/DateKeyPrefetch";
import { SameTimeBadge } from "@/components/SameTimeBadge";

const PENDING_KEY = "photoViewer:pendingSelectOnEnter";

type ConflictDecision = { strategy: "overwrite" | "skip" | "rename"; applyToAll: boolean };

function ConflictModal({
  open,
  item,
  dest,
  existingName,
  onResolve,
}: {
  open: boolean;
  item: string;
  dest: string;
  existingName: string;
  onResolve: (d: ConflictDecision) => void;
}) {
  const [applyToAll, setApplyToAll] = useState(false);

  useEffect(() => {
    if (!open) setApplyToAll(false);
  }, [open]);

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        style={{
          width: "min(520px, 100%)",
          background: "#fff",
          borderRadius: 10,
          padding: 14,
          boxShadow: "0 12px 40px rgba(0,0,0,0.25)",
          fontSize: 13,
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 8 }}>同名が既に存在します</div>

        <div style={{ fontSize: 12, color: "#444", marginBottom: 10, lineHeight: 1.4 }}>
          <div>
            移動元: <code>{item}</code>
          </div>
          <div>
            移動先: <code>{dest}</code>
          </div>
          <div>
            競合: <code>{existingName}</code>
          </div>
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <input
            type="checkbox"
            checked={applyToAll}
            onChange={(e) => setApplyToAll(e.target.checked)}
          />
          以後同じ動作にする
        </label>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button className="toolbar-button" onClick={() => onResolve({ strategy: "skip", applyToAll })}>
            スキップ
          </button>
          <button className="toolbar-button" onClick={() => onResolve({ strategy: "rename", applyToAll })}>
            リネーム（~1）
          </button>
          <button className="toolbar-button" onClick={() => onResolve({ strategy: "overwrite", applyToAll })}>
            上書き
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PhotoViewerPage() {
  const {
    currentDir,
    checked,
    setChecked,
    toggleCheck,
    registerListedKeys,
    selectAll,
    deselectAll,
    cardWidth,
    setCardWidth,
    focusTarget,
    markedDir,
    setMoveToDir,
  } = useViewer();

  const nav = useViewerNavigator();
  const { dirThumbs, fetchDirThumbs, resetDirThumbs, abortAllDirThumbs } = useDirThumbs();

  const {
    entries,
    selectedIndex,
    setSelectedIndex,
    isPreviewOpen,
    setIsPreviewOpen,
    reload,
    removeEntriesByRelativePath,
  } = useDirEntries(currentDir);

  const listedKeys = useMemo(() => {
    return entries.map((e) => entryKeyOf(e));
  }, [entries]);

  useEffect(() => {
    registerListedKeys(listedKeys);
  }, [listedKeys, registerListedKeys]);

  const [conflictState, setConflictState] = useState<{
    open: boolean;
    item: string;
    dest: string;
    existingName: string;
    resolve: ((d: ConflictDecision) => void) | null;
  }>({
    open: false,
    item: "",
    dest: "",
    existingName: "",
    resolve: null,
  });

  const askConflict = useCallback((args: { item: string; dest: string; existingName: string }) => {
    return new Promise<ConflictDecision>((resolve) => {
      setConflictState({
        open: true,
        item: args.item,
        dest: args.dest,
        existingName: args.existingName,
        resolve,
      });
    });
  }, []);

  const { handleBulkDelete, handleMoveToMarked, handleMoveItemsToDest } = useBulkActions({
    checked,
    setChecked,
    reload,
    markedDir,
    askConflict,
  });

  // 追加：最新版の handler を保持
  const moveToDestRef = useRef(handleMoveItemsToDest);

  // 追加：handler が変わっても ref を差し替えるだけ（再レンダーの原因にしない）
  useEffect(() => {
    moveToDestRef.current = handleMoveItemsToDest;
  }, [handleMoveItemsToDest]);

  // 差し替え：setMoveToDir は「1回だけ」設定
  useEffect(() => {
    setMoveToDir((destDir: string, items: string[]) => {
      void (async () => {
        const moved = await handleMoveItemsToDest(destDir, items);
        if (moved && moved.length > 0) {
          removeEntriesByRelativePath(moved);
        }
        // 原則reloadしない。必要なら moved.length === 0 のときだけ reload() とかにできる
      })();
    });
    return () => setMoveToDir(null);
  }, [handleMoveItemsToDest, setMoveToDir, removeEntriesByRelativePath]);

  const selectedEntry = entries[selectedIndex] ?? null;

  // ---- Same datetime highlight ----
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [dateKeyMap, setDateKeyMap] = useState<Record<string, string | null>>({});

  const dateKeyCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of entries) {
      if (e.type !== "image" && e.type !== "video") continue;
      const k = entryKeyOf(e);
      const dk = dateKeyMap[k];
      if (!dk) continue;
      counts[dk] = (counts[dk] ?? 0) + 1;
    }
    return counts;
  }, [entries, dateKeyMap]);

  const normalizeExifDateTime = (v: unknown): string | null => {
    if (v == null) return null;
    const s = String(v).trim();
    if (!s) return null;
    const m = s.match(/^(\d{4})[:\-](\d{2})[:\-](\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
    if (!m) return null;
    const [, Y, M, D, h, mi, sec] = m;
    return `${Y}-${M}-${D}T${h}:${mi}:${sec}`;
  };

  const pickDateKey = (exif: any): string | null => {
    const candidates = [
      exif?.DateTimeOriginal,
      exif?.CreateDate,
      exif?.MediaCreateDate,
      exif?.TrackCreateDate,
      exif?.ModifyDate,
      exif?.FileModifyDate,
    ];
    for (const c of candidates) {
      const k = normalizeExifDateTime(c);
      if (k) return k;
    }
    return null;
  };

  const selectedEnabled =
    !!selectedEntry && selectedEntry.type !== "dir" && selectedEntry.type !== "other";
  const { exif: selectedExif } = useExif(
    selectedEnabled ? selectedEntry!.relativePath : null,
    selectedEnabled
  );

  useEffect(() => {
    if (!selectedEnabled) {
      setSelectedDateKey(null);
      return;
    }
    setSelectedDateKey(selectedExif ? pickDateKey(selectedExif) : null);
  }, [selectedEnabled, selectedExif]);

  const gridRef = useRef<HTMLDivElement | null>(null);
  const [gridCols, setGridCols] = useState<number>(1);

  useEffect(() => {
    abortAllExifRequests();
    abortAllDirThumbs();
    resetDirThumbs();
    setIsPreviewOpen(false);
    setSelectedIndex(0);
    setSelectedDateKey(null);
    setDateKeyMap({});
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
      // ignore
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
      try {
        sessionStorage.removeItem(PENDING_KEY);
      } catch {}
      return;
    }

    if (payload?.targetDir !== normalizeDir(currentDir)) return;

    if (payload?.kind === "entryByRelativePath" && typeof payload?.relativePath === "string") {
      const want = normalizeDir(payload.relativePath);
      const idx = entries.findIndex((e) => e.type === "dir" && normalizeDir(e.relativePath) === want);
      if (idx >= 0) {
        setSelectedIndex(idx);
      }
    }

    try {
      sessionStorage.removeItem(PENDING_KEY);
    } catch {}
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

  // ===== Drag payload build =====
  const buildDragItems = useCallback(
    (key: string) => {
      if (checked.size > 0 && checked.has(key)) return Array.from(checked);
      return [key];
    },
    [checked]
  );

  const onCardDragStart = useCallback(
    (ev: React.DragEvent<HTMLDivElement>, key: string) => {
      const items = buildDragItems(key);
      const payload = JSON.stringify({ kind: "photoViewer:moveItems", items });
      ev.dataTransfer.setData("application/json", payload);
      ev.dataTransfer.effectAllowed = "move";

      // ===== custom drag image (100x100, stack + count badge) =====
      const count = items.length;
      const ghost = document.createElement("div");
      ghost.style.width = "100px";
      ghost.style.height = "100px";
      ghost.style.position = "fixed";
      ghost.style.left = "-1000px";
      ghost.style.top = "-1000px";
      ghost.style.zIndex = "999999";
      ghost.style.pointerEvents = "none";
      ghost.style.borderRadius = "10px";
      ghost.style.boxSizing = "border-box";

      for (let i = Math.min(count, 10); i >= 1; i--) {
        const d = 12 / (count - 1) * (i - 1);
        const o = 1 - 0.1 * (i - 1);

        const layer = document.createElement("div");
        layer.style.position = "absolute";
        layer.style.inset = "0";
        layer.style.transform = `translate(${d}px, ${d}px)`;
        layer.style.borderRadius = "10px";
        layer.style.background = "#fff";
        layer.style.border = "1px solid #ccc";
        layer.style.opacity = String(o);
        layer.style.overflow = "hidden";

        const entryKey = items[i - 1];
        const selector = `[data-entry-key="${CSS.escape(entryKey)}"] .card-thumb img`;
        const srcImg = document.querySelector(selector) as HTMLImageElement | null;

        if (srcImg && srcImg.src) {
          const thumb = document.createElement("img");
          thumb.src = srcImg.src;
          thumb.alt = "";
          thumb.draggable = false;
          thumb.style.width = "100%";
          thumb.style.height = "100%";
          thumb.style.objectFit = "cover";
          thumb.style.display = "block";
          layer.appendChild(thumb);
        }

        ghost.appendChild(layer);
      }

      // count badge
      if (count >= 2) {
        const badge = document.createElement("div");
        badge.textContent = `${count}`;
        badge.style.position = "absolute";
        badge.style.right = "8px";
        badge.style.bottom = "8px";
        badge.style.padding = "4px 8px";
        badge.style.borderRadius = "999px";
        badge.style.background = "rgba(0,0,0,0.78)";
        badge.style.color = "#fff";
        badge.style.fontSize = "12px";
        badge.style.fontWeight = "700";
        badge.style.lineHeight = "1";
        ghost.appendChild(badge);
      }

      document.body.appendChild(ghost);

      // 2) set drag image; offset (x=4,y=4) => ghost is ~4px up-left relative to cursor feel
      try {
        ev.dataTransfer.setDragImage(ghost, 4, 4);
      } catch {
        // ignore (very old browsers)
      }

      // 3) cleanup on dragend (and a timeout fallback)
      const cleanup = () => {
        ghost.remove();
        window.removeEventListener("dragend", cleanup, true);
      };
      window.addEventListener("dragend", cleanup, true);
      window.setTimeout(cleanup, 0);
    },
    [buildDragItems]
  );

  useKeyboardNav({
    entriesLength: entries.length,
    gridCols,
    selectedEntry: selectedEntry,
    enabled: focusTarget === "grid",
    isPreviewOpen,
    setIsPreviewOpen,
    setSelectedIndex,
    toggleCheck,
    selectAll,
    deselectAll,
    goParent,
    pushDir,
    goSiblingDir,
  } as any);

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
        onMoveToMarked={async () => {
          if (!markedDir) return;
          const moved = await handleMoveItemsToDest(markedDir, Array.from(checked));
          if (moved && moved.length > 0) removeEntriesByRelativePath(moved);
        }}
        markedDir={markedDir}
        cardWidth={cardWidth}
        onCardWidthChange={setCardWidth}
      />

      <div className="grid-container">
        <div className="grid" key={currentDir} ref={gridRef}>
          {entries.map((e, idx) => {
            const isSelected = idx === selectedIndex;
            const key = entryKeyOf(e);
            const isChecked = checked.has(key);
            const same = !!selectedDateKey && dateKeyMap[key] != null && dateKeyMap[key] === selectedDateKey;

            const dk = dateKeyMap[key];
            const dupCount = dk ? (dateKeyCounts[dk] ?? 0) : 0;
            const showSameTimeBadge = (e.type === "image" || e.type === "video") && dupCount >= 2;

            const cardClasses = [
              "card",
              isSelected ? "card-selected" : "",
              isChecked ? "card-checked" : "",
              same ? "card-same-datetime" : "",
            ]
              .filter(Boolean)
              .join(" ");

            const thumb =
              e.type === "image" ? (
                <>
                  <ThumbImage
                    src={`/api/thumb?path=${encodeURIComponent(e.relativePath)}`}
                    alt={e.name}
                  />
                  <ExifPrefetch path={e.relativePath} />
                  <DateKeyPrefetch
                    path={e.relativePath}
                    onResolved={(dk) => {
                      setDateKeyMap((prev) => {
                        if (prev[key] === dk) return prev;
                        return { ...prev, [key]: dk };
                      });
                    }}
                  />
                  <div className="card-badges">
                    {showSameTimeBadge && <SameTimeBadge count={dupCount} />}
                  </div>
                </>
              ) : e.type === "video" ? (
                <>
                  <ThumbImage
                    src={`/api/thumb?path=${encodeURIComponent(e.relativePath)}`}
                    alt={e.name}
                  />
                  <ExifPrefetch path={e.relativePath} />
                  <DateKeyPrefetch
                    path={e.relativePath}
                    onResolved={(dk) => {
                      setDateKeyMap((prev) => {
                        if (prev[key] === dk) return prev;
                        return { ...prev, [key]: dk };
                      });
                    }}
                  />
                  <div className="card-badges">
                    {showSameTimeBadge && <SameTimeBadge count={dupCount} />}
                    <VideoBadge entry={e} />
                  </div>
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
                entryKey={key}
                className={cardClasses}
                title={e.name}
                name={e.name}
                isChecked={isChecked}
                draggable={true}
                onDragStart={(ev) => onCardDragStart(ev, key)}
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
        onPrev={() => setSelectedIndex((i) => Math.max(0, i - 1))}
        onNext={() => setSelectedIndex((i) => Math.min(entries.length - 1, i + 1))}
      />

      <ConflictModal
        open={conflictState.open}
        item={conflictState.item}
        dest={conflictState.dest}
        existingName={conflictState.existingName}
        onResolve={(d) => {
          const r = conflictState.resolve;
          setConflictState((s) => ({ ...s, open: false, resolve: null }));
          r?.(d);
        }}
      />
    </>
  );
}
