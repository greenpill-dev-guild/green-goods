import { WorkbenchList } from "@green-goods/shared";

export function HubWorkbenchSkeletonRows({ count }: { count: number }) {
  return (
    <WorkbenchList aria-busy="true">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={`hub-skeleton-${index}`}
          aria-hidden="true"
          className="pointer-events-none grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-[0.875rem] px-4 py-3 max-[599px]:grid-cols-[auto_minmax(0,1fr)] max-[599px]:gap-3 max-[599px]:px-[0.8rem] max-[599px]:py-[0.85rem]"
        >
          <div className="flex w-[3.75rem] items-center justify-center max-[599px]:w-12">
            <div className="h-14 w-14 rounded-2xl skeleton-shimmer max-[599px]:h-11 max-[599px]:w-11 max-[599px]:rounded-[0.85rem]" />
          </div>
          <div className="min-w-0">
            <div className="h-3 w-24 rounded-full skeleton-shimmer" />
            <div className="mt-3 h-5 w-3/5 rounded-full skeleton-shimmer" />
            <div className="mt-2 h-4 w-4/5 rounded-full skeleton-shimmer" />
            <div className="mt-3 flex flex-wrap gap-2">
              <div className="h-7 w-20 rounded-full skeleton-shimmer" />
              <div className="h-7 w-16 rounded-full skeleton-shimmer" />
            </div>
          </div>
          <div className="hidden h-9 w-9 rounded-full skeleton-shimmer min-[600px]:block" />
        </div>
      ))}
    </WorkbenchList>
  );
}
