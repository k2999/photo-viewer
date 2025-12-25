"use client";

import { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faVideo } from "@fortawesome/free-solid-svg-icons";
import type { Entry } from "@/components/ViewerContext";
import { useExif } from "@/hooks/useExif";

function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  if (h > 0)
    return `${h}:${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  return `${m}:${String(ss).padStart(2, "0")}`;
}

// exiftool の Duration は環境により形式が揺れるため、最低限のパーサを用意
function parseDurationToSeconds(v: unknown): number | null {
  if (v == null) return null;

  // number なら秒として扱う（ms の可能性もあるが、まずは秒前提）
  if (typeof v === "number" && Number.isFinite(v)) return v;

  const str = String(v).trim();

  // 例: "0:00:12" or "00:12" or "1:02:03"
  const colon = str.match(/^(\d+):(\d{2})(?::(\d{2}))?$/);
  if (colon) {
    const a = Number(colon[1]);
    const b = Number(colon[2]);
    const c = colon[3] != null ? Number(colon[3]) : null;
    if (c == null) return a * 60 + b; // mm:ss
    return a * 3600 + b * 60 + c; // h:mm:ss
  }

  // 例: "12.34 s" / "12 s"
  const sec = str.match(/([0-9]+(?:\.[0-9]+)?)\s*s\b/i);
  if (sec) return Math.floor(Number(sec[1]));

  return null;
}

export function VideoBadge({
  entry,
  rootMargin = "600px",
}: {
  entry: Entry;
  rootMargin?: string;
}) {
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [label, setLabel] = useState<string>(""); // "0:12" など

  useEffect(() => {
    if (!el) return;
    if (enabled) return;

    const obs = new IntersectionObserver(
      (ents) => {
        for (const ent of ents) {
          if (ent.isIntersecting) {
            setEnabled(true);
            obs.disconnect();
            break;
          }
        }
      },
      { root: null, rootMargin, threshold: 0.01 }
    );

    obs.observe(el);
    return () => obs.disconnect();
  }, [el, enabled, rootMargin]);

  const { exif } = useExif(
    entry.type === "video" ? entry.relativePath : null,
    enabled && entry.type === "video"
  );

  useEffect(() => {
    if (!exif) return;
    const raw = exif?.Duration;
    const sec = parseDurationToSeconds(raw);
    if (sec != null) setLabel(formatDuration(sec));
  }, [exif]);

  // 常にアイコンは出し、Duration は取れたら表示
  return (
    <div ref={setEl} className="card-video-badge">
      <span className="video-icon">
        <FontAwesomeIcon icon={faVideo} />
      </span>
      {label && <span className="video-duration">{label}</span>}
    </div>
  );
}
