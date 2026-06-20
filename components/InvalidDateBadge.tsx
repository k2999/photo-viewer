"use client";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTriangleExclamation } from "@fortawesome/free-solid-svg-icons";

export function InvalidDateBadge() {
  return (
    <div className="card-invalid-date-badge" title="フォルダの日付と一致しません">
      <FontAwesomeIcon icon={faTriangleExclamation} />
    </div>
  );
}
