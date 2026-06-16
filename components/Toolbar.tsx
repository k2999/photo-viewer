"use client";

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
      <button className="toolbar-button" onClick={onBulkDelete}>
        削除
      </button>
      <button
        className="toolbar-button"
        onClick={onSelectBurst}
        title="フォーカス中の写真と、撮影時刻が1秒以内で連鎖する前後の写真をまとめて選択"
      >
        バースト選択
      </button>
      <button
        className="toolbar-button"
        onClick={onRefreshExifCache}
        disabled={checkedCount === 0 || exifRefreshBusy}
        title="選択中のファイルやフォルダ配下のEXIFキャッシュを強制更新"
      >
        {exifRefreshBusy ? "EXIF更新中" : "EXIF更新"}
      </button>
      <div className="toolbar-segmented" aria-label="表示モード">
        <button
          type="button"
          className="toolbar-segment"
          data-active={viewMode === "grid" ? "true" : "false"}
          onClick={() => onViewModeChange("grid")}
        >
          一覧
        </button>
        {!canUseCalendar && (
          <button
            type="button"
            className="toolbar-segment"
            data-active={viewMode === "timeline" ? "true" : "false"}
            onClick={() => onViewModeChange("timeline")}
          >
            タイムライン
          </button>
        )}
        {canUseCalendar && (
          <button
            type="button"
            className="toolbar-segment"
            data-active={viewMode === "calendar" ? "true" : "false"}
            onClick={() => onViewModeChange("calendar")}
          >
            カレンダー
          </button>
        )}
      </div>
      <label
        style={{
          marginLeft: 12,
          fontSize: 11,
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        サイズ
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
      <div className="toolbar-spacer">hjkl:移動 / Space:チェック / Enter:開く / b:バースト選択</div>
    </div>
  );
}
