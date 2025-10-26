export function DashboardLayoutSkeleton() {
  return (
    <div
      className="flex min-h-screen bg-bg-weak"
      role="status"
      aria-live="polite"
      aria-busy="true"
      data-testid="dashboard-layout-skeleton"
    >
      <span className="sr-only">Loading admin layout</span>
      <aside className="hidden lg:flex w-64 flex-col border-r border-stroke-soft bg-bg-white">
        {/* Header */}
        <div className="h-16 px-6 flex items-center border-b border-stroke-soft">
          <div className="h-6 w-32 rounded-md bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 bg-[length:200%_100%] animate-[shimmer_1.5s_ease-in-out_infinite]" />
        </div>
        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={`nav-item-${index}`} className="flex items-center px-3 py-2 rounded-md">
              <div
                className="h-5 w-5 rounded-md bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 bg-[length:200%_100%] animate-[shimmer_1.5s_ease-in-out_infinite]"
                style={{ animationDelay: `${index * 0.1}s` }}
              />
              <div
                className="ml-3 h-4 flex-1 rounded-md bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 bg-[length:200%_100%] animate-[shimmer_1.5s_ease-in-out_infinite]"
                style={{ animationDelay: `${index * 0.1}s` }}
              />
            </div>
          ))}
        </nav>
        {/* Footer - Mobile disconnect button placeholder */}
        <div className="p-4 border-t border-stroke-soft">
          <div className="h-9 w-full rounded-md bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 bg-[length:200%_100%] animate-[shimmer_1.5s_ease-in-out_infinite]" />
        </div>
      </aside>
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-16 px-6 border-b border-stroke-soft bg-bg-white flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="h-10 w-10 rounded-md bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 bg-[length:200%_100%] animate-[shimmer_1.5s_ease-in-out_infinite] lg:hidden" />
            <div className="h-10 w-40 rounded-md bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 bg-[length:200%_100%] animate-[shimmer_1.5s_ease-in-out_infinite]" />
          </div>
          <div className="hidden lg:flex items-center space-x-3">
            <div className="h-10 w-32 rounded-md bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 bg-[length:200%_100%] animate-[shimmer_1.5s_ease-in-out_infinite]" />
            <div className="h-10 w-10 rounded-full bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 bg-[length:200%_100%] animate-[shimmer_1.5s_ease-in-out_infinite]" />
          </div>
        </header>
        {/* Main content */}
        <main className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          <div className="h-9 w-48 rounded-md bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 bg-[length:200%_100%] animate-[shimmer_1.5s_ease-in-out_infinite]" />
          <div className="grid gap-6 lg:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={`content-card-${index}`}
                className="h-40 rounded-xl border border-stroke-soft bg-bg-white p-6"
              >
                <div
                  className="h-5 w-32 rounded-md bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 bg-[length:200%_100%] animate-[shimmer_1.5s_ease-in-out_infinite]"
                  style={{ animationDelay: `${index * 0.15}s` }}
                />
                <div className="mt-4 space-y-3">
                  <div
                    className="h-4 w-full rounded-md bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 bg-[length:200%_100%] animate-[shimmer_1.5s_ease-in-out_infinite]"
                    style={{ animationDelay: `${index * 0.15}s` }}
                  />
                  <div
                    className="h-4 w-2/3 rounded-md bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 bg-[length:200%_100%] animate-[shimmer_1.5s_ease-in-out_infinite]"
                    style={{ animationDelay: `${index * 0.15 + 0.05}s` }}
                  />
                  <div
                    className="h-4 w-3/4 rounded-md bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 bg-[length:200%_100%] animate-[shimmer_1.5s_ease-in-out_infinite]"
                    style={{ animationDelay: `${index * 0.15 + 0.1}s` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
