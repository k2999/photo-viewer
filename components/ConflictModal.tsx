"use client";

import { useEffect, useState } from "react";
import type { ConflictDecision } from "@/lib/viewerGrid";

export type ConflictModalProps = {
  open: boolean;
  item: string;
  dest: string;
  existingName: string;
  onResolve: (d: ConflictDecision) => void;
};

export function ConflictModal({ open, item, dest, existingName, onResolve }: ConflictModalProps) {
  const [applyToAll, setApplyToAll] = useState(false);

  useEffect(() => {
    if (!open) setApplyToAll(false);
  }, [open]);

  if (!open) return null;

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
    >
      <div
        style={{
          width: "min(520px, 100%)",
          background: "#fff",
          borderRadius: 10,
          padding: 14,
          boxShadow: "0 12px 40px rgba(0,0,0,0.25)",
          fontSize: 13,
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 8 }}>同名が既に存在します</div>

        <div style={{ fontSize: 12, color: "#444", marginBottom: 10, lineHeight: 1.4 }}>
          <div>
            移動元: <code>{item}</code>
          </div>
          <div>
            移動先: <code>{dest}</code>
          </div>
          <div>
            競合: <code>{existingName}</code>
          </div>
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <input
            type="checkbox"
            checked={applyToAll}
            onChange={(e) => setApplyToAll(e.target.checked)}
          />
          以後同じ動作にする
        </label>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            className="toolbar-button"
            onClick={() => onResolve({ strategy: "skip", applyToAll })}
          >
            スキップ
          </button>
          <button
            className="toolbar-button"
            onClick={() => onResolve({ strategy: "rename", applyToAll })}
          >
            リネーム（~1）
          </button>
          <button
            className="toolbar-button"
            onClick={() => onResolve({ strategy: "overwrite", applyToAll })}
          >
            上書き
          </button>
        </div>
      </div>
    </div>
  );
}
