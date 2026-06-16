import { execFile } from "child_process";
import fs from "fs/promises";
import path from "path";
import { promisify } from "util";
import { ROOT_DIR, resolveSafePath } from "@/lib/fs";

const execFileAsync = promisify(execFile);

const CACHE_VERSION = 1;
const CACHE_DIR_NAME = ".photo-viewer";
const CACHE_FILE_NAME = "exif-cache.json";
const EXIFTOOL_CHUNK_SIZE = 80;

const EXIF_TAG_ARGS = [
  "-Model",
  "-LensModel",
  "-CreateDate",
  "-DateTimeOriginal",
  "-CreationDate",
  "-MediaCreateDate",
  "-TrackCreateDate",
  "-ModifyDate",
  "-FileModifyDate",
  "-ImageWidth",
  "-ImageHeight",
  "-Duration",
];

const MEDIA_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".heic",
  ".mp4",
  ".mov",
  ".avi",
  ".mkv",
]);

type ExifCacheFile = {
  version: number;
  entries: Record<string, ExifCacheEntry>;
};

type ExifCacheEntry = {
  exif: any;
  cachedAt: string;
};

export type ExifResult = {
  path: string;
  exif?: any;
  error?: string;
  cached: boolean;
};

let cache: ExifCacheFile | null = null;
let loadPromise: Promise<ExifCacheFile> | null = null;
let savePromise: Promise<void> = Promise.resolve();

function cachePath() {
  return path.join(ROOT_DIR, CACHE_DIR_NAME, CACHE_FILE_NAME);
}

function normalizeRelativePath(relativePath: string) {
  const rel = relativePath.replace(/^\/+/, "");
  return rel === "" ? "." : rel;
}

export function isExifMediaPath(relativePath: string) {
  return MEDIA_EXTENSIONS.has(path.extname(relativePath).toLowerCase());
}

async function loadCache() {
  if (cache) return cache;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    try {
      const raw = await fs.readFile(cachePath(), "utf8");
      const parsed = JSON.parse(raw) as ExifCacheFile;
      if (parsed?.version === CACHE_VERSION && parsed.entries && typeof parsed.entries === "object") {
        cache = parsed;
        return parsed;
      }
    } catch {
      // Start fresh when the cache file is missing or unreadable.
    }

    cache = { version: CACHE_VERSION, entries: {} };
    return cache;
  })();

  return loadPromise;
}

