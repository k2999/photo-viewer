"use client";

import { useEffect } from "react";
import type { Entry } from "@/components/ViewerContext";
import { useViewer } from "@/components/ViewerContext";

export function useSelectedEntrySync(selectedEntry: Entry | null) {
  const { setSelectedEntry } = useViewer();

  useEffect(() => {
    setSelectedEntry(selectedEntry);
  }, [selectedEntry, setSelectedEntry]);
}
