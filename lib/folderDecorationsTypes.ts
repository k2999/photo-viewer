export const FOLDER_ICON_KINDS = [
  "folder-arrow-down",
  "folder-arrow-left",
  "folder-arrow-right",
  "folder-arrow-up",
  "folder-bookmark",
  "folder-check",
  "folder-gear",
  "folder-grid",
  "folder-heart",
  "folder-image",
  "folder-magnifying-glass",
  "folder-minus",
  "folder-music",
  "folder-plus",
  "folder-user",
  "folder-xmark",
] as const;

export type FolderIconKind = (typeof FOLDER_ICON_KINDS)[number];

export type FolderDecoration = {
  /** CSS color string (intended for hex like "#ff0000") */
  color?: string;
  icon?: FolderIconKind;
};

export type FolderDecorationsMap = Record<string, FolderDecoration>;
