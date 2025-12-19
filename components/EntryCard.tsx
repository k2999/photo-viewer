"use client";

import type { ReactNode } from "react";

export type EntryCardProps = {
  idx: number;
  className: string;

  // 見た目に必要な最低限
  title: string; // card-name の title
  name: string; // card-name の表示

  // checkbox
  isChecked: boolean;
  onCheckboxChange: (ev: React.ChangeEvent<HTMLInputElement>) => void;

  // card 全体
  onClick: () => void;
  onDoubleClick: () => void;

  // サムネ部分（DirThumbGrid や <img> をそのまま渡す）
  thumb: ReactNode;
};

export function EntryCard({
  idx,
  className,
  title,
  name,
  isChecked,
  onCheckboxChange,
  onClick,
  onDoubleClick,
  thumb,
}: EntryCardProps) {
  return (
    <div
      data-idx={idx}
      className={className}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    >
      <div className="card-thumb">{thumb}</div>

      <div className="card-name" title={title}>
        {name}
      </div>

      <div className="card-check">
        <input
          type="checkbox"
          checked={isChecked}
          onChange={onCheckboxChange}
        />
      </div>
    </div>
  );
}
