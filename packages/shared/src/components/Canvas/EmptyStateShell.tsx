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
      className={cn("flex items-center justify-center p-6", className)}
      style={{
        minHeight: "min(24rem, 48vh)",
        boxShadow: "var(--edge-rest)",
        background: "var(--admin-empty-state-bg, var(--color-material-thin))",
      }}
    >
      {children}
    </Surface>
  );
}
