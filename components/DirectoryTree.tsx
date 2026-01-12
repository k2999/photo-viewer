"use client";

import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChevronDown,
  faChevronRight,
  faFolder,
  faFolderOpen,
  faBookmark,
} from "@fortawesome/free-solid-svg-icons";
import { normalizeDir } from "@/lib/path";
import { ancestorPathsOf, hasChildren } from "@/lib/tree";

export type TreeNode = {
  name: string;
  path: string;
  children: TreeNode[];
};

type Props = {
  tree: TreeNode | null;
  currentDir: string;
  isFocused: boolean;
  markedDir: string | null;

  expanded: Set<string>;
  focusedPath: string;
  dragOverPath: string | null;

  activeRef: React.RefObject<HTMLDivElement>;
  cursorRef: React.RefObject<HTMLDivElement>;

  setFocusedPath: (path: string) => void;
  toggleExpanded: (path: string) => void;

  isInternalMoveDnD: (dt: DataTransfer) => boolean;
  onRowDragEnter: (path: string, expandable: boolean, expandedOpen: boolean, dt: DataTransfer) => void;
  onRowDragOver: (path: string, expandable: boolean, expandedOpen: boolean, dt: DataTransfer) => void;
  onRowDragLeave: (path: string, currentTarget: HTMLElement, relatedTarget: Node | null) => void;
  onRowDrop: (path: string, dt: DataTransfer) => void;

  onSelectDir: (path: string) => void;
  onMarkDir: (path: string | null) => void;
};

export function DirectoryTree(props: Props) {
  const {
    tree,
    currentDir,
    isFocused,
    markedDir,
    expanded,
    focusedPath,
    dragOverPath,
    activeRef,
    cursorRef,
    setFocusedPath,
    toggleExpanded,
    isInternalMoveDnD,
    onRowDragEnter,
    onRowDragOver,
    onRowDragLeave,
    onRowDrop,
    onSelectDir,
    onMarkDir,
  } = props;

  const ancestorPaths = ancestorPathsOf(currentDir);

  const renderNode = (node: TreeNode) => {
    const p = normalizeDir(node.path);
    const isRoot = p === ".";
    const active = normalizeDir(currentDir) === p;
    const expandable = hasChildren(node);
    const expandedOpen = expanded.has(p) || isRoot;
    const open = expandable ? expandedOpen : active;
    const isAncestor = ancestorPaths.includes(p);
    const isCursor = normalizeDir(focusedPath) === p;
    const isMarked = !!markedDir && normalizeDir(markedDir) === p;

    return (
      <li key={p} className="tree-item">
        <div
          ref={active ? activeRef : isCursor ? cursorRef : null}
          className={[
            "tree-row",
            active ? "is-active" : "",
            isAncestor ? "is-ancestor" : "",
            isCursor ? "is-cursor" : "",
            isMarked ? "is-marked" : "",
            dragOverPath === p ? "is-dropover" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          onMouseDown={() => setFocusedPath(p)}
          onDragEnter={(ev) => {
            if (!isInternalMoveDnD(ev.dataTransfer)) return;
            onRowDragEnter(p, expandable, expandedOpen, ev.dataTransfer);
          }}
          onDragOver={(ev) => {
            if (!isInternalMoveDnD(ev.dataTransfer)) return;
            ev.preventDefault();
            ev.dataTransfer.dropEffect = "move";
            onRowDragOver(p, expandable, expandedOpen, ev.dataTransfer);
          }}
          onDragLeave={(ev) => {
            onRowDragLeave(p, ev.currentTarget, ev.relatedTarget as Node | null);
          }}
          onDrop={(ev) => {
            ev.preventDefault();
            onRowDrop(p, ev.dataTransfer);
          }}
        >
          {expandable ? (
            <button
              type="button"
              className="tree-toggle"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={() => toggleExpanded(p)}
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
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => onSelectDir(p)}
            title={p}
          >
            <FontAwesomeIcon className="tree-icon" icon={open ? faFolderOpen : faFolder} />
            <span className="tree-name">{node.name}</span>
          </button>

          <button
            type="button"
            className="tree-mark"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => onMarkDir(isMarked ? null : p)}
            aria-label={isMarked ? "unmark" : "mark as destination"}
            title={isMarked ? "移動先マーク解除" : "移動先にマーク"}
          >
            <FontAwesomeIcon icon={faBookmark} />
          </button>
        </div>

        {expandable && expandedOpen && (
          <ul className="tree-children">{node.children.map((c) => renderNode(c))}</ul>
        )}
      </li>
    );
  };

  if (!tree) return null;

  return (
    <div className={["tree-root", isFocused ? "is-focused" : ""].join(" ")}>
      <ul className="tree-list">{renderNode(tree)}</ul>
    </div>
  );
}
