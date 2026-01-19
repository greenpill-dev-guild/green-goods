import { cn } from "@green-goods/shared/utils";
import { RiRefreshLine } from "@remixicon/react";
import { useCallback, useEffect, useRef, useState, type PropsWithChildren } from "react";

/**
 * Minimum pull distance in pixels before a refresh is triggered.
 * Tuned for mobile-style UX: high enough to avoid accidental refreshes,
 * but low enough that a deliberate pull feels responsive.
 */
const REFRESH_THRESHOLD = 80;

/**
 * Maximum pull distance in pixels to cap how far content can be dragged.
 * Prevents excessive "rubber band" effect while still allowing a clear
 * visual indication that a refresh is in progress.
 */
const MAX_PULL_DISTANCE = 120;

/**
 * Unitless resistance factor applied to the pull distance.
 * Higher values make the pull feel "heavier" (more resistance),
 * providing a damped, native-like pull-to-refresh interaction.
 */
const RESISTANCE = 2.5;

/** Default scroll container ID used in AppShell */
const DEFAULT_SCROLL_CONTAINER_ID = "app-scroll";

interface PullToRefreshProps {
  /** Async function called when refresh is triggered. Component shows loading state until Promise resolves. */
  onRefresh: () => Promise<void>;
  /** Optional: External loading state (e.g., from TanStack Query isFetching) */
  isRefreshing?: boolean;
  /** Optional: Disable pull-to-refresh functionality */
  disabled?: boolean;
  /** Optional: Custom className for the wrapper */
  className?: string;
  /** Optional: ID of the scroll container element. Defaults to "app-scroll" */
  scrollContainerId?: string;
  /** Optional: ARIA label for accessibility */
  refreshLabel?: string;
}

type PullState = "idle" | "pulling" | "ready" | "refreshing";

/**
 * Native-style pull-to-refresh component for touch devices.
 *
 * Features:
 * - Works with touch events (touchstart, touchmove, touchend)
 * - Shows visual indicator while pulling
 * - Smooth animations using CSS transforms
 * - Respects reduced motion preferences
 * - Uses non-passive touch listeners to properly prevent scroll during pull
 * - Integrates with AppShell's scroll container (#app-scroll)
 *
 * Usage:
 * ```tsx
 * <PullToRefresh onRefresh={async () => { await refetch(); }}>
 *   <YourContent />
 * </PullToRefresh>
 * ```
 */
