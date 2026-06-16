"use client";

import { useRef } from "react";
import {
  TIMELINE_SLOT_MINUTES_OPTIONS,
  type TimelineSlotMinutes,
} from "@/components/ViewerContext";

const SLOT_WHEEL_THRESHOLD = 90;

export type TimelineToolbarProps = {
  slotMinutes: TimelineSlotMinutes;
  onSlotMinutesChange: (minutes: TimelineSlotMinutes) => void;
  trimEmptyHours: boolean;
  onTrimEmptyHoursChange: (trim: boolean) => void;
  collapseEmptyHourGaps: boolean;
  onCollapseEmptyHourGapsChange: (collapse: boolean) => void;
};

export function TimelineToolbar({
  slotMinutes,
  onSlotMinutesChange,
  trimEmptyHours,
  onTrimEmptyHoursChange,
  collapseEmptyHourGaps,
  onCollapseEmptyHourGapsChange,
}: TimelineToolbarProps) {
  const slotWheelDeltaRef = useRef(0);

  const stepTimelineSlot = (delta: 1 | -1) => {
    const currentIndex = TIMELINE_SLOT_MINUTES_OPTIONS.indexOf(slotMinutes);
    const nextIndex = Math.min(
      TIMELINE_SLOT_MINUTES_OPTIONS.length - 1,
      Math.max(0, currentIndex + delta)
    );
    onSlotMinutesChange(TIMELINE_SLOT_MINUTES_OPTIONS[nextIndex]);
  };

  return (
    <div className="sub-toolbar">
      <span className="sub-toolbar-title">タイムライン</span>
      <label className="toolbar-select-label" title="タイムラインの1スロットの時間">
        間隔
        <select
          className="toolbar-select"
          value={slotMinutes}
          onChange={(e) => onSlotMinutesChange(Number(e.target.value) as TimelineSlotMinutes)}
          onWheel={(e) => {
            if (!e.altKey) return;
            e.preventDefault();
            slotWheelDeltaRef.current += e.deltaY;
            if (Math.abs(slotWheelDeltaRef.current) < SLOT_WHEEL_THRESHOLD) return;
            stepTimelineSlot(slotWheelDeltaRef.current > 0 ? 1 : -1);
            slotWheelDeltaRef.current = 0;
          }}
        >
          {TIMELINE_SLOT_MINUTES_OPTIONS.map((minutes) => (
            <option key={minutes} value={minutes}>
              {minutes === 60 ? "1時間" : `${minutes}分`}
            </option>
          ))}
        </select>
      </label>
      <label
        className="toolbar-check"
        title="一日の最初と最後にある、写真がない1時間帯を表示しない"
      >
        <input
          type="checkbox"
          checked={trimEmptyHours}
          onChange={(e) => onTrimEmptyHoursChange(e.target.checked)}
        />
        前後の空き時間を詰める
      </label>
      <label
        className="toolbar-check"
        title="撮影がある時間帯の間にある、写真がない1時間帯を表示しない"
      >
        <input
          type="checkbox"
          checked={collapseEmptyHourGaps}
          onChange={(e) => onCollapseEmptyHourGapsChange(e.target.checked)}
        />
        間の空き時間を詰める
      </label>
      <span className="sub-toolbar-hint">Option + ホイールで間隔変更</span>
    </div>
  );
}
