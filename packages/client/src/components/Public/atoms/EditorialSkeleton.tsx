import { cn } from "@green-goods/shared/utils/styles/cn";
import type { ComponentPropsWithoutRef } from "react";

// Paradigm: Ambient Display. Material: warm vellum.
export type EditorialSkeletonProps = Omit<
  ComponentPropsWithoutRef<"span">,
  "aria-hidden" | "children"
>;

/** Decorative placeholder that preserves editorial layout without announcing noise. */
export function EditorialSkeleton({ className, ...props }: EditorialSkeletonProps) {
  return (
    <span
      {...props}
      aria-hidden="true"
      data-editorial-skeleton=""
      className={cn("editorial-skeleton", className)}
    />
  );
}

export function EditorialMediaCardSkeleton({
  className,
  mediaClassName = "aspect-[3/2]",
}: {
  className?: string;
  mediaClassName?: string;
}) {
  return (
    <div
      aria-hidden="true"
      data-editorial-skeleton-layout="media-card"
      className={cn("flex flex-col gap-4", className)}
    >
      <EditorialSkeleton className={cn("w-full", mediaClassName)} />
      <EditorialSkeleton className="h-5 w-3/4" />
      <EditorialSkeleton className="h-3 w-1/2" />
    </div>
  );
}

export function EditorialListRowSkeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      data-editorial-skeleton-layout="list-row"
      className={cn("flex items-stretch gap-4 py-4 sm:gap-5", className)}
    >
      <EditorialSkeleton className="h-20 w-28 shrink-0 sm:h-24 sm:w-36" />
      <div className="flex flex-1 flex-col justify-center gap-2">
        <EditorialSkeleton className="h-3 w-24" />
        <EditorialSkeleton className="h-5 w-3/4" />
        <EditorialSkeleton className="h-3 w-1/2" />
      </div>
      <div className="flex shrink-0 flex-col justify-center">
        <EditorialSkeleton className="h-9 w-20 rounded-full" />
      </div>
    </div>
  );
}

export function EditorialStatSkeleton({ className }: { className?: string }) {
  return <EditorialSkeleton className={cn("inline-block h-10 w-20", className)} />;
}
