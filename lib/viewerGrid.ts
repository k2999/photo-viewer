export const PENDING_KEY = "photoViewer:pendingSelectOnEnter" as const;

export type ConflictDecision = {
  strategy: "overwrite" | "skip" | "rename";
  applyToAll: boolean;
};
