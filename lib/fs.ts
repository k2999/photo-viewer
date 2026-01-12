import fs from "fs/promises";
import path from "path";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set. Please configure it in .env.local`);
  }
  return value;
}

const ROOT_DIR = requireEnv("ROOT_DIR");

export type FsEntry = {
  name: string;
  relativePath: string;
  type: "dir" | "image" | "video" | "other";
};

const imageExt = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".heic"];
const videoExt = [".mp4", ".mov", ".avi", ".mkv"];

export function resolveSafePath(relativePath: string = ".") {
  const safeRelative = relativePath.replace(/^\/+/, "");
  const abs = path.join(ROOT_DIR, safeRelative);
  const normalized = path.normalize(abs);
  const rootNormalized = path.normalize(ROOT_DIR);

  if (!normalized.startsWith(rootNormalized)) {
    throw new Error("Invalid path");
  }

  return { abs: normalized, relative: safeRelative };
}

export async function listDir(relativePath: string = "."): Promise<FsEntry[]> {
  const { abs, relative } = resolveSafePath(relativePath);
  const entries = await fs.readdir(abs, { withFileTypes: true });

  return entries
    .filter((e) => !e.name.startsWith("."))
    .map((e) => {
      const rel = path.join(relative, e.name);
      if (e.isDirectory()) {
        return { name: e.name, relativePath: rel, type: "dir" as const };
      }
      const ext = path.extname(e.name).toLowerCase();
      if (imageExt.includes(ext)) {
        return { name: e.name, relativePath: rel, type: "image" as const };
      }
      if (videoExt.includes(ext)) {
        return { name: e.name, relativePath: rel, type: "video" as const };
      }
      return { name: e.name, relativePath: rel, type: "other" as const };
    });
}
