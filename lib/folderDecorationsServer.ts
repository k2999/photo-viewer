import fs from "fs/promises";
import path from "path";
import { ROOT_DIR } from "@/lib/fs";
import { normalizeDir } from "@/lib/path";
import {
  FOLDER_ICON_KINDS,
  type FolderDecoration,
  type FolderDecorationsMap,
  type FolderIconKind,
} from "@/lib/folderDecorationsTypes";

type Persisted = {
  version: 1;
  decorations: FolderDecorationsMap;
};

const SETTINGS_DIR_NAME = ".photo-viewer";
const SETTINGS_FILE_NAME = "folder-decorations.json";

function settingsFilePath() {
  return path.join(ROOT_DIR, SETTINGS_DIR_NAME, SETTINGS_FILE_NAME);
}

async function readJsonIfExists(filePath: string): Promise<any | null> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch (e: any) {
    if (e?.code === "ENOENT") return null;
    throw e;
  }
}

async function writeFileAtomic(filePath: string, content: string) {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  const tmp = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  await fs.writeFile(tmp, content, "utf8");
  await fs.rename(tmp, filePath);
}

function isValidHexColor(color: string): boolean {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(color);
}

function isValidIconKind(icon: string): icon is FolderIconKind {
  return (FOLDER_ICON_KINDS as readonly string[]).includes(icon);
}

export function validateAndNormalizeDir(input: unknown): string {
  const p = normalizeDir(String(input ?? "."));
  if (p !== ".") {
    const segs = p.split("/").filter(Boolean);
    if (segs.some((s) => s === "..")) {
      throw new Error("Invalid path");
    }
  }
  return p;
}

export function validateDecoration(input: any): FolderDecoration {
  const out: FolderDecoration = {};

  if (input?.color != null) {
    const color = String(input.color);
    if (!isValidHexColor(color)) {
      throw new Error("Invalid color (use hex like #ff0000)");
    }
    out.color = color;
  }

  if (input?.icon != null) {
    const icon = String(input.icon);
    if (!isValidIconKind(icon)) {
      throw new Error("Invalid icon");
    }
    out.icon = icon;
  }

  return out;
}

export async function readFolderDecorations(): Promise<FolderDecorationsMap> {
  const file = settingsFilePath();
  const parsed = await readJsonIfExists(file);
  const decorations = (parsed?.decorations ?? {}) as FolderDecorationsMap;

  if (!decorations || typeof decorations !== "object") return {};

  // sanitize values (best-effort)
  const next: FolderDecorationsMap = {};
  for (const [k, v] of Object.entries(decorations)) {
    try {
      const dir = validateAndNormalizeDir(k);
      const deco = validateDecoration(v);
      if (Object.keys(deco).length === 0) continue;
      next[dir] = deco;
    } catch {
      // skip invalid record
    }
  }
  return next;
}

export async function setFolderDecoration(
  dirPath: string,
  decoration: FolderDecoration | null
): Promise<FolderDecorationsMap> {
  const dir = validateAndNormalizeDir(dirPath);
  const file = settingsFilePath();
  const current = await readFolderDecorations();

  const next: FolderDecorationsMap = { ...current };

  if (decoration == null || Object.keys(decoration).length === 0) {
    delete next[dir];
  } else {
    next[dir] = decoration;
  }

  const payload: Persisted = {
    version: 1,
    decorations: next,
  };

  await writeFileAtomic(file, JSON.stringify(payload, null, 2));
  return next;
}
