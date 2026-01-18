/**
 * Skeleton for the Garden detail page while loading
 *
 * Matches the layout:
 * - Banner image placeholder
 * - Back navigation placeholder
 * - Title and metadata placeholders
 * - Tabs placeholder
 * - Content area placeholder
 */
export function GardenPageSkeleton() {
  return (
    <div
      className="h-full min-h-0 w-full flex flex-col relative overflow-hidden"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="sr-only">Loading garden details...</span>
      {/* Banner skeleton */}
      <div className="relative w-full">
        <div className="w-full h-44 md:h-52 skeleton rounded-b-3xl" />
        {/* Back button placeholder */}
        <div className="absolute top-6 left-4 z-20">
          <div className="w-10 h-10 skeleton rounded-full" />
        </div>
      </div>

      {/* Title and metadata skeleton */}
      <div className="px-4 md:px-6 mt-3 flex flex-col gap-1.5 pb-3">
        <div className="h-7 w-48 skeleton rounded" />
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 skeleton rounded" />
            <div className="h-4 w-32 skeleton rounded" />
          </div>
          <span className="hidden sm:inline text-text-soft-400">•</span>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 skeleton rounded" />
            <div className="h-4 w-28 skeleton rounded" />
          </div>
        </div>
      </div>

      {/* Tabs skeleton */}
      <div className="w-full bg-bg-white-0 border-b border-stroke-soft-200">
        <div className="flex gap-6 px-4 md:px-6 py-3">
          {Array.from({ length: 3 }).map((_, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <div className="w-4 h-4 skeleton rounded" />
              <div className="h-4 w-16 skeleton rounded" />
            </div>
          ))}
        </div>
      </div>

      {/* Content area skeleton */}
      <div className="flex-1 min-h-0 px-4 md:px-6 pb-4 pt-4">
        {/* Work cards skeleton */}
        <div className="flex flex-col gap-4">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className="p-4 border border-stroke-soft-200 rounded-xl">
              <div className="flex items-start gap-3">
                <div className="w-16 h-16 skeleton rounded-lg flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-5 w-3/4 skeleton rounded" />
                  <div className="h-4 w-1/2 skeleton rounded" />
                  <div className="flex items-center gap-2 mt-2">
                    <div className="h-5 w-16 skeleton rounded-full" />
                    <div className="h-4 w-24 skeleton rounded" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
