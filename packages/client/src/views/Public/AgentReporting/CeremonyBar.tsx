import { useDocumentEvent, useWindowEvent } from "@green-goods/shared/hooks/utils/useEventListener";
import { cn } from "@green-goods/shared/utils/styles/cn";
import { type ReactNode, useCallback, useLayoutEffect, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { FlowBar, FlowBarNote } from "@/components/Features/Work";

/**
 * The app's flow bar, fixed to the bottom of the viewport at every width, its content held to the
 * page's column. A spacer of its measured height keeps the end of the content clear of it, and the
 * document's scroll edge is padded by the same height so a field or link that takes focus stays
 * above it.
 *
 * The bar never takes the page away: on a viewport too short to share (under 20rem, as at 400%
 * zoom), or when its own lines make it taller than half the viewport (large text, a long reason on
 * a small phone), it follows the content instead of covering it.
 */
export function CeremonyBar({ status, children }: { status: ReactNode; children: ReactNode }) {
  const intl = useIntl();
  const [barHeight, setBarHeight] = useState<number | null>(null);
  const [viewportHeight, setViewportHeight] = useState(() =>
    typeof window === "undefined" ? Number.POSITIVE_INFINITY : window.innerHeight
  );
  useWindowEvent("resize", () => setViewportHeight(window.innerHeight));
  const follows = barHeight !== null && barHeight > viewportHeight / 2;
  const barRef = useRef<HTMLDivElement | null>(null);
  const setBar = useCallback((element: HTMLDivElement | null) => {
    barRef.current = element;
    if (!element || typeof ResizeObserver === "undefined") return;
    // The bar's own padding counts, so read its border box rather than its content box.
    const measure = () => setBarHeight(element.getBoundingClientRect().height);
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    measure();
    return () => observer.disconnect();
  }, []);
  useLayoutEffect(() => {
    if (barHeight === null || follows) return;
    const root = document.documentElement;
    const previous = root.style.scrollPaddingBottom;
    root.style.scrollPaddingBottom = `${barHeight}px`;
    return () => {
      root.style.scrollPaddingBottom = previous;
    };
  }, [barHeight, follows]);
  // Browsers leave a control that is already partly in view where it is when it takes focus, so
  // one of the page's own controls that the bar half covers is moved above it; `nearest` stops at
  // the padded scroll edge. Dialogs sit above the bar and are left alone.
  const regionRef = useRef<HTMLDivElement | null>(null);
  useDocumentEvent("focusin", (event) => {
    const bar = barRef.current;
    const page = regionRef.current?.parentElement;
    const target = event.target;
    if (!bar || !page || !(target instanceof Element) || bar.contains(target)) return;
    if (!page.contains(target) || getComputedStyle(bar).position === "static") return;
    const barTop = bar.getBoundingClientRect().top;
    const { top, bottom } = target.getBoundingClientRect();
    if (bottom > barTop && top < window.innerHeight) target.scrollIntoView({ block: "nearest" });
  });
  return (
    <>
      <div
        aria-hidden="true"
        data-component="CeremonyBarSpacer"
        className={cn(
          "[@media(max-height:20rem)]:hidden",
          follows && "hidden",
          barHeight === null && "h-[calc(7rem+env(safe-area-inset-bottom))]"
        )}
        style={barHeight === null ? undefined : { height: barHeight }}
      />
      <div
        ref={regionRef}
        role="region"
        aria-label={intl.formatMessage({
          id: "public.reporting.actionBar.label",
          defaultMessage: "Next step",
        })}
        data-component="CeremonyBar"
        className={cn(
          "[@media(max-height:20rem)]:[&>[data-component=FlowBar]]:static",
          follows && "[&>[data-component=FlowBar]]:static"
        )}
      >
        <FlowBar layout="column" ref={setBar} status={status}>
          {children}
        </FlowBar>
      </div>
    </>
  );
}

/**
 * Where the step stands, in the bar at the act's height, as the work page shows a settled
 * review: an icon and a short line, centred.
 */
export function BarStatus({
  tone,
  icon,
  announce = true,
  children,
}: {
  tone: "neutral" | "success" | "error";
  icon: ReactNode;
  /** Off when a notice under the heading already announces the same outcome. */
  announce?: boolean;
  children: ReactNode;
}) {
  return (
    <p
      role={announce ? "status" : undefined}
      data-component="CeremonyBarStatus"
      className={cn(
        "flex min-h-12 w-full items-center justify-center gap-2 text-center text-sm font-medium",
        tone === "success"
          ? "text-success-dark"
          : tone === "error"
            ? "text-error-dark"
            : "text-text-sub-600"
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "flex shrink-0 [&>svg]:h-5 [&>svg]:w-5",
          tone === "success" ? "text-success-base" : tone === "error" ? "text-error-base" : ""
        )}
      >
        {icon}
      </span>
      {children}
    </p>
  );
}

/** One line over the act: which signature it asks for, and from which account. */
export function ActContext({
  step = null,
  account = null,
}: {
  step?: ReactNode;
  account?: ReactNode;
}) {
  if (!step && !account) return null;
  return (
    <FlowBarNote>
      {step}
      {step && account ? " · " : null}
      {account}
    </FlowBarNote>
  );
}

/**
 * Two acts on one row, as the promise page pairs them: each starts at half the row, the primary on
 * the right, and both take full rows, the primary on top, when a label would not fit. A label
 * wider than a whole row (large text on a small phone) wraps inside its button.
 */
export function PairedActs({ children }: { children: ReactNode }) {
  return (
    <div className="flex w-full flex-row-reverse flex-wrap gap-2 [&>.gg-button]:min-w-fit [&>.gg-button]:grow [&>.gg-button]:whitespace-normal [&>.gg-button]:basis-[calc(50%-0.25rem)]">
      {children}
    </div>
  );
}
