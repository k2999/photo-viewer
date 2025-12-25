"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { entryKeyOf, useViewer, useViewerNav } from "@/components/ViewerContext";
import { VideoBadge } from "@/components/VideoBadge";
import { ExifPrefetch } from "@/components/ExifPrefetch";
import { abortAllExifRequests } from "@/hooks/useExif";
import { useExif } from "@/hooks/useExif";
import { DateKeyPrefetch } from "@/components/DateKeyPrefetch";
import { SameTimeBadge } from "@/components/SameTimeBadge";

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

  // ---- Same datetime highlight ----
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [dateKeyMap, setDateKeyMap] = useState<Record<string, string | null>>({});

  // 同一フォルダ内（entriesの範囲）で dateKey の出現数を集計
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

  // page.tsx 内でも DateKey の抽出ロジックを合わせる（DateKeyPrefetch と同じ）
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

  // 選択中エントリの EXIF を取得して基準の dateKey を作る
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
            const same = !!selectedDateKey && dateKeyMap[key] != null && dateKeyMap[key] === selectedDateKey;

            const dk = dateKeyMap[key];
            const dupCount = dk ? (dateKeyCounts[dk] ?? 0) : 0;
            const showSameTimeBadge =
              (e.type === "image" || e.type === "video") && dupCount >= 2;

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
