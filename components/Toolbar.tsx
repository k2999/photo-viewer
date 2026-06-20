"use client";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCalendarDays,
  faImages,
  faMagnifyingGlassPlus,
  faRotate,
  faTableCells,
  faTrash,
  faClock,
} from "@fortawesome/free-solid-svg-icons";

export type ToolbarProps = {
  checkedCount: number;
  onBulkDelete: () => void;
  onSelectBurst: () => void;
  onRefreshExifCache: () => void;
  exifRefreshBusy: boolean;
  cardWidth: number;
  onCardWidthChange?: (px: number) => void;
  viewMode: "grid" | "timeline" | "calendar";
  onViewModeChange: (mode: "grid" | "timeline" | "calendar") => void;
  canUseCalendar: boolean;
};

export function Toolbar({
  checkedCount,
  onBulkDelete,
  onSelectBurst,
  onRefreshExifCache,
  exifRefreshBusy,
  cardWidth,
  onCardWidthChange,
  viewMode,
  onViewModeChange,
  canUseCalendar,
}: ToolbarProps) {
  const handleCardWidthChange =
    typeof onCardWidthChange === "function" ? onCardWidthChange : () => {};

  return (
    <div className="toolbar">
      <span>{checkedCount} 件選択中</span>
      <button
        type="button"
        className="toolbar-button"
        onClick={onBulkDelete}
        aria-label="チェック項目を削除"
        title="チェック項目を削除"
      >
        <FontAwesomeIcon icon={faTrash} />
      </button>
      <button
        type="button"
        className="toolbar-button"
        onClick={onSelectBurst}
        aria-label="バースト選択"
        title="フォーカス中の写真と、撮影時刻が1秒以内で連鎖する前後の写真をまとめて選択"
      >
        <FontAwesomeIcon icon={faImages} />
      </button>
      <button
        type="button"
        className="toolbar-button"
        onClick={onRefreshExifCache}
        disabled={checkedCount === 0 || exifRefreshBusy}
        aria-label={exifRefreshBusy ? "EXIFキャッシュを更新中" : "EXIFキャッシュを強制更新"}
        title="選択中のファイルやフォルダ配下のEXIFキャッシュを強制更新"
      >
        <FontAwesomeIcon icon={faRotate} spin={exifRefreshBusy} />
      </button>
      <div className="toolbar-segmented" aria-label="表示モード">
        <button
          type="button"
          className="toolbar-segment"
          data-active={viewMode === "grid" ? "true" : "false"}
          onClick={() => onViewModeChange("grid")}
          aria-label="一覧表示"
          title="一覧表示"
        >
          <FontAwesomeIcon icon={faTableCells} />
        </button>
        {!canUseCalendar && (
          <button
            type="button"
            className="toolbar-segment"
            data-active={viewMode === "timeline" ? "true" : "false"}
            onClick={() => onViewModeChange("timeline")}
            aria-label="タイムライン表示"
            title="タイムライン表示"
          >
            <FontAwesomeIcon icon={faClock} />
          </button>
        )}
        {canUseCalendar && (
          <button
            type="button"
            className="toolbar-segment"
            data-active={viewMode === "calendar" ? "true" : "false"}
            onClick={() => onViewModeChange("calendar")}
            aria-label="カレンダー表示"
            title="カレンダー表示"
          >
            <FontAwesomeIcon icon={faCalendarDays} />
          </button>
        )}
      </div>
      <label
        title="一覧とタイムライン下のサムネイルサイズを変更"
        style={{
          marginLeft: 12,
          fontSize: 11,
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <FontAwesomeIcon icon={faMagnifyingGlassPlus} />
        <input
          type="range"
          min={100}
          max={500}
          step={10}
          value={cardWidth}
          onChange={(e) => handleCardWidthChange(Number(e.target.value))}
        />
        <span style={{ width: 44, textAlign: "right" }}>{cardWidth}px</span>
      </label>
    </div>
  );
}
