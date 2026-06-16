"use client";

import type { CalendarWeekStart } from "@/components/ViewerContext";

export type CalendarToolbarProps = {
  weekStart: CalendarWeekStart;
  onWeekStartChange: (weekStart: CalendarWeekStart) => void;
};

export function CalendarToolbar({
  weekStart,
  onWeekStartChange,
}: CalendarToolbarProps) {
  return (
    <div className="sub-toolbar">
      <span className="sub-toolbar-title">カレンダー</span>
      <label className="toolbar-select-label" title="カレンダーの週の始まり">
        週の始まり
        <select
          className="toolbar-select"
          value={weekStart}
          onChange={(e) => onWeekStartChange(e.target.value as CalendarWeekStart)}
        >
          <option value="sunday">日曜日</option>
          <option value="monday">月曜日</option>
        </select>
      </label>
    </div>
  );
}
