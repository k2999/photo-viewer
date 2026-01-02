"use client";

import { useCallback } from "react";
import type React from "react";

export type ConflictDecision = {
  strategy: "overwrite" | "skip" | "rename";
  applyToAll: boolean;
};

export type UseBulkActionsArgs = {
  checked: Set<string>;
  setChecked: React.Dispatch<React.SetStateAction<Set<string>>>;
  reload: () => void;
  markedDir: string | null;
  askConflict: (args: { item: string; dest: string; existingName: string }) => Promise<ConflictDecision>;
};

export function useBulkActions({
  checked,
  setChecked,
  reload,
  markedDir,
  askConflict,
}: UseBulkActionsArgs) {
  const handleBulkDelete = useCallback(async () => {
    if (checked.size === 0) return;
    if (!window.confirm(`${checked.size} 件を削除しますか？`)) return;

    await fetch("/api/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", items: Array.from(checked) }),
    });

    setChecked(new Set());
    reload();
  }, [checked, setChecked, reload]);

  const handleMoveItemsToDest = useCallback(
    async (destDir: string, items?: string[] | null) => {
      if (typeof destDir !== "string" || !Array.isArray(items)) return;
      if (items.length === 0) return;
      if (!destDir) return;

      let remembered: ConflictDecision | null = null;
      const movedKeys = new Set<string>();

      for (const item of items) {
        let onConflict: "ask" | "overwrite" | "skip" | "rename" = "ask";
        if (remembered) onConflict = remembered.strategy;

        const res = await fetch("/api/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "move",
            items: [item],
            dest: destDir,
            onConflict,
          }),
        });

        if (res.status === 409) {
          const payload: any = await res.json();

          const decision: ConflictDecision = remembered
            ? remembered
            : await askConflict({
                item: payload.item ?? item,
                dest: payload.dest ?? destDir,
                existingName: payload.existingName ?? "",
              });

          if (decision.applyToAll) remembered = decision;

          const res2 = await fetch("/api/bulk", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "move",
              items: [item],
              dest: destDir,
              onConflict: decision.strategy,
            }),
          });

          if (!res2.ok) {
            console.error("move failed", await res2.text());
            continue;
          }

          const ok2: any = await res2.json();
          const r2 = ok2?.results?.[0];
          if (r2?.status === "moved") movedKeys.add(item);
          continue;
        }

        if (!res.ok) {
          console.error("move failed", await res.text());
          continue;
        }

        const ok: any = await res.json();
        const r = ok?.results?.[0];
        if (r?.status === "moved") movedKeys.add(item);
      }

      if (movedKeys.size > 0) {
        setChecked((prev) => {
          const next = new Set(prev);
          for (const k of movedKeys) next.delete(k);
          return next;
        });
      }

      // reload();
      return Array.from(movedKeys);
    },
    [askConflict, setChecked] // reload は現在未使用なので依存不要
  );

  const handleMoveToMarked = useCallback(async () => {
    if (checked.size === 0) return;
    if (!markedDir) return;
    if (!window.confirm(`${checked.size} 件を「${markedDir}」へ移動しますか？`)) return;
    return await handleMoveItemsToDest(markedDir, Array.from(checked));
  }, [checked, markedDir, handleMoveItemsToDest]);

  return { handleBulkDelete, handleMoveToMarked, handleMoveItemsToDest };
}
