export type YearMonthFolder = {
  kind: "yearMonth";
  year: number;
  month: number;
};

export type YearMonthDayFolder = {
  kind: "yearMonthDay";
  year: number;
  month: number;
  day: number;
  dateKey: string;
  filenamePrefix: string;
};

export type DateFolderInfo = YearMonthFolder | YearMonthDayFolder | null;

export type CalendarDay = {
  year: number;
  month: number;
  day: number;
  dateKey: string;
  weekday: number;
};

function normalizeDirPath(path: string) {
  return path.replace(/^\/+/, "").replace(/\/+$/, "");
}

function isRealDate(year: number, month: number, day: number) {
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export function formatDateKey(year: number, month: number, day: number) {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

export function parseDateFolder(path: string): DateFolderInfo {
  const normalized = normalizeDirPath(path);
  const yearMonth = normalized.match(/^(\d{4})\/(\d{2})$/);
  if (yearMonth) {
    const year = Number(yearMonth[1]);
    const month = Number(yearMonth[2]);
    if (isRealDate(year, month, 1)) return { kind: "yearMonth", year, month };
    return null;
  }

  const yearMonthDay = normalized.match(/^(\d{4})\/(\d{2})\/(\d{2})$/);
  if (yearMonthDay) {
    const year = Number(yearMonthDay[1]);
    const month = Number(yearMonthDay[2]);
    const day = Number(yearMonthDay[3]);
    if (!isRealDate(year, month, day)) return null;
    return {
      kind: "yearMonthDay",
      year,
      month,
      day,
      dateKey: formatDateKey(year, month, day),
      filenamePrefix: `${year}${pad2(month)}${pad2(day)}-`,
    };
  }

  return null;
}

export function parseDayFolderName(name: string, year: number, month: number) {
  if (!/^\d{2}$/.test(name)) return null;
  const day = Number(name);
  if (!isRealDate(year, month, day)) return null;
  return {
    day,
    dateKey: formatDateKey(year, month, day),
  };
}

export function getCalendarDays(year: number, month: number): CalendarDay[] {
  const lastDay = new Date(year, month, 0).getDate();
  return Array.from({ length: lastDay }, (_, index) => {
    const day = index + 1;
    const date = new Date(year, month - 1, day);
    return {
      year,
      month,
      day,
      dateKey: formatDateKey(year, month, day),
      weekday: date.getDay(),
    };
  });
}

export function dateKeyOfExifDateKey(value: string | null | undefined) {
  const m = value?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}
