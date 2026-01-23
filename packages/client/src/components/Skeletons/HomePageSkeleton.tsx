import { GardenCardSkeleton } from "@/components/Cards";

/**
 * Skeleton for the Home page while gardens are loading
 *
 * Matches the layout of the actual Home page:
 * - Header with title and filter button
 * - List of garden card skeletons
 *
 * @example
 * import { Suspense } from 'react';
 * import { HomePageSkeleton } from '@/components/Skeletons';
 *
 * <Suspense fallback={<HomePageSkeleton />}>
 *   <Home />
 * </Suspense>
 */
export function HomePageSkeleton() {
  return (
    <article className="mb-6" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Loading...</span>
      {/* Header skeleton */}
      <div className="flex items-center justify-between w-full py-6 px-4 sm:px-6 md:px-12">
        <div className="h-7 w-24 skeleton rounded" />
        <div className="ml-4 flex items-center gap-2">
          <div className="w-8 h-8 skeleton rounded-lg" />
          <div className="w-8 h-8 skeleton rounded-lg" />
        </div>
      </div>

      {/* Garden cards skeleton */}
      <div className="padded flex flex-col gap-4">
        {Array.from({ length: 3 }).map((_, idx) => (
          <GardenCardSkeleton key={`garden-card-skeleton-${idx}`} media="large" height="home" />
        ))}
      </div>
    </article>
  );
}
