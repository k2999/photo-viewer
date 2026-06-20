"use client";

import { useCallback, useEffect, useRef } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowRight, faFile } from "@fortawesome/free-solid-svg-icons";
import { useGridController } from "@/hooks/useGridController";
import { DirectoryThumbnail } from "@/components/DirectoryThumbnail";
import { EntryCard } from "@/components/EntryCard";
import { PreviewOverlay } from "@/components/PreviewOverlay";
import { ChooseOverlay } from "@/components/ChooseOverlay";
import { Toolbar } from "@/components/Toolbar";
import { TimelineToolbar } from "@/components/TimelineToolbar";
import { CalendarToolbar } from "@/components/CalendarToolbar";
import { CalendarView } from "@/components/CalendarView";
import { PhotoThumbnail } from "@/components/PhotoThumbnail";
import { ExifPrefetch } from "@/components/ExifPrefetch";
import { SameTimeBadge } from "@/components/SameTimeBadge";
import { VideoBadge } from "@/components/VideoBadge";
import { InvalidDateBadge } from "@/components/InvalidDateBadge";
import { ConflictModal } from "@/components/ConflictModal";
import { entryKeyOf, useViewer } from "@/components/ViewerContext";
import { TimelineView } from "@/components/TimelineView";
import { dateKeyOfExifDateKey } from "@/lib/dateFolder";
import { normalizeDir, parentDir } from "@/lib/path";
import { hasMoveItems, readMoveItems } from "@/lib/dnd/movePayload";

function itemParentDir(item: string) {
  return normalizeDir(parentDir(item.replace(/\/$/, "")));
}

