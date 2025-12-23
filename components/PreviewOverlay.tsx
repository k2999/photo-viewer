"use client";

import { entryKeyOf, useViewer, type Entry } from "@/components/ViewerContext";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck } from "@fortawesome/free-solid-svg-icons";

export type PreviewOverlayProps = {
  isOpen: boolean;
  entry: Entry | null;
  onClose: () => void;
};

export function PreviewOverlay({
  isOpen,
  entry,
  onClose,
}: PreviewOverlayProps) {
  if (!isOpen) return null;
  if (!entry) return null;
  if (entry.type === "dir") return null;

  const { checked, toggleCheck } = useViewer();
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
      <div className="preview-content-wrapper">
        <div className="preview-content">
          {entry.type === "image" && (
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
