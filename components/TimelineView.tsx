"use client";

import { useRef, useState } from "react";
import type { CSSProperties, ReactNode, RefObject } from "react";
import {
  TIMELINE_SLOT_MINUTES_OPTIONS,
  type Entry,
  type TimelineSlotMinutes,
} from "@/components/ViewerContext";

type TimelineViewProps = {
  entries: Entry[];
  dateKeyMap: Record<string, string | null>;
  gridRef: RefObject<HTMLDivElement>;
  trimEmptyHours: boolean;
  collapseEmptyHourGaps: boolean;
  slotMinutes: TimelineSlotMinutes;
  onSlotMinutesChange: (minutes: TimelineSlotMinutes) => void;
  renderEntryCard: (idx: number) => ReactNode;
};

type TimedItem = {
  idx: number;
  minutes: number;
};

type DayGroup = {
  day: string;
  slots: TimedItem[][];
  hourCounts: number[];
};

const PREVIEW_SLOTS = 3;
const SLOT_WHEEL_THRESHOLD = 90;

function parseDateKey(dateKey: string | null | undefined) {
  if (!dateKey) return null;
  const m = dateKey.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return null;

  const [, year, month, day, hour, minute] = m;
  const h = Number(hour);
  const mi = Number(minute);
  if (!Number.isFinite(h) || !Number.isFinite(mi)) return null;
  if (h < 0 || h > 23 || mi < 0 || mi > 59) return null;

  return {
    day: `${year}-${month}-${day}`,
    hour: h,
    minutes: h * 60 + mi,
  };
}

function formatDayLabel(day: string) {
  const [year, month, date] = day.split("-");
  return `${year}/${month}/${date}`;
}

function formatHourLabel(hour: number) {
  return `${String(hour).padStart(2, "0")}:00`;
}

