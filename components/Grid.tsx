"use client";

import { useEffect, useRef } from "react";
import { useGridController } from "@/hooks/useGridController";
import { DirectoryThumbnail } from "@/components/DirectoryThumbnail";
import { EntryCard } from "@/components/EntryCard";
import { PreviewOverlay } from "@/components/PreviewOverlay";
import { ChooseOverlay } from "@/components/ChooseOverlay";
import { Toolbar } from "@/components/Toolbar";
import { PhotoThumbnail } from "@/components/PhotoThumbnail";
import { ExifPrefetch } from "@/components/ExifPrefetch";
import { SameTimeBadge } from "@/components/SameTimeBadge";
import { VideoBadge } from "@/components/VideoBadge";
import { ConflictModal } from "@/components/ConflictModal";
import { entryKeyOf, useViewer } from "@/components/ViewerContext";

export function Grid() {
  const viewer = useViewer();
  const c = useGridController({ viewer });

  // Shift+クリック範囲チェック用のアンカー（チェックボックス操作の最後の位置）
  const lastCheckAnchorRef = useRef<number | null>(null);

  useEffect(() => {
    // ディレクトリ移動で entries が変わるのでアンカーをリセット
    lastCheckAnchorRef.current = null;
  }, [c.currentDir]);

  return (
    <>
      <Toolbar
        checkedCount={c.checked.size}
        onBulkDelete={c.handleBulkDelete}
        onMoveToMarked={async () => {
          if (!c.markedDir) return;
          const moved = await c.handleMoveItemsToDest(c.markedDir, Array.from(c.checked));
          if (moved && moved.length > 0) c.removeEntriesByRelativePath(moved);
        }}
        onSelectBurst={c.selectBurst}
        markedDir={c.markedDir}
        cardWidth={c.cardWidth}
        onCardWidthChange={c.setCardWidth}
      />

      <div className="grid-container">
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
                  <div className="card-badges">{showSameTimeBadge && <SameTimeBadge count={dupCount} />}</div>
                </>
              ) : e.type === "video" ? (
                <>
                  <PhotoThumbnail src={`/api/thumb?path=${encodeURIComponent(e.relativePath)}`} alt={e.name} />
                  <ExifPrefetch
                    path={e.relativePath}
                    onDateKeyResolved={(dk) => c.onDateKeyResolved(key, dk)}
                  />
                  <div className="card-badges">
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
