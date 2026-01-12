"use client";

import { entryKeyOf, useViewer, type Entry } from "@/components/ViewerContext";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck, faChevronLeft, faChevronRight } from "@fortawesome/free-solid-svg-icons";

export type PreviewOverlayProps = {
  isOpen: boolean;
  entry: Entry | null;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
};

export function PreviewOverlay({
  isOpen,
  entry,
  onClose,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
}: PreviewOverlayProps) {
  const { checked, toggleCheck } = useViewer();

  if (!isOpen) return null;
  if (!entry) return null;
  if (entry.type === "dir") return null;
  const key = entryKeyOf(entry);
  const isChecked = checked.has(key);

  return (
    <div className="preview-backdrop">
      <div className="preview-backdrop-click" onClick={onClose} />
      <div className="preview-header">
        <div className="card-check">
          <label
            className="card-check-label"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              className="card-check-input"
              type="checkbox"
              checked={isChecked}
              onChange={(e) => {
                e.stopPropagation();
                toggleCheck(key);
              }}
            />
            <span
              className={[
                "card-check-box",
                isChecked ? "is-checked" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              aria-hidden="true"
            >
              {isChecked && (
                <FontAwesomeIcon
                  icon={faCheck}
                  className="card-check-icon"
                />
              )}
            </span>
          </label>
        </div>
        <div className="preview-title" title={entry.name}>
          {entry.name}
        </div>
      </div>
      <button
        type="button"
        className="preview-nav-zone preview-nav-zone-left"
        onClick={(e) => {
          e.stopPropagation();
          if (hasPrev) onPrev();
        }}
        disabled={!hasPrev}
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
        disabled={!hasNext}
        aria-label="Next"
        title="Next"
      >
        <span className="preview-nav-icon">
          <FontAwesomeIcon icon={faChevronRight} />
        </span>
      </button>
      <div className="preview-content-wrapper">
        <div className="preview-content">
          {entry.type === "image" && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={`/api/file?path=${encodeURIComponent(entry.relativePath)}`}
              alt={entry.name}
            />
          )}
          {entry.type === "video" && (
            <video
              src={`/api/file?path=${encodeURIComponent(entry.relativePath)}`}
              controls
              preload="metadata"
              autoPlay
            />
          )}
        </div>
      </div>
    </div>
  );
}
