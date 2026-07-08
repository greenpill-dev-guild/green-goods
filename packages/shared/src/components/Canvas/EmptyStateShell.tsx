import type { ReactNode } from "react";
import { cn } from "../../utils";
import { Surface } from "../Surface";

export function EmptyStateShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <Surface
      elevation="ground"
      radius="xl"
      data-component="EmptyStateShell"
      className={cn("flex items-center justify-center p-6", className)}
      style={{
        display: "flex",
        flex: "1 1 auto",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "var(--canvas-empty-state-min-height, 24rem)",
        boxShadow: "var(--edge-rest)",
        background: "var(--admin-empty-state-bg, var(--color-material-thin))",
      }}
    >
      {children}
    </Surface>
  );
}
