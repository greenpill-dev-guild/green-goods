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
      className={cn(
        "flex items-center justify-center p-6",
        "bg-[linear-gradient(180deg,rgb(255_255_255/0.62)_0%,rgb(249_247_242/0.82)_100%)] dark:bg-bg-soft/60",
        className
      )}
      style={{
        minHeight: "min(24rem, 48vh)",
        boxShadow: "var(--edge-rest)",
      }}
    >
      {children}
    </Surface>
  );
}
