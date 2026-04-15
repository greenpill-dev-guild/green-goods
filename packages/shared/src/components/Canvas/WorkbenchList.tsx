import type { HTMLAttributes } from "react";
import { cn } from "../../utils";

export function WorkbenchList({
  children,
  className,
  style,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={cn(
        "overflow-hidden rounded-xl divide-y divide-stroke-soft",
        "glass-raised",
        className
      )}
      style={{
        boxShadow: "var(--edge-rest), var(--elevation-1)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
