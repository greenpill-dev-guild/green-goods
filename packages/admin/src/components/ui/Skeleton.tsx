import type { CSSProperties } from "react";

import { cn } from "./cn";

interface SkeletonTextProps {
  lines?: number;
  width?: string;
  className?: string;
}

function SkeletonText({ lines = 3, width, className }: SkeletonTextProps) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }, (_, i) => (
        <div
          key={i}
          className={cn("h-4 rounded skeleton-shimmer", i === lines - 1 && !width && "w-2/3")}
          style={{
            animationDelay: `${i * 0.05}s`,
            ...(width ? { width } : {}),
          }}
        />
      ))}
    </div>
  );
}

interface SkeletonCardProps {
  hasHeader?: boolean;
  hasBody?: boolean;
  className?: string;
  style?: CSSProperties;
}

function SkeletonCard({ hasHeader = true, hasBody = true, className, style }: SkeletonCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-stroke-soft bg-bg-white shadow-sm overflow-hidden",
        className
      )}
      style={style}
    >
      {hasHeader && (
        <div className="flex items-center gap-3 border-b border-stroke-soft px-4 py-3 sm:px-6 sm:py-4">
          <div className="h-5 w-5 rounded-md skeleton-shimmer" />
          <div
            className="h-4 flex-1 rounded skeleton-shimmer"
            style={{ animationDelay: "0.05s" }}
          />
        </div>
      )}
      {hasBody && (
        <div className="space-y-3 p-4 sm:p-6">
          <div className="h-4 w-full rounded skeleton-shimmer" style={{ animationDelay: "0.1s" }} />
          <div
            className="h-4 w-full rounded skeleton-shimmer"
            style={{ animationDelay: "0.15s" }}
          />
          <div className="h-4 w-2/3 rounded skeleton-shimmer" style={{ animationDelay: "0.2s" }} />
        </div>
      )}
    </div>
  );
}

interface SkeletonGridProps {
  count?: number;
  columns?: number;
  className?: string;
}

function SkeletonGrid({ count = 6, columns = 3, className }: SkeletonGridProps) {
  const gridCols: Record<number, string> = {
    1: "grid-cols-1",
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
  };

  return (
    <div className={cn("grid gap-6", gridCols[columns] ?? `grid-cols-${columns}`, className)}>
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard
          key={i}
          className="animate-fade-in-up"
          style={{ animationDelay: `${i * 0.05}s` }}
        />
      ))}
    </div>
  );
}

export { SkeletonText, SkeletonCard, SkeletonGrid };
export type { SkeletonTextProps, SkeletonCardProps, SkeletonGridProps };
