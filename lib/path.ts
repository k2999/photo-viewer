// lib/path.ts

/** next/navigation の usePathname() の値 ("/a/b" or "/") を "a/b" or "." に変換 */
export function pathnameToDir(pathname: string | null | undefined): string {
  const p = (pathname ?? "/").replace(/^\/+|\/+$/g, "");
  return p.length ? p : ".";
}

/** useParams<{path?: string[]}> の path を "a/b" or "." に変換 */
export function paramsToDir(parts: string[] | undefined): string {
  const p = (parts ?? []).join("/");
  return p.length ? p : ".";
}

/** "." / "" / "/a/b/" などを統一して "a/b" or "." にする */
export function normalizeDir(dir: string): string {
  const norm = (dir || "").replace(/^\/+|\/+$/g, "");
  return !norm || norm === "." ? "." : norm;
}

/** "a/b" or "." を Next.js の URL パス ("/a/b" or "/") に変換 */
export function dirToUrl(dir: string): string {
  const norm = normalizeDir(dir);
  return norm === "." ? "/" : `/${norm}`;
}

/** 親ディレクトリを返す。root は "." のまま。 */
export function parentDir(dir: string): string {
  const norm = normalizeDir(dir);
  if (norm === ".") return ".";
  const parts = norm.split("/").filter(Boolean);
  parts.pop();
  return parts.length ? parts.join("/") : ".";
}
