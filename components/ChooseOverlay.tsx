"use client";

import type { Entry } from "@/components/ViewerContext";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronLeft, faChevronRight } from "@fortawesome/free-solid-svg-icons";
import { useEffect, useRef } from "react";

export type ChooseOverlayProps = {
  isOpen: boolean;
  entry: Entry | null;
  onCancel: () => void;

  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;

  onMarkDelete: () => void;
  onReset: () => void;
  onConfirm: () => void;

  busy?: boolean;
  entries: Entry[];
  currentIndex: number;
  onSelectIndex: (idx: number) => void;
};

export function ChooseOverlay({
  isOpen,
  entry,
  onCancel,
  hasPrev,
  hasNext,
  onPrev,
  onNext,
  onMarkDelete,
  onReset,
  onConfirm,
  busy,
  entries,
  currentIndex,
  onSelectIndex,
}: ChooseOverlayProps) {
  const thumbsRef = useRef<HTMLDivElement>(null);
  const selectedThumbRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen || !thumbsRef.current || !selectedThumbRef.current) return;
    const container = thumbsRef.current;
    const selected = selectedThumbRef.current;
    const containerWidth = container.offsetWidth;
    const selectedLeft = selected.offsetLeft;
    const selectedWidth = selected.offsetWidth;
    container.scrollLeft = selectedLeft - containerWidth / 2 + selectedWidth / 2;
  }, [isOpen, currentIndex]);

  if (!isOpen) return null;

  const canMarkDelete = !!entry && entry.type === "image" && !busy;
  const canReset = !busy;

  return (
    <div className="preview-backdrop">
      <div className="preview-backdrop-click" onClick={onCancel} />

      <div className="preview-header">
        <div className="preview-title" title={entry?.name ?? "削除レビュー"}>
          {entry?.name ?? "削除レビュー"}
        </div>

        <div className="preview-actions">
          <button
            type="button"
            className="toolbar-button"
            onClick={onMarkDelete}
            disabled={!canMarkDelete}
            title="この画像に削除マークを付けて、表示対象から外します"
          >
            削除マーク
          </button>
          <button
            type="button"
            className="toolbar-button"
            onClick={onReset}
            disabled={!canReset}
            title="削除マークをすべて解除して、選択画像の一覧を復元します"
          >
            リセット
          </button>
          <button
            type="button"
            className="toolbar-button"
            onClick={onConfirm}
            disabled={!!busy}
            title="削除マークの付いた画像を削除します"
          >
            確定
          </button>
          <button
            type="button"
            className="toolbar-button"
            onClick={onCancel}
            disabled={!!busy}
            title="何も行わずに戻ります"
          >
            キャンセル
          </button>
        </div>
      </div>

      <button
        type="button"
        className="preview-nav-zone preview-nav-zone-left"
        onClick={(e) => {
          e.stopPropagation();
          if (hasPrev) onPrev();
        }}
        disabled={!hasPrev || !!busy}
        aria-label="Previous"
        title="Previous"
      >
        <span className="preview-nav-icon">
          <FontAwesomeIcon icon={faChevronLeft} />
        </span>
      </button>
      <button
        type="button"
        className="preview-nav-zone preview-nav-zone-right"
        onClick={(e) => {
          e.stopPropagation();
          if (hasNext) onNext();
        }}
        disabled={!hasNext || !!busy}
        aria-label="Next"
        title="Next"
      >
        <span className="preview-nav-icon">
          <FontAwesomeIcon icon={faChevronRight} />
        </span>
      </button>

      <div className="preview-content-wrapper">
        <div className="preview-content">
          {entry?.type === "image" ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={`/api/file?path=${encodeURIComponent(entry.relativePath)}`}
              alt={entry.name}
            />
          ) : (
            <div className="preview-title">表示対象がありません</div>
          )}
        </div>
      </div>

      <div className="preview-thumbs" ref={thumbsRef}>
        {entries.map((e, idx) => {
          const isSelected = idx === currentIndex;
          return (
            <div
              key={e.relativePath}
              ref={isSelected ? selectedThumbRef : null}
              className={`preview-thumb ${isSelected ? "preview-thumb-selected" : ""}`}
              onClick={(ev) => {
                ev.stopPropagation();
                onSelectIndex(idx);
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/thumb?path=${encodeURIComponent(e.relativePath)}`}
                alt={e.name}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
