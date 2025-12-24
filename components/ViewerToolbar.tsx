"use client";

import type { CardWidthPx } from "@/components/ViewerContext";

export type ViewerToolbarProps = {
  checkedCount: number;
  onBulkDelete: () => void;
  onBulkMove: () => void;
  cardWidth: number;
  onCardWidthChange?: (px: number) => void;
};

export function ViewerToolbar({
  checkedCount,
  onBulkDelete,
  onBulkMove,
  cardWidth,
  onCardWidthChange,
}: ViewerToolbarProps) {
  const handleCardWidthChange =
    typeof onCardWidthChange === "function" ? onCardWidthChange : () => {};
  return (
    <div className="toolbar">
      <span>{checkedCount} 件選択中</span>
      <button className="toolbar-button" onClick={onBulkDelete}>
        削除
      </button>
      <button className="toolbar-button" onClick={onBulkMove}>
        移動
      </button>
      <label style={{ marginLeft: 12, fontSize: 11, display: "inline-flex", alignItems: "center", gap: 8 }}>
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
      <div className="toolbar-spacer">
        hjkl:移動 / Space:チェック / Enter:拡大
      </div>
    </div>
  );
}
