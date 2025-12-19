"use client";

import React, { createContext, useContext, useMemo, useState } from "react";

export type Entry = {
  name: string;
  relativePath: string;
  type: "dir" | "image" | "video" | "other";
};

type ViewerCtxValue = {
  selectedEntry: Entry | null;
  setSelectedEntry: (e: Entry | null) => void;
};

const ViewerContext = createContext<ViewerCtxValue | null>(null);

export function ViewerProvider({ children }: { children: React.ReactNode }) {
  const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null);

  const value = useMemo(
    () => ({ selectedEntry, setSelectedEntry }),
    [selectedEntry]
  );

  return (
    <ViewerContext.Provider value={value}>{children}</ViewerContext.Provider>
  );
}

export function useViewer() {
  const ctx = useContext(ViewerContext);
  if (!ctx) throw new Error("useViewer must be used within ViewerProvider");
  return ctx;
}
