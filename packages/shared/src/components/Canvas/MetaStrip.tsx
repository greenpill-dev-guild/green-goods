import { Fragment, type ReactNode } from "react";
import { cn } from "../../utils";

export interface MetaStripItem {
  id?: string;
  label: ReactNode;
  value?: ReactNode;
}

export interface MetaStripProps {
  items: MetaStripItem[];
  className?: string;
  /**
   * Render density. Default `pill` shows each item as a soft pill with shadow
   * (the original anatomy). `inline` renders items as plain text separated by
   * mid-dots — used when the header lives directly below an AppBar GardenChip
   * and the pills would compete with chrome for attention. Per Tier 2b of the
   * admin design handoff (audit §5.6).
   */
  density?: "pill" | "inline";
}

export function MetaStrip({ items, className, density = "pill" }: MetaStripProps) {
  if (items.length === 0) return null;

  if (density === "inline") {
    return (
      <div
        data-component="MetaStrip"
        data-density="inline"
        className={cn(
          "flex flex-wrap items-center gap-x-2 gap-y-1 text-label-sm font-medium text-text-sub",
          className
        )}
      >
        {items.map((item, index) => (
          <Fragment key={item.id ?? `meta-${index}`}>
            {index > 0 ? (
              <span aria-hidden="true" className="text-text-soft">
                ·
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1">
              {item.value ? (
                <span className="font-semibold text-text-strong tabular-nums">{item.value}</span>
              ) : null}
              <span>{item.label}</span>
            </span>
          </Fragment>
        ))}
      </div>
    );
  }

  return (
    <div
      data-component="MetaStrip"
      data-density="pill"
      className={cn("flex flex-wrap items-center gap-2 max-[599px]:gap-1.5", className)}
    >
      {items.map((item, index) => (
        <span
          key={item.id ?? `meta-${index}`}
          className="inline-flex items-center gap-1.5 rounded-full bg-bg-soft px-3 py-2 text-label-sm font-semibold text-text-sub shadow-[var(--edge-rest)]"
        >
          {item.value ? <span className="font-bold text-text-strong">{item.value}</span> : null}
          <span>{item.label}</span>
        </span>
      ))}
    </div>
  );
}
