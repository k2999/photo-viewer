export function normalizeExifDateTime(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;

  const m = s.match(
    /^([0-9]{4})[:\-]([0-9]{2})[:\-]([0-9]{2})[ T]([0-9]{2}):([0-9]{2}):([0-9]{2})/
  );
  if (!m) return null;
  const [, Y, M, D, h, mi, sec] = m;
  return `${Y}-${M}-${D}T${h}:${mi}:${sec}`;
}

export function pickExifDateKey(exif: any): string | null {
  const candidates = [
    exif?.DateTimeOriginal,
    exif?.CreateDate,
    exif?.MediaCreateDate,
    exif?.TrackCreateDate,
    exif?.ModifyDate,
    exif?.FileModifyDate,
  ];
  for (const c of candidates) {
    const k = normalizeExifDateTime(c);
    if (k) return k;
  }
  return null;
}
