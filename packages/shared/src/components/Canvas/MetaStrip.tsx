import type { ReactNode } from "react";
import { cn } from "../../utils";

export interface MetaStripItem {
  id?: string;
  label: ReactNode;
  value?: ReactNode;
}

export interface MetaStripProps {
  items: MetaStripItem[];
  className?: string;
}

export function MetaStrip({ items, className }: MetaStripProps) {
  if (items.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap items-center gap-2 max-[599px]:gap-1.5", className)}>
      {items.map((item, index) => (
        <span
          key={item.id ?? `meta-${index}`}
          className="inline-flex items-center gap-1.5 rounded-full bg-bg-soft px-3 py-2 text-[0.72rem] font-semibold tracking-[0.01em] text-text-sub shadow-[var(--edge-rest)]"
        >
          {item.value ? <span className="font-bold text-text-strong">{item.value}</span> : null}
          <span>{item.label}</span>
        </span>
      ))}
    </div>
  );
}
