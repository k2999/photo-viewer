export type PastedDateTimeParts = {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
  second: string;
};

function pad2(value: string) {
  return value.padStart(2, "0");
}

function fromCompact(value: string): PastedDateTimeParts | null {
  if (value.length !== 12 && value.length !== 14) return null;
  return {
    year: value.slice(0, 4),
    month: value.slice(4, 6),
    day: value.slice(6, 8),
    hour: value.slice(8, 10),
    minute: value.slice(10, 12),
    second: value.length === 14 ? value.slice(12, 14) : "00",
  };
}

export function parsePastedLocalDateTime(text: string): PastedDateTimeParts | null {
  const normalized = text.normalize("NFKC").trim();
  if (!normalized) return null;

  // 日時接頭辞付きファイル名: 20251231-123456-IMG_0001.JPG
  const fileNamePrefix = normalized.match(/^(\d{8})-(\d{6})(?:-|$)/);
  if (fileNamePrefix) return fromCompact(`${fileNamePrefix[1]}${fileNamePrefix[2]}`);

  // 区切りを除くと12桁/14桁になる形式。
  const compact = normalized.replace(/[\s\-\/.:_Tt年月日時分秒]/g, "");
  if (/^\d{12}(?:\d{2})?$/.test(compact)) return fromCompact(compact);

  // 年は4桁、残りは1〜2桁。5項目なら秒は00。
  const groups = normalized.match(/\d+/g) ?? [];
  if (groups.length !== 5 && groups.length !== 6) return null;
  if (!/^\d{4}$/.test(groups[0])) return null;
  if (groups.slice(1).some((value) => !/^\d{1,2}$/.test(value))) return null;

  return {
    year: groups[0],
    month: pad2(groups[1]),
    day: pad2(groups[2]),
    hour: pad2(groups[3]),
    minute: pad2(groups[4]),
    second: pad2(groups[5] ?? "0"),
  };
}
