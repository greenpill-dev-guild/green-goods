import { useElementHeight } from "@green-goods/shared/hooks/utils/useElementHeight";

/**
 * A screen's action bar, fixed to the bottom of the viewport the way the work
 * view's is, so it stays put whatever height the route hands down. A spacer
 * keeps the end of the content clear of it. The spacer takes the bar's measured
 * height, since a bar grows with a second row or a line saying why its act
 * waits; until the first measure it holds the one-button height.
 */
export function FixedBar({ children }: { children: React.ReactNode }) {
  const [measureBar, barHeight] = useElementHeight();
  return (
    <>
      <div
        aria-hidden="true"
        data-component="FixedBarSpacer"
        className={barHeight === null ? "h-[calc(112px+env(safe-area-inset-bottom))]" : undefined}
        style={barHeight === null ? undefined : { height: barHeight }}
      />
      <div
        ref={measureBar}
        data-component="FixedBar"
        className="fixed bottom-0 left-0 right-0 z-sticky"
      >
        {children}
      </div>
    </>
  );
}
