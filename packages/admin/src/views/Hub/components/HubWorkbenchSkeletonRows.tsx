import type { MediaCardLayout } from "@green-goods/shared/components/Cards/MediaCard";
import { cn } from "@green-goods/shared/utils/styles/cn";

export function HubWorkbenchSkeletonRows({
  count,
  variant,
  layout = "stacked",
}: {
  count: number;
  variant: "media-card" | "card";
  /** The media card's layout, so the queue doesn't change shape when it loads. */
  layout?: MediaCardLayout;
}) {
  if (variant === "media-card") {
    const wide = layout === "wide";

    return (
      // eslint-disable-next-line jsx-a11y/no-redundant-roles -- hub-workbench-grid sets list-style:none + display:grid, which drop implicit list semantics; the explicit role restores them
      <ul className="hub-workbench-grid" data-card-layout={layout} role="list" aria-busy="true">
        {Array.from({ length: count }).map((_, index) => (
          <li key={`hub-card-skeleton-${index}`} aria-hidden="true" className="min-w-0">
            <div
              className={cn(
                "gg-card pointer-events-none flex h-full",
                wide ? "flex-row" : "flex-col"
              )}
            >
              <div
                className={cn(
                  "shrink-0 skeleton-shimmer",
                  wide ? "min-h-30 w-36 self-stretch" : "aspect-video w-full"
                )}
              />
              <div
                className={cn(
                  "flex min-w-0 flex-1 flex-col gap-2.5 px-3.5 pt-3 pb-3.5",
                  wide && "justify-center"
                )}
              >
                <div className="h-4 w-4/5 rounded-full skeleton-shimmer" />
                <div className="h-5 w-20 rounded-full skeleton-shimmer" />
                <div className="h-3 w-3/5 rounded-full skeleton-shimmer" />
              </div>
            </div>
          </li>
        ))}
      </ul>
    );
  }

  return (
    // eslint-disable-next-line jsx-a11y/no-redundant-roles -- hub-workbench-grid sets list-style:none + display:grid, which drop implicit list semantics; the explicit role restores them
    <ul className="hub-workbench-grid" role="list" aria-busy="true">
      {Array.from({ length: count }).map((_, index) => (
        <li key={`hub-card-skeleton-${index}`} aria-hidden="true" className="min-w-0">
          <div className="pointer-events-none h-full rounded-2xl bg-bg-weak p-4 shadow-[var(--edge-rest),var(--m3-elevation-1)]">
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <div className="h-11 w-11 rounded-xl skeleton-shimmer" />
                <div className="h-4 w-20 rounded-full skeleton-shimmer" />
              </div>
              <div className="h-7 w-24 rounded-full skeleton-shimmer" />
            </div>
            <div className="mt-4 space-y-2">
              <div className="h-5 w-4/5 rounded-full skeleton-shimmer" />
              <div className="h-4 w-full rounded-full skeleton-shimmer" />
              <div className="h-4 w-2/3 rounded-full skeleton-shimmer" />
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-4 w-3/5 rounded-full skeleton-shimmer" />
                <div className="h-4 w-2/5 rounded-full skeleton-shimmer" />
              </div>
              <div className="h-7 w-20 rounded-full skeleton-shimmer" />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
