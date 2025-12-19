"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { DirectoryTree, type TreeNode } from "@/components/DirectoryTree";
import { ExifPanel } from "@/components/ExifPanel";
import { useViewer } from "@/components/ViewerContext";
import { pathnameToDir, dirToUrl, parentDir, normalizeDir } from "@/lib/path";

export function ViewerShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [tree, setTree] = useState<TreeNode | null>(null);

  const { selectedEntry } = useViewer();

  const currentDir = useMemo(() => pathnameToDir(pathname), [pathname]);

  useEffect(() => {
    fetch(`/api/dir-tree?path=.&depth=3`)
      .then((r) => r.json())
      .then((data) => setTree(data.tree ?? null))
      .catch(() => setTree(null));
  }, []);

  return (
    <div className="app-root">
      <aside className="sidebar">
        <div className="sidebar-title">Directory</div>

        <div className="sidebar-code">
          ROOT: <code>{process.env.NEXT_PUBLIC_ROOT_LABEL ?? "ROOT_DIR"}</code>
          <br />
          PATH: <code>{currentDir}</code>
        </div>

        <button
          className="sidebar-button"
          onClick={() => {
            if (normalizeDir(currentDir) === ".") return;
            router.push(dirToUrl(parentDir(currentDir)));
          }}
        >
          ↑ 親ディレクトリへ
        </button>

        <DirectoryTree
          tree={tree}
          currentDir={currentDir}
          onSelectDir={(p) => {
            router.push(dirToUrl(p));
          }}
        />

        {/* ここで ExifPanel を “常駐” させる */}
        <ExifPanel entry={selectedEntry} />
      </aside>

      <main className="main">{children}</main>
    </div>
  );
}
