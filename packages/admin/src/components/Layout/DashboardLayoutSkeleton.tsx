export function DashboardLayoutSkeleton() {
  return (
    <div
      className="flex min-h-screen bg-gray-50 dark:bg-gray-900"
      role="status"
      aria-live="polite"
      aria-busy="true"
      data-testid="dashboard-layout-skeleton"
    >
      <span className="sr-only">Loading admin layout</span>
      <aside className="hidden lg:flex w-64 flex-col border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="h-16 px-6 flex items-center border-b border-gray-200 dark:border-gray-700">
          <div className="h-6 w-32 rounded-md bg-gray-200 dark:bg-gray-700 animate-pulse" />
        </div>
        <div className="px-6 py-3 border-b border-gray-200 dark:border-gray-700">
          <div className="h-4 w-24 rounded-md bg-gray-200 dark:bg-gray-700 animate-pulse" />
        </div>
        <nav className="flex-1 px-4 py-6 space-y-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={`nav-item-${index}`}
              className="flex items-center px-3 py-2 rounded-md bg-gray-100 dark:bg-gray-700"
            >
              <div className="h-5 w-5 rounded-md bg-gray-200 dark:bg-gray-600 animate-pulse" />
              <div className="ml-3 h-4 flex-1 rounded-md bg-gray-200 dark:bg-gray-600 animate-pulse" />
            </div>
          ))}
        </nav>
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <div className="h-9 w-full rounded-md bg-gray-200 dark:bg-gray-700 animate-pulse" />
        </div>
      </aside>
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 px-6 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="h-10 w-10 rounded-md bg-gray-200 dark:bg-gray-700 animate-pulse lg:hidden" />
            <div className="h-10 w-40 rounded-md bg-gray-200 dark:bg-gray-700 animate-pulse" />
          </div>
          <div className="hidden lg:flex items-center space-x-3">
            <div className="h-10 w-32 rounded-md bg-gray-200 dark:bg-gray-700 animate-pulse" />
            <div className="h-10 w-10 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
          </div>
        </header>
        <main className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          <div className="h-9 w-48 rounded-md bg-gray-200 dark:bg-gray-800 animate-pulse" />
          <div className="grid gap-6 lg:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={`content-card-${index}`}
                className="h-40 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6"
              >
                <div className="h-5 w-32 rounded-md bg-gray-200 dark:bg-gray-800 animate-pulse" />
                <div className="mt-4 space-y-3">
                  <div className="h-4 w-full rounded-md bg-gray-200 dark:bg-gray-800 animate-pulse" />
                  <div className="h-4 w-2/3 rounded-md bg-gray-200 dark:bg-gray-800 animate-pulse" />
                  <div className="h-4 w-3/4 rounded-md bg-gray-200 dark:bg-gray-800 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
