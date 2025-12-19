"use client";

export type UseBulkActionsArgs = {
  checked: Set<string>;
  setChecked: (next: Set<string>) => void;
  reload: () => void;
};

export function useBulkActions({
  checked,
  setChecked,
  reload,
}: UseBulkActionsArgs) {
  async function handleBulkDelete() {
    if (checked.size === 0) return;
    if (!window.confirm(`${checked.size} 件を削除しますか？`)) return;

    await fetch("/api/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", items: Array.from(checked) }),
    });

    setChecked(new Set());
    reload();
  }

  async function handleBulkMove() {
    if (checked.size === 0) return;
    const dest = window.prompt("移動先（ROOT_DIR からの相対パス）:", ".");
    if (!dest) return;

    await fetch("/api/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "move",
        items: Array.from(checked),
        dest,
      }),
    });

    setChecked(new Set());
    reload();
  }

  return { handleBulkDelete, handleBulkMove };
}
