import type { CSSProperties, ReactNode } from "react";

export interface SheetBodyProps {
  children: ReactNode;
  /** When true, applies the handoff `20px 16px` body padding. Pass false for edge-to-edge content (lists). */
  padded?: boolean;
  className?: string;
  style?: CSSProperties;
}

const baseStyle: CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflowY: "auto",
  overflowX: "hidden",
  scrollbarWidth: "none",
  msOverflowStyle: "none",
};

// The host sheet may set `--gg-sheet-body-padding` so the body's inset matches
// its header's: the cockpit's docked side sheet pads 24px from 640px.
const paddedStyle: CSSProperties = {
  padding: "var(--gg-sheet-body-padding, 20px 16px)",
};

/**
 * SheetBody — scrollable middle slot for dialog / inspector panel content.
 * Handoff anatomy: hidden scrollbar, optional `20px 16px` padding (use
 * `padded={false}` for edge-to-edge lists like NotificationsContent), which
 * the host sheet can retune through `--gg-sheet-body-padding`.
 */
export function SheetBody({ children, padded = true, className, style }: SheetBodyProps) {
  return (
    <div
      data-component="SheetBody"
      data-padded={padded ? "true" : "false"}
      className={className}
      style={padded ? { ...baseStyle, ...paddedStyle, ...style } : { ...baseStyle, ...style }}
    >
      {children}
    </div>
  );
}