function saveCacheSoon() {
  savePromise = savePromise.then(async () => {
    if (!cache) return;
    const filePath = cachePath();
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const tmp = `${filePath}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(cache), "utf8");
    await fs.rename(tmp, filePath);
  });
  return savePromise;
}

function toRelativeFromAbs(abs: string) {
  const rel = path.relative(ROOT_DIR, abs);
  return normalizeRelativePath(rel);
}

async function collectMediaFiles(relativePath: string): Promise<string[]> {
  const { abs, relative } = resolveSafePath(relativePath);
  const stat = await fs.stat(abs);
  if (stat.isFile()) return isExifMediaPath(relative) ? [relative] : [];
  if (!stat.isDirectory()) return [];

  const found: string[] = [];
  const walk = async (dirAbs: string) => {
    const entries = await fs.readdir(dirAbs, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      const childAbs = path.join(dirAbs, entry.name);
      if (entry.isDirectory()) {
        await walk(childAbs);
        continue;
      }
      if (entry.isFile() && isExifMediaPath(entry.name)) {
        found.push(toRelativeFromAbs(childAbs));
      }
    }
  };

  await walk(abs);
  return found;
}

export async function expandExifTargets(paths: string[], recursive: boolean) {
  const seen = new Set<string>();
  for (const item of paths) {
    if (recursive) {
      for (const rel of await collectMediaFiles(item)) seen.add(rel);
      continue;
    }

    const { relative } = resolveSafePath(item);
    if (isExifMediaPath(relative)) seen.add(relative);
  }
  return Array.from(seen);
}

async function runExiftool(relativePaths: string[]) {
  const out = new Map<string, any>();
  const absToRel = new Map<string, string>();
  const args = ["-j", "-a", "-api", "QuickTimeUTC=1", ...EXIF_TAG_ARGS];

  for (const rel of relativePaths) {
    const { abs, relative } = resolveSafePath(rel);
    absToRel.set(path.normalize(abs), relative);
    args.push(abs);
  }

  try {
    const { stdout } = await execFileAsync("exiftool", args, {
      maxBuffer: 32 * 1024 * 1024,
    });
    for (const item of JSON.parse(stdout) as any[]) {
      const source = item?.SourceFile ? path.normalize(item.SourceFile) : "";
      const rel = absToRel.get(source);
      if (rel) out.set(rel, item);
    }
  } catch (e: any) {
    const stdout = typeof e?.stdout === "string" ? e.stdout : "";
    if (!stdout) throw e;
    for (const item of JSON.parse(stdout) as any[]) {
      const source = item?.SourceFile ? path.normalize(item.SourceFile) : "";
      const rel = absToRel.get(source);
      if (rel) out.set(rel, item);
    }
  }

  return out;
}

async function refreshExif(relativePaths: string[]) {
  const loaded = await loadCache();
  const now = new Date().toISOString();
  const refreshed = new Map<string, any>();

  for (let i = 0; i < relativePaths.length; i += EXIFTOOL_CHUNK_SIZE) {
    const chunk = relativePaths.slice(i, i + EXIFTOOL_CHUNK_SIZE);
    if (chunk.length === 0) continue;
    const chunkResult = await runExiftool(chunk);
    for (const rel of chunk) {
      const exif = chunkResult.get(rel);
      if (!exif) continue;
      loaded.entries[rel] = { exif, cachedAt: now };
      refreshed.set(rel, exif);
    }
  }

  await saveCacheSoon();
  return refreshed;
}

export async function getExifForPaths(
  paths: string[],
  options?: { force?: boolean; recursive?: boolean }
): Promise<ExifResult[]> {
  const force = options?.force ?? false;
  const recursive = options?.recursive ?? false;
  const targets = await expandExifTargets(paths, recursive);
  const loaded = await loadCache();
  const missing = force ? targets : targets.filter((rel) => !loaded.entries[rel]);

  if (missing.length > 0) {
    await refreshExif(missing);
  }

  return targets.map((rel) => {
    const hit = loaded.entries[rel];
    if (hit) return { path: rel, exif: hit.exif, cached: !missing.includes(rel) };
    return { path: rel, error: "exif unavailable", cached: false };
  });
}

export async function removeExifCache(paths: string[]) {
  const loaded = await loadCache();
  let changed = false;
  for (const item of paths) {
    const { relative } = resolveSafePath(item);
    const prefix = relative.endsWith("/") ? relative : `${relative}/`;
    for (const key of Object.keys(loaded.entries)) {
      if (key === relative || key.startsWith(prefix)) {
        delete loaded.entries[key];
        changed = true;
      }
    }
  }
  if (changed) await saveCacheSoon();
}

export async function moveExifCache(fromRelative: string, toRelative: string, options?: { removeDest?: boolean }) {
  const loaded = await loadCache();
  const from = normalizeRelativePath(resolveSafePath(fromRelative).relative);
  const to = normalizeRelativePath(resolveSafePath(toRelative).relative);
  const fromPrefix = from.endsWith("/") ? from : `${from}/`;
  const toPrefix = to.endsWith("/") ? to : `${to}/`;
  let changed = false;

  if (options?.removeDest) {
    for (const key of Object.keys(loaded.entries)) {
      if (key === to || key.startsWith(toPrefix)) {
        delete loaded.entries[key];
        changed = true;
      }
    }
  }

  for (const [key, value] of Object.entries({ ...loaded.entries })) {
    if (key === from) {
      delete loaded.entries[key];
      loaded.entries[to] = value;
      changed = true;
    } else if (key.startsWith(fromPrefix)) {
      delete loaded.entries[key];
      loaded.entries[`${toPrefix}${key.slice(fromPrefix.length)}`] = value;
      changed = true;
    }
  }

  if (changed) await saveCacheSoon();
}