export function PullToRefresh({
  onRefresh,
  isRefreshing: externalRefreshing,
  disabled = false,
  className,
  scrollContainerId = DEFAULT_SCROLL_CONTAINER_ID,
  refreshLabel = "Pull to refresh",
  children,
}: PropsWithChildren<PullToRefreshProps>) {
  const [pullState, setPullState] = useState<PullState>("idle");
  const [pullDistance, setPullDistance] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef(0);
  const isPulling = useRef(false);
  const isMountedRef = useRef(true);

  // Detect reduced motion preference
  const prefersReducedMotion = useRef(
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false
  );

  // Use external refreshing state if provided, otherwise use internal state
  const isRefreshing = externalRefreshing ?? pullState === "refreshing";

  // Get scroll container from DOM
  const getScrollContainer = useCallback(() => {
    return document.getElementById(scrollContainerId);
  }, [scrollContainerId]);

  // Track mounted state to prevent updates after unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Handle external refresh state changes
  useEffect(() => {
    if (externalRefreshing === false && pullState === "refreshing") {
      if (isMountedRef.current) {
        setPullState("idle");
        setPullDistance(0);
      }
    }
  }, [externalRefreshing, pullState]);

  // Store latest values in refs for use in event handlers
  const stateRef = useRef({ disabled, isRefreshing, pullState, onRefresh, externalRefreshing });
  useEffect(() => {
    stateRef.current = { disabled, isRefreshing, pullState, onRefresh, externalRefreshing };
  }, [disabled, isRefreshing, pullState, onRefresh, externalRefreshing]);

  // Attach touch event listeners with { passive: false } to allow preventDefault
  // This is necessary because React's onTouchMove doesn't support passive: false
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleTouchStart = (e: TouchEvent) => {
      const { disabled: d, isRefreshing: r } = stateRef.current;
      if (d || r) return;

      const scrollContainer = getScrollContainer();
      const scrollTop = scrollContainer?.scrollTop ?? 0;

      // Only allow pull if at the top of scroll container
      if (scrollTop > 5) return;

      // Contain overscroll to prevent native pull-to-refresh interference
      // This allows native bounce at the bottom while we handle the top
      if (scrollContainer) {
        scrollContainer.style.overscrollBehaviorY = "contain";
      }

      touchStartY.current = e.touches[0].clientY;
      isPulling.current = true;
    };

    const handleTouchMove = (e: TouchEvent) => {
      const { disabled: d, isRefreshing: r } = stateRef.current;
      if (!isPulling.current || d || r) return;

      const scrollContainer = getScrollContainer();
      const scrollTop = scrollContainer?.scrollTop ?? 0;

      // If user scrolled down, cancel pull and restore native overscroll
      if (scrollTop > 5) {
        isPulling.current = false;
        if (scrollContainer) {
          scrollContainer.style.overscrollBehaviorY = "";
        }
        setPullState("idle");
        setPullDistance(0);
        return;
      }

      const touchY = e.touches[0].clientY;
      const deltaY = touchY - touchStartY.current;

      // Only handle downward pulls
      if (deltaY <= 0) {
        setPullDistance(0);
        setPullState("idle");
        return;
      }

      // Prevent native scroll/overscroll immediately when pulling down at top
      // This must happen early to prevent browser's native pull-to-refresh
      e.preventDefault();

      // Apply resistance to make it feel more natural
      const resistedDistance = Math.min(deltaY / RESISTANCE, MAX_PULL_DISTANCE);

      setPullDistance(resistedDistance);
      setPullState(resistedDistance >= REFRESH_THRESHOLD ? "ready" : "pulling");
    };

    const handleTouchEnd = async () => {
      const {
        disabled: d,
        isRefreshing: r,
        pullState: ps,
        onRefresh: refresh,
        externalRefreshing: ext,
      } = stateRef.current;

      // Restore native overscroll behavior
      const scrollContainer = getScrollContainer();
      if (scrollContainer) {
        scrollContainer.style.overscrollBehaviorY = "";
      }

      // Guard against double-refresh race condition
      if (!isPulling.current || d || r) return;

      isPulling.current = false;

      if (ps === "ready") {
        if (isMountedRef.current) {
          setPullState("refreshing");
          setPullDistance(REFRESH_THRESHOLD / 2); // Keep indicator visible during refresh
        }

        try {
          await refresh();
        } finally {
          // If not using external state, reset here
          if (ext === undefined && isMountedRef.current) {
            setPullState("idle");
            setPullDistance(0);
          }
        }
      } else {
        if (isMountedRef.current) {
          setPullState("idle");
          setPullDistance(0);
        }
      }
    };

    // Add event listeners with { passive: false } for touchmove
    // This allows us to call preventDefault() without browser warnings
    container.addEventListener("touchstart", handleTouchStart, { passive: true });
    container.addEventListener("touchmove", handleTouchMove, { passive: false });
    container.addEventListener("touchend", handleTouchEnd, { passive: true });
    container.addEventListener("touchcancel", handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
      container.removeEventListener("touchend", handleTouchEnd);
      container.removeEventListener("touchcancel", handleTouchEnd);

      // Restore native overscroll on unmount
      const scrollContainer = getScrollContainer();
      if (scrollContainer) {
        scrollContainer.style.overscrollBehaviorY = "";
      }
    };
  }, [getScrollContainer]);

  // Calculate rotation for the refresh icon (0 to 360 degrees based on pull progress)
  const iconRotation = Math.min((pullDistance / REFRESH_THRESHOLD) * 360, 360);

  // Determine if indicator should be visible
  const showIndicator = pullDistance > 10 || isRefreshing;

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {/* Pull indicator - positioned at top of container */}
      <div
        className={cn(
          "absolute left-0 right-0 flex items-center justify-center z-10 pointer-events-none",
          "transition-all duration-200 ease-out"
        )}
        style={{
          top: -40 + pullDistance,
          height: 40,
          opacity: showIndicator ? 1 : 0,
        }}
        role="status"
        aria-live="polite"
        aria-label={
          isRefreshing
            ? "Refreshing..."
            : pullState === "ready"
              ? "Release to refresh"
              : refreshLabel
        }
      >
        <div
          className={cn(
            "w-10 h-10 rounded-full bg-bg-white-0 shadow-regular-md",
            "flex items-center justify-center",
            "border border-stroke-soft-200"
          )}
        >
          <RiRefreshLine
            className={cn(
              "w-5 h-5 text-primary transition-transform",
              isRefreshing && !prefersReducedMotion.current && "animate-spin"
            )}
            style={{
              transform:
                isRefreshing || prefersReducedMotion.current
                  ? undefined
                  : `rotate(${iconRotation}deg)`,
              transitionDuration:
                pullState === "idle" && !prefersReducedMotion.current ? "300ms" : "0ms",
            }}
          />
        </div>
      </div>

      {/* Content wrapper with transform for pull effect */}
      <div
        style={{
          transform:
            pullDistance > 0 && !prefersReducedMotion.current
              ? `translateY(${pullDistance}px)`
              : undefined,
          transition:
            pullState === "idle" && !prefersReducedMotion.current
              ? "transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)"
              : "none",
        }}
      >
        {children}
      </div>
    </div>
  );
}
