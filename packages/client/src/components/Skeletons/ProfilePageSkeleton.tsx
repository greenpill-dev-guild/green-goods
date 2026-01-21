/**
 * Skeleton for the Profile page while loading
 *
 * Matches the layout:
 * - Avatar and display name
 * - Location info
 * - Tab navigation
 * - Content area
 */
export function ProfilePageSkeleton() {
  return (
    <section
      className="flex h-full flex-col"
      role="status"
      aria-label="Profile loading"
      aria-busy="true"
    >
      <span className="sr-only">Loading profile...</span>
      {/* Fixed Header */}
      <div className="fixed left-0 top-0 z-10 w-full bg-bg-white-0" aria-hidden="true">
        {/* Profile header skeleton */}
        <div className="px-4 pt-6 pb-4">
          <div className="flex items-center gap-4">
            {/* Avatar skeleton */}
            <div className="w-16 h-16 skeleton rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-2">
              {/* Display name skeleton */}
              <div className="h-6 w-40 skeleton rounded" />
              {/* Location skeleton */}
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 skeleton rounded" />
                <div className="h-4 w-24 skeleton rounded" />
              </div>
            </div>
          </div>
        </div>

        {/* Tabs skeleton */}
        <div className="border-b border-stroke-soft-200">
          <div className="flex gap-6 px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 skeleton rounded" />
              <div className="h-4 w-16 skeleton rounded" />
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 skeleton rounded" />
              <div className="h-4 w-12 skeleton rounded" />
            </div>
          </div>
        </div>
      </div>

      {/* Content skeleton */}
      <div className="flex-1 overflow-x-hidden overflow-y-auto pt-64 pb-4" aria-hidden="true">
        <div className="padded my-4 flex flex-col gap-4">
          {/* Card skeletons */}
          {Array.from({ length: 4 }).map((_, idx) => (
            <div
              key={`profile-card-skeleton-${idx}`}
              className="p-4 border border-stroke-soft-200 rounded-xl"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 skeleton rounded-lg" />
                  <div className="space-y-1.5">
                    <div className="h-5 w-32 skeleton rounded" />
                    <div className="h-4 w-48 skeleton rounded" />
                  </div>
                </div>
                <div className="w-8 h-8 skeleton rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
