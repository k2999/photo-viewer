import type { Entry } from "@/components/ViewerContext";

export function entryKeyOfSelected(e: Entry | null): string | null {
  if (!e) return null;
  return e.type === "dir" ? `${e.relativePath}/` : e.relativePath;
}
