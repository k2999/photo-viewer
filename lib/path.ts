// lib/path.ts

function safeDecodeURIComponent(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/** next/navigation の usePathname() の値 ("/a/b" or "/") を "a/b" or "." に変換 */
export function pathnameToDir(pathname: string | null | undefined): string {
  const p = (pathname ?? "/").replace(/^\/+|\/+$/g, "");
  if (!p.length) return ".";
  return p
    .split("/")
    .filter((seg) => seg.length > 0)
    .map((seg) => safeDecodeURIComponent(seg))
    .join("/");
}

/** useParams<{path?: string[]}> の path を "a/b" or "." に変換 */
export function paramsToDir(parts: string[] | undefined): string {
  const decoded = (parts ?? []).map((seg) => safeDecodeURIComponent(seg));
  const p = decoded.join("/");
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
