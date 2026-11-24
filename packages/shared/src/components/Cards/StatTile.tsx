import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../utils/styles/cn";

export interface StatTileProps extends Omit<HTMLAttributes<HTMLSpanElement>, "children"> {
  label: ReactNode;
  value: ReactNode;
  delta?: ReactNode;
}

/** A card's headline metric (DL-136). Lists of facts use FactRow instead. */
export function StatTile({ label, value, delta, className, ...props }: StatTileProps) {
  return (
    <span data-component="StatTile" className={cn("block min-w-0", className)} {...props}>
      <span className="block type-label-sm font-medium text-text-sub">{label}</span>
      <span className="mt-1 block break-words type-title-lg font-semibold tabular-nums text-text-strong">
        {value}
      </span>
      {delta !== undefined ? (
        <span className="mt-1 block type-meta text-text-soft">{delta}</span>
      ) : null}
    </span>
  );
}
