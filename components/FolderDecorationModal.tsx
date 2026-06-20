"use client";

import { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
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
import {
  faEraser,
  faFloppyDisk,
  faPalette,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import type {
  FolderDecoration,
  FolderIconKind,
} from "@/lib/folderDecorationsTypes";

export type FolderDecorationModalProps = {
  open: boolean;
  folderPath: string;
  currentDecoration: FolderDecoration | null;
  onSave: (decoration: FolderDecoration | null) => Promise<boolean>;
  onCancel: () => void;
};

const iconOptions: FolderIconKind[] = [
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
];

const iconMap: Record<FolderIconKind, IconDefinition> = {
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
const colorOptions = [
  { label: "なし", value: "" },
  { label: "赤", value: "#e53e3e" },
  { label: "オレンジ", value: "#dd6b20" },
  { label: "黄", value: "#d69e2e" },
  { label: "緑", value: "#38a169" },
  { label: "青", value: "#3182ce" },
  { label: "紫", value: "#805ad5" },
  { label: "ピンク", value: "#d53f8c" },
];

export function FolderDecorationModal({
  open,
  folderPath,
  currentDecoration,
  onSave,
  onCancel,
}: FolderDecorationModalProps) {
  const [selectedIcon, setSelectedIcon] = useState<FolderIconKind | null>(null);
  const [selectedColor, setSelectedColor] = useState<string>("");
  const [customColor, setCustomColor] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setSelectedIcon(currentDecoration?.icon ?? null);
      const color = currentDecoration?.color ?? "";
      const isPreset = colorOptions.some((opt) => opt.value === color);
      if (isPreset) {
        setSelectedColor(color);
        setCustomColor("");
      } else {
        setSelectedColor("custom");
        setCustomColor(color);
      }
    }
  }, [open, currentDecoration]);

  if (!open) return null;

  const handleSave = async () => {
    setSaving(true);
    const finalColor =
      selectedColor === "custom" && customColor
        ? customColor
        : selectedColor || undefined;

    const decoration: FolderDecoration =
      !selectedIcon && !finalColor
        ? {}
        : {
            ...(selectedIcon ? { icon: selectedIcon } : {}),
            ...(finalColor ? { color: finalColor } : {}),
          };

    const success = await onSave(
      Object.keys(decoration).length === 0 ? null : decoration
    );
    setSaving(false);
    if (success) {
      onCancel();
    }
  };

  const handleClear = async () => {
    setSaving(true);
    const success = await onSave(null);
    setSaving(false);
    if (success) {
      onCancel();
    }
  };

  const folderName = folderPath === "." ? "ROOT" : folderPath.split("/").pop() ?? folderPath;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onClick={onCancel}
    >
      <div
        style={{
          width: "min(480px, 100%)",
          background: "#fff",
          borderRadius: 10,
          padding: 16,
          boxShadow: "0 12px 40px rgba(0,0,0,0.25)",
          fontSize: 13,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontWeight: 700, marginBottom: 12, fontSize: 15 }}>
          フォルダの装飾
        </div>

        <div style={{ fontSize: 12, color: "#555", marginBottom: 16 }}>
          <code>{folderName}</code>
        </div>

        {/* Icon selector */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 12 }}>
            アイコン:
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {iconOptions.map((icon) => (
              <button
                key={icon}
                type="button"
                className="toolbar-button"
                style={{
                  width: 48,
                  height: 48,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 20,
                  border:
                    selectedIcon === icon
                      ? "2px solid #2563eb"
                      : "1px solid #ccc",
                  background:
                    selectedIcon === icon ? "#e0f2fe" : "#fff",
                }}
                onClick={() =>
                  setSelectedIcon((prev) => (prev === icon ? null : icon))
                }
                disabled={saving}
                aria-label={`アイコンを選択: ${icon}`}
                title={`アイコンを選択: ${icon}`}
              >
                <FontAwesomeIcon icon={iconMap[icon]} />
              </button>
            ))}
          </div>
        </div>

        {/* Color selector */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 12 }}>
            色:
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
            {colorOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className="toolbar-button"
                style={{
                  width: opt.value ? 48 : "auto",
                  height: 36,
                  background: opt.value || "#fff",
                  border:
                    selectedColor === opt.value
                      ? "2px solid #2563eb"
                      : "1px solid #ccc",
                  color: opt.value ? "#fff" : "inherit",
                  fontWeight: selectedColor === opt.value ? 700 : 400,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 11,
                  padding: opt.value ? 0 : "4px 8px",
                }}
                onClick={() => setSelectedColor(opt.value)}
                disabled={saving}
                aria-label={`色を選択: ${opt.label}`}
                title={`色を選択: ${opt.label}`}
              >
                {!opt.value ? <FontAwesomeIcon icon={faXmark} /> : ""}
              </button>
            ))}
            <button
              type="button"
              className="toolbar-button"
              style={{
                height: 36,
                border:
                  selectedColor === "custom"
                    ? "2px solid #2563eb"
                    : "1px solid #ccc",
                fontWeight: selectedColor === "custom" ? 700 : 400,
                fontSize: 11,
              }}
              onClick={() => setSelectedColor("custom")}
              disabled={saving}
              aria-label="カスタム色を選択"
              title="カスタム色を選択"
            >
              <FontAwesomeIcon icon={faPalette} />
            </button>
          </div>

          {selectedColor === "custom" && (
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="text"
                placeholder="#ff0000"
                value={customColor}
                onChange={(e) => setCustomColor(e.target.value)}
                disabled={saving}
                style={{
                  flex: 1,
                  padding: "6px 8px",
                  border: "1px solid #ccc",
                  borderRadius: 4,
                  fontSize: 12,
                }}
              />
              {customColor && (
                <div
                  style={{
                    width: 32,
                    height: 32,
                    background: customColor,
                    border: "1px solid #ccc",
                    borderRadius: 4,
                  }}
                />
              )}
            </div>
          )}
        </div>

        {/* Preview */}
        {(selectedIcon || selectedColor) && (
          <div
            style={{
              padding: 12,
              background: "#f9fafb",
              borderRadius: 6,
              marginBottom: 16,
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 6 }}>
              プレビュー:
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {selectedIcon && (
                <FontAwesomeIcon
                  icon={iconMap[selectedIcon]}
                  style={{
                    fontSize: 18,
                    color:
                      selectedColor === "custom"
                        ? customColor || "currentColor"
                        : selectedColor || "currentColor",
                  }}
                />
              )}
              <span
                style={{
                  fontSize: 13,
                  color:
                    selectedColor === "custom"
                      ? customColor || "currentColor"
                      : selectedColor || "currentColor",
                }}
              >
                {folderName}
              </span>
            </div>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            type="button"
            className="toolbar-button"
            onClick={onCancel}
            disabled={saving}
            aria-label="装飾編集をキャンセル"
            title="装飾編集をキャンセル"
          >
            <FontAwesomeIcon icon={faXmark} />
          </button>
          {currentDecoration && (
            <button
              type="button"
              className="toolbar-button"
              onClick={handleClear}
              disabled={saving}
              aria-label="装飾をクリア"
              title="装飾をクリア"
            >
              <FontAwesomeIcon icon={faEraser} />
            </button>
          )}
          <button
            type="button"
            className="toolbar-button"
            onClick={handleSave}
            disabled={saving}
            aria-label={saving ? "装飾を保存中" : "装飾を保存"}
            title={saving ? "装飾を保存中" : "装飾を保存"}
            style={{
              background: "#2563eb",
              color: "#fff",
              borderColor: "#2563eb",
            }}
          >
            <FontAwesomeIcon icon={faFloppyDisk} />
          </button>
        </div>
      </div>
    </div>
  );
}