function formatMinutesOfDay(minutes: number) {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function formatSlotLabel(slotIndex: number, slotMinutes: number) {
  const start = slotIndex * slotMinutes;
  if (slotMinutes === 60) return formatHourLabel(start / 60);
  return `${formatMinutesOfDay(start)}-${formatMinutesOfDay(Math.min(1440, start + slotMinutes))}`;
}

function slotWidthFor(minutes: TimelineSlotMinutes) {
  if (minutes >= 60) return 48;
  if (minutes >= 30) return 44;
  if (minutes >= 10) return 38;
  if (minutes >= 5) return 32;
  return 28;
}

function shouldShowSlotLabel(slotIndex: number, slotMinutes: TimelineSlotMinutes, compressedHours: boolean) {
  const start = slotIndex * slotMinutes;
  if (compressedHours) return start % 60 === 0;
  if (slotMinutes === 60) return start % 180 === 0;
  return start % 60 === 0;
}

function stepSlotMinutes(current: TimelineSlotMinutes, delta: 1 | -1) {
  const index = TIMELINE_SLOT_MINUTES_OPTIONS.indexOf(current);
  const nextIndex = Math.min(
    TIMELINE_SLOT_MINUTES_OPTIONS.length - 1,
    Math.max(0, index + delta)
  );
  return TIMELINE_SLOT_MINUTES_OPTIONS[nextIndex];
}

function thumbSrcFor(entry: Entry | undefined) {
  if (!entry) return null;
  if (entry.type !== "image" && entry.type !== "video") return null;
  return `/api/thumb?path=${encodeURIComponent(entry.relativePath)}`;
}

export function TimelineView({
  entries,
  dateKeyMap,
  gridRef,
  trimEmptyHours,
  collapseEmptyHourGaps,
  slotMinutes,
  onSlotMinutesChange,
  renderEntryCard,
}: TimelineViewProps) {
  const [selectedClusterKey, setSelectedClusterKey] = useState<string | null>(null);
  const slotWheelDeltaRef = useRef(0);

  const groups = new Map<string, DayGroup>();
  const undated: number[] = [];
  const nonMedia: number[] = [];
  const slotCount = 1440 / slotMinutes;

  entries.forEach((entry, idx) => {
    if (entry.type !== "image" && entry.type !== "video") {
      nonMedia.push(idx);
      return;
    }

    const parsed = parseDateKey(dateKeyMap[entry.relativePath]);
    if (!parsed) {
      undated.push(idx);
      return;
    }

    const group =
      groups.get(parsed.day) ??
      ({
        day: parsed.day,
        slots: Array.from({ length: slotCount }, () => []),
        hourCounts: Array.from({ length: 24 }, () => 0),
      } satisfies DayGroup);
    const slotIndex = Math.min(slotCount - 1, Math.floor(parsed.minutes / slotMinutes));
    group.slots[slotIndex].push({ idx, minutes: parsed.minutes });
    group.hourCounts[parsed.hour] += 1;
    groups.set(parsed.day, group);
  });

  const dayGroups = Array.from(groups.values()).sort((a, b) => b.day.localeCompare(a.day));
  for (const group of dayGroups) {
    for (const slot of group.slots) {
      slot.sort((a, b) => a.minutes - b.minutes);
    }
  }

  return (
    <div
      className="timeline"
      ref={gridRef}
      onWheel={(e) => {
        if (!e.altKey) return;
        e.preventDefault();
        slotWheelDeltaRef.current += e.deltaY;
        if (Math.abs(slotWheelDeltaRef.current) < SLOT_WHEEL_THRESHOLD) return;
        onSlotMinutesChange(stepSlotMinutes(slotMinutes, slotWheelDeltaRef.current > 0 ? 1 : -1));
        slotWheelDeltaRef.current = 0;
      }}
    >
      {dayGroups.map((group) => (
        (() => {
          const firstOccupiedHour = group.hourCounts.findIndex((count) => count > 0);
          const lastOccupiedHour = group.hourCounts.reduce(
            (last, count, hour) => (count > 0 ? hour : last),
            -1
          );
          const compressedHours = trimEmptyHours || collapseEmptyHourGaps;
          const shouldShowHour = (hour: number) => {
            if (firstOccupiedHour < 0 || lastOccupiedHour < 0) return true;
            if (trimEmptyHours && (hour < firstOccupiedHour || hour > lastOccupiedHour)) return false;
            if (
              collapseEmptyHourGaps &&
              hour > firstOccupiedHour &&
              hour < lastOccupiedHour &&
              group.hourCounts[hour] === 0
            ) {
              return false;
            }
            return true;
          };
          const visibleSlotIndexes = group.slots
            .map((_, slotIndex) => slotIndex)
            .filter((slotIndex) => shouldShowHour(Math.floor((slotIndex * slotMinutes) / 60)));
          const selectedSlotIndex = group.slots.findIndex(
            (_, slotIndex) => selectedClusterKey === `${group.day}:${slotIndex}`
          );
          const selectedItems = selectedSlotIndex >= 0 ? group.slots[selectedSlotIndex] : [];

          return (
            <section className="timeline-day" key={group.day}>
              <div className="timeline-day-header">
                <h2>{formatDayLabel(group.day)}</h2>
                <span>{group.slots.reduce((sum, slot) => sum + slot.length, 0)} 件</span>
              </div>

              <div
                className="timeline-day-scroll"
                data-compress-empty-hours={compressedHours ? "true" : "false"}
                style={
                  {
                    ["--timeline-slot-count" as any]: String(visibleSlotIndexes.length),
                    ["--timeline-slot-w" as any]: `${slotWidthFor(slotMinutes)}px`,
                  } as CSSProperties
                }
              >
                <div className="timeline-hour-labels" aria-hidden>
                  {visibleSlotIndexes.map((slotIndex) => (
                    <span
                      key={slotIndex}
                      data-hour-boundary={(slotIndex * slotMinutes) % 60 === 0 ? "true" : "false"}
                      data-major={(slotIndex * slotMinutes) % 180 === 0 ? "true" : "false"}
                    >
                      {shouldShowSlotLabel(slotIndex, slotMinutes, compressedHours)
                        ? formatMinutesOfDay(slotIndex * slotMinutes)
                        : ""}
                    </span>
                  ))}
                </div>

                <div className="timeline-hours">
                  {visibleSlotIndexes.map((slotIndex) => {
                    const items = group.slots[slotIndex] ?? [];
                    const clusterKey = `${group.day}:${slotIndex}`;
                    const isSelected = selectedClusterKey === clusterKey;
                    const previewItems = items.slice(0, PREVIEW_SLOTS).map((item, index, stack) => ({
                      item,
                      offset: stack.length - index - 1,
                    }));

                    return (
                      <div
                        className="timeline-hour"
                        key={slotIndex}
                        data-empty={items.length === 0 ? "true" : "false"}
                        data-hour-boundary={(slotIndex * slotMinutes) % 60 === 0 ? "true" : "false"}
                        data-selected={isSelected ? "true" : "false"}
                      >
                        {items.length > 0 && (
                          <button
                            type="button"
                            className="timeline-cluster"
                            aria-pressed={isSelected}
                            aria-label={`${formatSlotLabel(slotIndex, slotMinutes)} の写真 ${items.length} 件`}
                            title={`${formatSlotLabel(slotIndex, slotMinutes)} の写真 ${items.length} 件を表示`}
                            onClick={() => {
                              setSelectedClusterKey((cur) => (cur === clusterKey ? null : clusterKey));
                            }}
                          >
                            <span className="timeline-cluster-stack" aria-hidden>
                              {previewItems.map(({ item, offset }) => {
                                const src = thumbSrcFor(entries[item.idx]);
                                return (
                                  <span
                                    className="timeline-cluster-thumb"
                                    key={entries[item.idx]?.relativePath ?? item.idx}
                                    style={
                                      {
                                        ["--slot" as any]: offset,
                                        ["--opacity" as any]: 1 - 0.1 * offset,
                                      } as CSSProperties
                                    }
                                  >
                                    {src && (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img src={src} alt="" draggable={false} />
                                    )}
                                  </span>
                                );
                              })}
                            </span>
                            {items.length >= 2 && (
                              <span className="timeline-cluster-count">{items.length}</span>
                            )}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {selectedItems.length > 0 && (
                <div className="timeline-selection">
                  <div className="timeline-selection-header">
                    <strong>{formatSlotLabel(selectedSlotIndex, slotMinutes)}</strong>
                    <span>{selectedItems.length} 件</span>
                  </div>
                  <div className="grid timeline-selection-grid">
                    {selectedItems.map((item) => (
                      <div className="timeline-item" key={entries[item.idx]?.relativePath ?? item.idx}>
                        {renderEntryCard(item.idx)}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          );
        })()
      ))}

      {undated.length > 0 && (
        <section className="timeline-day timeline-undated">
          <div className="timeline-day-header">
            <h2>日時読み込み中</h2>
            <span>{undated.length} 件</span>
          </div>
          <div className="timeline-undated-grid">
            {undated.map((idx) => (
              <div className="timeline-item" key={entries[idx]?.relativePath ?? idx}>
                {renderEntryCard(idx)}
              </div>
            ))}
          </div>
        </section>
      )}

      {nonMedia.length > 0 && (
        <section className="timeline-day timeline-undated">
          <div className="timeline-day-header">
            <h2>フォルダとその他</h2>
            <span>{nonMedia.length} 件</span>
          </div>
          <div className="timeline-undated-grid">
            {nonMedia.map((idx) => (
              <div className="timeline-item" key={entries[idx]?.relativePath ?? idx}>
                {renderEntryCard(idx)}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
