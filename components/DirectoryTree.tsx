"use client";

import React, { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
  faChevronDown,
  faChevronRight,
  faFolder,
  faFolderOpen,
  faPencil,
} from "@fortawesome/free-solid-svg-icons";
import {
  faFolderArrowDown,
  faFolderArrowLeft,
  faFolderArrowRight,
  faFolderArrowUp,
  faFolderBookmark,
  faFolderCheck,
  faFolderGear,
  faFolderGrid,
  faFolderHeart,
  faFolderImage,
  faFolderMagnifyingGlass,
  faFolderMinus,
  faFolderMusic,
  faFolderPlus,
  faFolderUser,
  faFolderXmark,
} from "@fortawesome/pro-solid-svg-icons";
import { normalizeDir } from "@/lib/path";
import { ancestorPathsOf, hasChildren } from "@/lib/tree";
import { FolderDecorationModal } from "@/components/FolderDecorationModal";
import type {
  FolderDecoration,
  FolderIconKind,
} from "@/lib/folderDecorationsTypes";

export type TreeNode = {
  name: string;
  path: string;
  children: TreeNode[];
};

type Props = {
  tree: TreeNode | null;
  currentDir: string;
  isFocused: boolean;
  secondaryDir: string | null;

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
  onOpenSecondaryDir: (path: string) => void;
  getDecoration?: (path: string) => FolderDecoration | null;
  onEditDecoration?: (path: string, decoration: FolderDecoration | null) => Promise<boolean>;
};

const decorationIconMap: Record<FolderIconKind, IconDefinition> = {
  "folder-arrow-down": faFolderArrowDown,
  "folder-arrow-left": faFolderArrowLeft,
  "folder-arrow-right": faFolderArrowRight,
  "folder-arrow-up": faFolderArrowUp,
  "folder-bookmark": faFolderBookmark,
  "folder-check": faFolderCheck,
  "folder-gear": faFolderGear,
  "folder-grid": faFolderGrid,
  "folder-heart": faFolderHeart,
  "folder-image": faFolderImage,
  "folder-magnifying-glass": faFolderMagnifyingGlass,
  "folder-minus": faFolderMinus,
  "folder-music": faFolderMusic,
  "folder-plus": faFolderPlus,
  "folder-user": faFolderUser,
  "folder-xmark": faFolderXmark,
};

export function DirectoryTree(props: Props) {
  const {
    tree,
    currentDir,
    isFocused,
    secondaryDir,
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
    onOpenSecondaryDir,
    getDecoration,
    onEditDecoration,
  } = props;

  const [editingPath, setEditingPath] = useState<string | null>(null);

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
    const isSecondary = !!secondaryDir && normalizeDir(secondaryDir) === p;
    const decoration = getDecoration?.(p);
    const colorToUse = decoration?.color ?? undefined;
    const iconToUse = decoration?.icon
      ? decorationIconMap[decoration.icon]
      : open
      ? faFolderOpen
      : faFolder;

    return (
      <li key={p} className="tree-item">
        <div
          ref={active ? activeRef : isCursor ? cursorRef : null}
          className={[
            "tree-row",
            active ? "is-active" : "",
            isAncestor ? "is-ancestor" : "",
            isCursor ? "is-cursor" : "",
            isSecondary ? "is-secondary" : "",
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
              tabIndex={-1}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => toggleExpanded(p)}
              aria-label={expandedOpen ? "フォルダを折り畳む" : "フォルダを展開"}
              title={expandedOpen ? "フォルダを折り畳む" : "フォルダを展開"}
            >
              <FontAwesomeIcon icon={expandedOpen ? faChevronDown : faChevronRight} />
            </button>
          ) : (
            <span className="tree-toggle tree-toggle-spacer" />
          )}

          <button
            type="button"
            className="tree-label"
            tabIndex={-1}
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => {
              if (e.shiftKey) onOpenSecondaryDir(p);
              else onSelectDir(p);
            }}
            title={p}
          >
            <FontAwesomeIcon
              className="tree-icon"
              icon={iconToUse}
              style={colorToUse ? { color: colorToUse } : undefined}
            />
            <span
              className="tree-name"
              style={colorToUse ? { color: colorToUse } : undefined}
            >
              {node.name}
            </span>
          </button>

          {onEditDecoration && (
            <button
              type="button"
              className="tree-edit"
              tabIndex={-1}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setEditingPath(p)}
              aria-label="装飾を編集"
              title="フォルダの色やアイコンを変更"
            >
              <FontAwesomeIcon icon={faPencil} />
            </button>
          )}

          <button
            type="button"
            className="tree-secondary"
            tabIndex={-1}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onOpenSecondaryDir(p)}
            aria-label="右ペインで開く"
            title="右ペインで開く"
          >
            <FontAwesomeIcon icon={faFolderArrowRight} />
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
    <>
      <div className={["tree-root", isFocused ? "is-focused" : ""].join(" ")}>
        <ul className="tree-list">{renderNode(tree)}</ul>
      </div>

      {editingPath && onEditDecoration && (
        <FolderDecorationModal
          open={true}
          folderPath={editingPath}
          currentDecoration={getDecoration?.(editingPath) ?? null}
          onSave={async (deco) => {
            const success = await onEditDecoration(editingPath, deco);
            return success;
          }}
          onCancel={() => setEditingPath(null)}
        />
      )}
    </>
  );
}
