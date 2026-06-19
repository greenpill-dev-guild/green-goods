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
  loading?: boolean;
  loadingItemCount?: number;
  /**
   * Render density. Default `pill` shows each item as a soft pill with shadow
   * (the original anatomy). `inline` renders items as plain text separated by
   * mid-dots — used when the header lives directly below an AppBar GardenChip
   * and the pills would compete with chrome for attention. Per Tier 2b of the
   * admin design handoff (audit §5.6).
   */
  density?: "pill" | "inline";
}

export interface MetaStripSkeletonProps {
  className?: string;
  density?: MetaStripProps["density"];
  itemCount?: number;
}

const INLINE_SKELETON_WIDTHS = [
  { value: "1.75rem", label: "4.5rem" },
  { value: "1.5rem", label: "5.25rem" },
  { value: "2rem", label: "4rem" },
] as const;

const PILL_SKELETON_WIDTHS = [
  { value: "1.75rem", label: "4.75rem" },
  { value: "1.5rem", label: "5.5rem" },
  { value: "2rem", label: "4.25rem" },
] as const;

export function MetaStrip({
  items,
  className,
  density = "pill",
  loading = false,
  loadingItemCount = 2,
}: MetaStripProps) {
  if (loading) {
    return (
      <MetaStripSkeleton className={className} density={density} itemCount={loadingItemCount} />
    );
  }

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

function MetaStripSkeleton({ className, density = "pill", itemCount = 2 }: MetaStripSkeletonProps) {
  if (itemCount <= 0) return null;

  const widths = density === "inline" ? INLINE_SKELETON_WIDTHS : PILL_SKELETON_WIDTHS;
  const items = Array.from({ length: itemCount }, (_, index) => ({
    id: `meta-skeleton-${index}`,
    widths: widths[index % widths.length] ?? widths[0],
  }));

  if (density === "inline") {
    return (
      <div
        data-component="MetaStrip"
        data-density="inline"
        data-state="loading"
        aria-hidden="true"
        className={cn(
          "flex flex-wrap items-center gap-x-2 gap-y-1 text-label-sm font-medium text-text-sub",
          className
        )}
      >
        {items.map((item, index) => (
          <Fragment key={item.id}>
            {index > 0 ? (
              <span aria-hidden="true" className="text-text-soft">
                ·
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1" data-slot="skeleton-item">
              <span
                className="rounded skeleton-shimmer"
                data-slot="skeleton-value"
                style={{ width: item.widths.value, height: "1em" }}
              />
              <span
                className="rounded skeleton-shimmer"
                data-slot="skeleton-label"
                style={{ width: item.widths.label, height: "1em" }}
              />
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
      data-state="loading"
      aria-hidden="true"
      className={cn("flex flex-wrap items-center gap-2 max-[599px]:gap-1.5", className)}
    >
      {items.map((item) => (
        <span
          key={item.id}
          className="inline-flex items-center gap-1.5 rounded-full bg-bg-soft px-3 py-2 text-label-sm font-semibold text-text-sub shadow-[var(--edge-rest)]"
          data-slot="skeleton-item"
        >
          <span
            className="rounded skeleton-shimmer"
            data-slot="skeleton-value"
            style={{ width: item.widths.value, height: "1rem" }}
          />
          <span
            className="rounded skeleton-shimmer"
            data-slot="skeleton-label"
            style={{ width: item.widths.label, height: "1rem" }}
          />
        </span>
      ))}
    </div>
  );
}
