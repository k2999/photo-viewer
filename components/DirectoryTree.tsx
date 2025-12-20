"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChevronDown,
  faChevronRight,
  faFolder,
  faFolderOpen,
} from "@fortawesome/free-solid-svg-icons";
import { normalizeDir } from "@/lib/path";

export type TreeNode = {
  name: string;
  path: string;
  children: TreeNode[];
};

type Props = {
  tree: TreeNode | null;
  currentDir: string;
  onSelectDir: (path: string) => void;
};

export function DirectoryTree({ tree, currentDir, onSelectDir }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const activeRef = useRef<HTMLDivElement | null>(null);

  const hasChildren = (n: TreeNode) => (n.children?.length ?? 0) > 0;

  const toggle = useCallback((path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  // currentDir までの「祖先パスの配列」を作る（例: ["2024", "2024/08", "2024/08/01"]）
  const ancestorPaths = useMemo(() => {
    const norm = normalizeDir(currentDir || ".");
    if (norm === ".") return [];
    const parts = norm.split("/").filter(Boolean);

    const acc: string[] = [];
    for (let i = 0; i < parts.length; i++) {
      acc.push(parts.slice(0, i + 1).join("/"));
    }
    return acc;
  }, [currentDir]);

  // 現在ディレクトリまでの祖先を「自動で展開」する（ユーザーが開いた状態は保持）
  useEffect(() => {
    if (!tree) return;
    if (ancestorPaths.length === 0) return;

    setExpanded((prev) => {
      let changed = false;
      const next = new Set(prev);
      // 祖先は常に open に寄せる（閉じることはしない）
      for (const p of ancestorPaths) {
        if (!next.has(p)) {
          next.add(p);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [tree, ancestorPaths]);

  // 現在位置が見えるようにスクロール（不要ならこの useEffect は消してOK）
  useEffect(() => {
    if (!activeRef.current) return;
    activeRef.current.scrollIntoView({ block: "nearest" });
  }, [currentDir]);

  const renderNode = (node: TreeNode) => {
    const isRoot = node.path === '.';
    const active = node.path === currentDir;
	const expandable = hasChildren(node);
	const expandedOpen = expanded.has(node.path) || isRoot;
	const open = expandable ? expandedOpen : active;
    const isAncestor = ancestorPaths.includes(node.path);

    return (
      <li key={node.path} className="tree-item">
        <div
          ref={active ? activeRef : null}
          className={[
            "tree-row",
            active ? "is-active" : "",
            isAncestor ? "is-ancestor" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {expandable ? (
            <button
              type="button"
              className="tree-toggle"
              onClick={() => toggle(node.path)}
              aria-label={expandedOpen ? "collapse" : "expand"}
            >
              <FontAwesomeIcon icon={expandedOpen ? faChevronDown : faChevronRight} />
            </button>
          ) : (
            <span className="tree-toggle tree-toggle-spacer" />
          )}

          <button
            type="button"
            className="tree-label"
            onClick={() => onSelectDir(node.path)}
            title={node.path}
          >
            <FontAwesomeIcon
              className="tree-icon"
              icon={open ? faFolderOpen : faFolder}
            />
            <span className="tree-name">{node.name}</span>
          </button>
        </div>

        {expandable && expandedOpen && (
          <ul className="tree-children">
            {node.children.map((c) => renderNode(c))}
          </ul>
        )}
      </li>
    );
  };

  if (!tree) return null;

  return (
    <div className="tree-root">
      <ul className="tree-list">{renderNode(tree)}</ul>
    </div>
  );
}
