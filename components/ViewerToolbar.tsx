"use client";

export type ViewerToolbarProps = {
  checkedCount: number;
  onBulkDelete: () => void;
  onBulkMove: () => void;
};

export function ViewerToolbar({
  checkedCount,
  onBulkDelete,
  onBulkMove,
}: ViewerToolbarProps) {
  return (
    <div className="toolbar">
      <span>{checkedCount} 件選択中</span>
      <button className="toolbar-button" onClick={onBulkDelete}>
        削除
      </button>
      <button className="toolbar-button" onClick={onBulkMove}>
        移動
      </button>
      <div className="toolbar-spacer">
        hjkl:移動 / Space:チェック / Enter:拡大
      </div>
    </div>
  );
}
