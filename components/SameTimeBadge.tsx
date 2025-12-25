"use client";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faClock } from "@fortawesome/free-solid-svg-icons";

export function SameTimeBadge({
  count,
  title,
}: {
  count: number;
  title?: string;
}) {
  // count は “同一dateKeyの総数” を想定（>=2 のときだけ表示）
  if (count < 2) return null;

  return (
    <div
      className="card-same-time-badge"
      title={title ?? `同じ日時: ${count}件`}
    >
      <span className="same-time-icon" aria-hidden>
        <FontAwesomeIcon icon={faClock} />
      </span>
      <span className="same-time-count">{count}</span>
    </div>
  );
}
