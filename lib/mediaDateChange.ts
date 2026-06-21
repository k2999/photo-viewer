import path from "path";

const LOCAL_DATE_TIME_RE =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;
const DATE_PREFIX_RE = /^\d{8}-\d{6}-/;

export type LocalDateTimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

export function parseLocalDateTime(value: unknown): {
  parts: LocalDateTimeParts;
  date: Date;
} {
  if (typeof value !== "string") throw new Error("日時を指定してください");
  const match = value.match(LOCAL_DATE_TIME_RE);
  if (!match) throw new Error("日時の形式が正しくありません");

  const [, y, mo, d, h, mi, s = "00"] = match;
  const parts: LocalDateTimeParts = {
    year: Number(y),
    month: Number(mo),
    day: Number(d),
    hour: Number(h),
    minute: Number(mi),
    second: Number(s),
  };
  const date = new Date(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
    0
  );

  if (
    date.getFullYear() !== parts.year ||
    date.getMonth() !== parts.month - 1 ||
    date.getDate() !== parts.day ||
    date.getHours() !== parts.hour ||
    date.getMinutes() !== parts.minute ||
    date.getSeconds() !== parts.second
  ) {
    throw new Error("存在しない日時です");
  }

  return { parts, date };
}

export function formatExifLocal(parts: LocalDateTimeParts) {
  return `${parts.year}:${pad2(parts.month)}:${pad2(parts.day)} ${pad2(parts.hour)}:${pad2(parts.minute)}:${pad2(parts.second)}`;
}

export function formatExifUtc(date: Date) {
  return `${date.getUTCFullYear()}:${pad2(date.getUTCMonth() + 1)}:${pad2(date.getUTCDate())} ${pad2(date.getUTCHours())}:${pad2(date.getUTCMinutes())}:${pad2(date.getUTCSeconds())}Z`;
}

export function formatLocalOffset(date: Date) {
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absolute = Math.abs(offsetMinutes);
  return `${sign}${pad2(Math.floor(absolute / 60))}:${pad2(absolute % 60)}`;
}

export function buildDatePrefix(parts: LocalDateTimeParts) {
  return `${parts.year}${pad2(parts.month)}${pad2(parts.day)}-${pad2(parts.hour)}${pad2(parts.minute)}${pad2(parts.second)}-`;
}

export function buildDatedFileName(fileName: string, parts: LocalDateTimeParts) {
  const prefix = buildDatePrefix(parts);
  return DATE_PREFIX_RE.test(fileName)
    ? fileName.replace(DATE_PREFIX_RE, prefix)
    : `${prefix}${fileName}`;
}

export function replaceBaseName(relativePath: string, baseName: string) {
  const dir = path.dirname(relativePath);
  return dir === "." ? baseName : path.join(dir, baseName);
}
