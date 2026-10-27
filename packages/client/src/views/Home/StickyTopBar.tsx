import { useEventListener } from "@green-goods/shared/hooks/utils/useEventListener";
import { cn } from "@green-goods/shared/utils/styles/cn";
import { type ReactNode, useCallback, useEffect, useState } from "react";

interface StickyTopBarProps {
  /** Names the bar for tests and stories (`data-component`). */
  component: string;
  className?: string;
  children: ReactNode;
}

/**
 * A top bar that sticks to the top of the app's scroller (`#app-scroll`) and draws a hairline
 * once content passes under it, as Home's header does (DL-127). Its controls start 16px below
 * the status bar's safe area, where the offline strip shows.
 */
export function StickyTopBar({ component, className, children }: StickyTopBarProps) {
  const [scroller, setScroller] = useState<HTMLElement | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const attach = useCallback((node: HTMLDivElement | null) => {
    setScroller(node?.closest<HTMLElement>("#app-scroll") ?? null);
  }, []);
  const read = useCallback(() => setScrolled((scroller?.scrollTop ?? 0) > 0), [scroller]);
  useEffect(read, [read]);
  useEventListener(scroller, "scroll", read, { passive: true });

  return (
    <div
      ref={attach}
      data-component={component}
      data-scrolled={scrolled ? "true" : undefined}
      className={cn(
        "sticky top-0 z-sticky flex w-full items-center border-b border-transparent bg-bg-canvas px-4 pt-[var(--app-top-offset)] pb-2 sm:px-6 md:px-12",
        "transition-[border-color] duration-[var(--spring-effects-fast-duration)] ease-[var(--spring-effects-fast-easing)] motion-reduce:transition-none",
        "data-[scrolled=true]:border-stroke-soft-200",
        className
      )}
    >
      {children}
    </div>
  );
}