export function Grid() {
  const viewer = useViewer();
  const c = useGridController({ viewer });
  const {
    secondaryDir,
    isSecondaryPaneOpen,
    bumpSecondaryReloadSignal,
    setPrimaryPaneController,
    setPrimaryToolbar,
  } = viewer;
  const currentDirRef = useRef(c.currentDir);
  const moveItemsToDestRef = useRef(c.handleMoveItemsToDest);
  const reloadPrimaryRef = useRef(c.reload);
  const canUseCalendar = c.dateFolderInfo?.kind === "yearMonth";
  const effectiveViewMode =
    canUseCalendar && c.viewMode === "timeline"
      ? "calendar"
      : c.viewMode === "calendar" && !canUseCalendar
        ? "grid"
        : c.viewMode;

  const isInvalidDateEntry = (entry: { name: string; type: string }, key: string) => {
    if (c.dateFolderInfo?.kind !== "yearMonthDay") return false;
    if (entry.type !== "image" && entry.type !== "video") return false;
    const filenameMismatch = !entry.name.startsWith(c.dateFolderInfo.filenamePrefix);
    const hasExifDate = Object.prototype.hasOwnProperty.call(c.dateKeyMap, key);
    const exifMismatch =
      hasExifDate && dateKeyOfExifDateKey(c.dateKeyMap[key]) !== c.dateFolderInfo.dateKey;
    return filenameMismatch || exifMismatch;
  };

  // Shift+クリック範囲チェック用のアンカー（チェックボックス操作の最後の位置）
  const lastCheckAnchorRef = useRef<number | null>(null);

  useEffect(() => {
    // ディレクトリ移動で entries が変わるのでアンカーをリセット
    lastCheckAnchorRef.current = null;
  }, [c.currentDir]);

  useEffect(() => {
    currentDirRef.current = c.currentDir;
  }, [c.currentDir]);

  useEffect(() => {
    moveItemsToDestRef.current = c.handleMoveItemsToDest;
  }, [c.handleMoveItemsToDest]);

  useEffect(() => {
    reloadPrimaryRef.current = c.reload;
  }, [c.reload]);

  const moveItemsToCurrentDir = useCallback((items: string[]) => {
    const dest = currentDirRef.current;
    const movable = items.filter((item) => itemParentDir(item) !== normalizeDir(dest));
    if (movable.length === 0) return Promise.resolve([]);
    return moveItemsToDestRef.current(dest, movable);
  }, []);

  const reloadPrimary = useCallback(() => {
    reloadPrimaryRef.current();
  }, []);

  useEffect(() => {
    setPrimaryPaneController({
      moveItemsToCurrentDir,
      reload: reloadPrimary,
    });
    return () => setPrimaryPaneController(null);
  }, [moveItemsToCurrentDir, reloadPrimary, setPrimaryPaneController]);

  const moveCheckedToSecondary = useCallback(async () => {
    if (!secondaryDir) return;
    const moved = await c.handleMoveItemsToDest(secondaryDir, Array.from(c.checked));
    if (moved && moved.length > 0) {
      c.removeEntriesByRelativePath(moved);
      bumpSecondaryReloadSignal();
    }
  }, [bumpSecondaryReloadSignal, c, secondaryDir]);

  const canMoveToSecondary =
    isSecondaryPaneOpen &&
    !!secondaryDir &&
    c.checked.size > 0 &&
    normalizeDir(secondaryDir) !== normalizeDir(c.currentDir);

  useEffect(() => {
    setPrimaryToolbar(
      <Toolbar
        checkedCount={c.checked.size}
        onBulkDelete={c.handleBulkDelete}
        onSelectBurst={c.selectBurst}
        onRefreshExifCache={c.handleRefreshExifCache}
        exifRefreshBusy={c.exifRefreshBusy}
        cardWidth={c.cardWidth}
        onCardWidthChange={c.setCardWidth}
        viewMode={effectiveViewMode}
        onViewModeChange={c.setViewMode}
        canUseCalendar={canUseCalendar}
      />
    );
  }, [
    c.cardWidth,
    c.checked.size,
    c.exifRefreshBusy,
    c.handleBulkDelete,
    c.handleRefreshExifCache,
    c.selectBurst,
    c.setCardWidth,
    c.setViewMode,
    canUseCalendar,
    effectiveViewMode,
    setPrimaryToolbar,
  ]);

  return (
    <>
      {effectiveViewMode === "timeline" && (
        <TimelineToolbar
          slotMinutes={c.timelineSlotMinutes}
          onSlotMinutesChange={c.setTimelineSlotMinutes}
          trimEmptyHours={c.timelineTrimEmptyHours}
          onTrimEmptyHoursChange={c.setTimelineTrimEmptyHours}
          collapseEmptyHourGaps={c.timelineCollapseEmptyHourGaps}
          onCollapseEmptyHourGapsChange={c.setTimelineCollapseEmptyHourGaps}
        />
      )}
      {effectiveViewMode === "calendar" && (
        <CalendarToolbar
          weekStart={c.calendarWeekStart}
          onWeekStartChange={c.setCalendarWeekStart}
        />
      )}

      {isSecondaryPaneOpen && (
        <div className="pane-action-toolbar">
          <span className="pane-action-path" title={c.currentDir}>{c.currentDir}</span>
          <span className="pane-action-spacer" />
          <span className="pane-action-count">{c.checked.size} 件選択中</span>
          <button
            type="button"
            className="toolbar-button"
            onClick={moveCheckedToSecondary}
            disabled={!canMoveToSecondary}
            aria-label="選択項目を右ペインへ移動"
            title={secondaryDir ? `右ペインへ移動: ${secondaryDir}` : "ツリーから右ペインを開いてください"}
          >
            <FontAwesomeIcon icon={faArrowRight} />
          </button>
        </div>
      )}

      <div
        className="grid-container primary-grid-container"
        onDragOver={(ev) => {
          if (!hasMoveItems(ev.dataTransfer)) return;
          ev.preventDefault();
          ev.dataTransfer.dropEffect = "move";
        }}
        onDrop={(ev) => {
          const items = readMoveItems(ev.dataTransfer);
          if (!items || items.length === 0) return;
          ev.preventDefault();
          const movable = items.filter((item) => itemParentDir(item) !== normalizeDir(c.currentDir));
          if (movable.length === 0) return;
          void (async () => {
            const moved = await c.handleMoveItemsToDest(c.currentDir, movable);
            if (moved && moved.length > 0) {
              c.reload();
              bumpSecondaryReloadSignal();
            }
          })();
        }}
      >
        {effectiveViewMode === "timeline" ? (
          <TimelineView
            entries={c.entries}
            dateKeyMap={c.dateKeyMap}
            gridRef={c.gridRef}
            trimEmptyHours={c.timelineTrimEmptyHours}
            collapseEmptyHourGaps={c.timelineCollapseEmptyHourGaps}
            slotMinutes={c.timelineSlotMinutes}
            onSlotMinutesChange={c.setTimelineSlotMinutes}
            renderEntryCard={(idx) => {
              const e = c.entries[idx];
              if (!e) return null;
              const isSelected = idx === c.selectedIndex;
              const key = entryKeyOf(e);
              const isChecked = c.checked.has(key);
              const same =
                !!c.selectedDateKey && c.dateKeyMap[key] != null && c.dateKeyMap[key] === c.selectedDateKey;

              const dk = c.dateKeyMap[key];
              const dupCount = dk ? (c.dateKeyCounts[dk] ?? 0) : 0;
              const showSameTimeBadge = (e.type === "image" || e.type === "video") && dupCount >= 2;
              const showInvalidDateBadge = isInvalidDateEntry(e, key);

              const cardClasses = [
                "card",
                "timeline-card",
                isSelected ? "card-selected" : "",
                isChecked ? "card-checked" : "",
                same ? "card-same-datetime" : "",
              ]
                .filter(Boolean)
                .join(" ");

              const thumb =
                e.type === "image" ? (
                  <>
                    <PhotoThumbnail src={`/api/thumb?path=${encodeURIComponent(e.relativePath)}`} alt={e.name} />
                    <ExifPrefetch
                      path={e.relativePath}
                      onDateKeyResolved={(dk) => c.onDateKeyResolved(key, dk)}
                    />
                    <div className="card-badges">
                      {showInvalidDateBadge && <InvalidDateBadge />}
                      {showSameTimeBadge && <SameTimeBadge count={dupCount} />}
                    </div>
                  </>
                ) : e.type === "video" ? (
                  <>
                    <PhotoThumbnail src={`/api/thumb?path=${encodeURIComponent(e.relativePath)}`} alt={e.name} />
                    <ExifPrefetch
                      path={e.relativePath}
                      onDateKeyResolved={(dk) => c.onDateKeyResolved(key, dk)}
                    />
                    <div className="card-badges">
                      {showInvalidDateBadge && <InvalidDateBadge />}
                      {showSameTimeBadge && <SameTimeBadge count={dupCount} />}
                      <VideoBadge entry={e} />
                    </div>
                  </>
                ) : e.type === "dir" ? (
                  <DirectoryThumbnail
                    dirPath={e.relativePath}
                    thumbs={c.dirThumbs[e.relativePath]}
                    onNeedThumbs={c.fetchDirThumbs}
                  />
                ) : (
                  <span title="ファイル"><FontAwesomeIcon icon={faFile} /></span>
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
                  onDragStart={(ev) => c.onCardDragStart(ev, key)}
                  onClick={() => c.setSelectedIndex(idx)}
                  onDoubleClick={() => {
                    if (e.type === "dir") {
                      c.pushDir(e.relativePath);
                    } else {
                      c.setIsPreviewOpen(true);
                    }
                  }}
                  onCheckboxChange={(ev) => {
                    ev.stopPropagation();
                    const nextState = ev.target.checked;
                    const isShift = (ev.nativeEvent as MouseEvent).shiftKey;

                    if (isShift) {
                      const anchor = lastCheckAnchorRef.current ?? idx;
                      c.setRangeChecked(anchor, idx, nextState);
                    } else {
                      c.toggleCheck(key);
                    }

                    lastCheckAnchorRef.current = idx;
                  }}
                  thumb={thumb}
                />
              );
            }}
          />
        ) : effectiveViewMode === "calendar" && c.dateFolderInfo?.kind === "yearMonth" ? (
          <CalendarView
            entries={c.entries}
            year={c.dateFolderInfo.year}
            month={c.dateFolderInfo.month}
            weekStart={c.calendarWeekStart}
            gridRef={c.gridRef}
            renderEntryCard={(idx) => {
              const e = c.entries[idx];
              if (!e) return null;
              const isSelected = idx === c.selectedIndex;
              const key = entryKeyOf(e);
              const isChecked = c.checked.has(key);
              const same =
                !!c.selectedDateKey && c.dateKeyMap[key] != null && c.dateKeyMap[key] === c.selectedDateKey;

              const dk = c.dateKeyMap[key];
              const dupCount = dk ? (c.dateKeyCounts[dk] ?? 0) : 0;
              const showSameTimeBadge = (e.type === "image" || e.type === "video") && dupCount >= 2;
              const showInvalidDateBadge = isInvalidDateEntry(e, key);

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
                    <PhotoThumbnail src={`/api/thumb?path=${encodeURIComponent(e.relativePath)}`} alt={e.name} />
                    <ExifPrefetch
                      path={e.relativePath}
                      onDateKeyResolved={(dk) => c.onDateKeyResolved(key, dk)}
                    />
                    <div className="card-badges">
                      {showInvalidDateBadge && <InvalidDateBadge />}
                      {showSameTimeBadge && <SameTimeBadge count={dupCount} />}
                    </div>
                  </>
                ) : e.type === "video" ? (
                  <>
                    <PhotoThumbnail src={`/api/thumb?path=${encodeURIComponent(e.relativePath)}`} alt={e.name} />
                    <ExifPrefetch
                      path={e.relativePath}
                      onDateKeyResolved={(dk) => c.onDateKeyResolved(key, dk)}
                    />
                    <div className="card-badges">
                      {showInvalidDateBadge && <InvalidDateBadge />}
                      {showSameTimeBadge && <SameTimeBadge count={dupCount} />}
                      <VideoBadge entry={e} />
                    </div>
                  </>
                ) : e.type === "dir" ? (
                  <DirectoryThumbnail
                    dirPath={e.relativePath}
                    thumbs={c.dirThumbs[e.relativePath]}
                    onNeedThumbs={c.fetchDirThumbs}
                  />
                ) : (
                  <span title="ファイル"><FontAwesomeIcon icon={faFile} /></span>
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
                  onDragStart={(ev) => c.onCardDragStart(ev, key)}
                  onClick={() => c.setSelectedIndex(idx)}
                  onDoubleClick={() => {
                    if (e.type === "dir") {
                      c.pushDir(e.relativePath);
                    } else {
                      c.setIsPreviewOpen(true);
                    }
                  }}
                  onCheckboxChange={(ev) => {
                    ev.stopPropagation();
                    const nextState = ev.target.checked;
                    const isShift = (ev.nativeEvent as MouseEvent).shiftKey;

                    if (isShift) {
                      const anchor = lastCheckAnchorRef.current ?? idx;
                      c.setRangeChecked(anchor, idx, nextState);
                    } else {
                      c.toggleCheck(key);
                    }

                    lastCheckAnchorRef.current = idx;
                  }}
                  thumb={thumb}
                />
              );
            }}
          />
        ) : (
          <div className="grid" key={c.currentDir} ref={c.gridRef}>
            {c.entries.map((e, idx) => {
            const isSelected = idx === c.selectedIndex;
            const key = entryKeyOf(e);
            const isChecked = c.checked.has(key);
            const same =
              !!c.selectedDateKey && c.dateKeyMap[key] != null && c.dateKeyMap[key] === c.selectedDateKey;

            const dk = c.dateKeyMap[key];
            const dupCount = dk ? (c.dateKeyCounts[dk] ?? 0) : 0;
            const showSameTimeBadge = (e.type === "image" || e.type === "video") && dupCount >= 2;
            const showInvalidDateBadge = isInvalidDateEntry(e, key);

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
                  <PhotoThumbnail src={`/api/thumb?path=${encodeURIComponent(e.relativePath)}`} alt={e.name} />
                  <ExifPrefetch
                    path={e.relativePath}
                    onDateKeyResolved={(dk) => c.onDateKeyResolved(key, dk)}
                  />
                  <div className="card-badges">
                    {showInvalidDateBadge && <InvalidDateBadge />}
                    {showSameTimeBadge && <SameTimeBadge count={dupCount} />}
                  </div>
                </>
              ) : e.type === "video" ? (
                <>
                  <PhotoThumbnail src={`/api/thumb?path=${encodeURIComponent(e.relativePath)}`} alt={e.name} />
                  <ExifPrefetch
                    path={e.relativePath}
                    onDateKeyResolved={(dk) => c.onDateKeyResolved(key, dk)}
                  />
                  <div className="card-badges">
                    {showInvalidDateBadge && <InvalidDateBadge />}
                    {showSameTimeBadge && <SameTimeBadge count={dupCount} />}
                    <VideoBadge entry={e} />
                  </div>
                </>
              ) : e.type === "dir" ? (
                <DirectoryThumbnail
                  dirPath={e.relativePath}
                  thumbs={c.dirThumbs[e.relativePath]}
                  onNeedThumbs={c.fetchDirThumbs}
                />
              ) : (
                <span title="ファイル"><FontAwesomeIcon icon={faFile} /></span>
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
                onDragStart={(ev) => c.onCardDragStart(ev, key)}
                onClick={() => c.setSelectedIndex(idx)}
                onDoubleClick={() => {
                  if (e.type === "dir") {
                    c.pushDir(e.relativePath);
                  } else {
                    c.setIsPreviewOpen(true);
                  }
                }}
                onCheckboxChange={(ev) => {
                  ev.stopPropagation();
                  const nextState = ev.target.checked;
                  const isShift = (ev.nativeEvent as MouseEvent).shiftKey;

                  if (isShift) {
                    const anchor = lastCheckAnchorRef.current ?? idx;
                    c.setRangeChecked(anchor, idx, nextState);
                  } else {
                    c.toggleCheck(key);
                  }

                  lastCheckAnchorRef.current = idx;
                }}
                thumb={thumb}
              />
            );
            })}
          </div>
        )}
      </div>

      <PreviewOverlay
        isOpen={c.isPreviewOpen}
        entry={c.selectedEntry}
        onClose={() => c.setIsPreviewOpen(false)}
        hasPrev={c.selectedIndex > 0}
        hasNext={c.selectedIndex < c.entries.length - 1}
        onPrev={() => c.setSelectedIndex((i) => Math.max(0, i - 1))}
        onNext={() => c.setSelectedIndex((i) => Math.min(c.entries.length - 1, i + 1))}
      />

      <ChooseOverlay
        isOpen={c.deleteReview.open}
        entry={c.deleteReview.entry}
        onCancel={c.deleteReview.onCancel}
        hasPrev={c.deleteReview.hasPrev}
        hasNext={c.deleteReview.hasNext}
        onPrev={c.deleteReview.onPrev}
        onNext={c.deleteReview.onNext}
        onMarkDelete={c.deleteReview.onMarkDelete}
        onReset={c.deleteReview.onReset}
        onConfirm={c.deleteReview.onConfirm}
        busy={c.deleteReview.busy}
        entries={c.deleteReview.entries}
        currentIndex={c.deleteReview.currentIndex}
        onSelectIndex={c.deleteReview.onSelectIndex}
      />

      <ConflictModal
        open={c.conflictModal.open}
        item={c.conflictModal.item}
        dest={c.conflictModal.dest}
        existingName={c.conflictModal.existingName}
        onResolve={c.conflictModal.onResolve}
      />
    </>
  );
}
