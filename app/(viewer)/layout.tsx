import type { ReactNode } from "react";
import { ViewerShell } from "@/components/ViewerShell";
import { ViewerProvider } from "@/components/ViewerContext";

export default function ViewerLayout({ children }: { children: ReactNode }) {
  return (
    <ViewerProvider>
      <ViewerShell>{children}</ViewerShell>
    </ViewerProvider>
  );
}
