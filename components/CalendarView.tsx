"use client";

import type { ReactNode, RefObject } from "react";
import type { CalendarWeekStart, Entry } from "@/components/ViewerContext";
import { getCalendarDays, parseDayFolderName } from "@/lib/dateFolder";
import { getJapaneseHolidayName } from "@/lib/japaneseHolidays";

type CalendarViewProps = {
  entries: Entry[];
  year: number;
  month: number;
  weekStart: CalendarWeekStart;
  gridRef: RefObject<HTMLDivElement>;
  renderEntryCard: (idx: number) => ReactNode;
};

const WEEKDAY_LABELS = {
  sunday: ["日", "月", "火", "水", "木", "金", "土"],
  monday: ["月", "火", "水", "木", "金", "土", "日"],
} satisfies Record<CalendarWeekStart, string[]>;

function weekdayColumn(weekday: number, weekStart: CalendarWeekStart) {
  return weekStart === "sunday" ? weekday : (weekday + 6) % 7;
}

export function CalendarView({
  entries,
  year,
  month,
  weekStart,
  gridRef,
  renderEntryCard,
}: CalendarViewProps) {
  const dayEntries = new Map<number, number[]>();
  const otherIndexes: number[] = [];

  entries.forEach((entry, idx) => {
    if (entry.type !== "dir") {
      otherIndexes.push(idx);
      return;
    }

    const parsed = parseDayFolderName(entry.name, year, month);
    if (!parsed) {
      otherIndexes.push(idx);
      return;
    }

    const current = dayEntries.get(parsed.day) ?? [];
    current.push(idx);
    dayEntries.set(parsed.day, current);
  });

  const days = getCalendarDays(year, month);
  const firstOffset = days[0] ? weekdayColumn(days[0].weekday, weekStart) : 0;

  return (
    <div className="calendar-view" ref={gridRef}>
      <section className="calendar-month">
        <div className="calendar-month-header">
          <h2>
            {year}/{String(month).padStart(2, "0")}
          </h2>
          <span>{entries.length} 件</span>
        </div>

        <div className="calendar-weekdays" aria-hidden>
          {WEEKDAY_LABELS[weekStart].map((label) => (
            <div key={label}>{label}</div>
          ))}
        </div>

        <div className="calendar-grid">
          {Array.from({ length: firstOffset }, (_, index) => (
            <div className="calendar-cell calendar-cell-empty" key={`empty-${index}`} />
          ))}
          {days.map((day) => {
            const holidayName = getJapaneseHolidayName(day.year, day.month, day.day);
            const indexes = dayEntries.get(day.day) ?? [];
            return (
              <div
                className="calendar-cell"
                key={day.dateKey}
                data-weekday={day.weekday}
                data-holiday={holidayName ? "true" : "false"}
              >
                <div className="calendar-cell-header">
                  <span className="calendar-day-number">{day.day}</span>
                  {holidayName && <span className="calendar-holiday-name">{holidayName}</span>}
                </div>
                <div className="calendar-cell-items">
                  {indexes.map((idx) => (
                    <div className="calendar-item" key={entries[idx]?.relativePath ?? idx}>
                      {renderEntryCard(idx)}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {otherIndexes.length > 0 && (
        <section className="calendar-other">
          <div className="calendar-other-header">
            <h2>その他</h2>
            <span>{otherIndexes.length} 件</span>
          </div>
          <div className="grid calendar-other-grid">
            {otherIndexes.map((idx) => (
              <div className="calendar-item" key={entries[idx]?.relativePath ?? idx}>
                {renderEntryCard(idx)}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
