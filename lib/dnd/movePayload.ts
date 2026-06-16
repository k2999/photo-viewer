export type MovePayload = { kind: "photoViewer:moveItems"; items: string[] };

const MOVE_ITEMS_MIME = "application/x-photo-viewer-move-items";

export function hasMoveItems(dt: DataTransfer): boolean {
  return Array.from(dt.types).includes(MOVE_ITEMS_MIME) || Array.from(dt.types).includes("application/json");
}

export function readMoveItems(dt: DataTransfer): string[] | null {
  try {
    const raw = dt.getData(MOVE_ITEMS_MIME) || dt.getData("application/json");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MovePayload;
    if (parsed?.kind !== "photoViewer:moveItems") return null;
    if (!Array.isArray(parsed.items)) return null;
    return parsed.items.map(String);
  } catch {
    return null;
  }
}

export function writeMoveItems(dt: DataTransfer, items: string[]) {
  const payload: MovePayload = { kind: "photoViewer:moveItems", items };
  const raw = JSON.stringify(payload);
  dt.setData(MOVE_ITEMS_MIME, raw);
  dt.setData("application/json", raw);
  dt.setData("text/plain", items.join("\n"));
}
