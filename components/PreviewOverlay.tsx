"use client";

import type { Entry } from "@/components/ViewerContext";

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

  return (
    <div className="preview-backdrop">
      <div className="preview-backdrop-click" onClick={onClose} />
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
              autoPlay
            />
          )}
        </div>
        <div className="preview-label">{entry.name}</div>
      </div>
    </div>
  );
}
