import type { CSSProperties } from "react";

export interface SheetDividerProps {
  className?: string;
  style?: CSSProperties;
}

const baseStyle: CSSProperties = {
  height: "1px",
  background: "var(--hairline)",
  margin: "16px 0",
};

/**
 * SheetDivider — visual rule between SheetBody sections (e.g., between
 * Profile identity / fields / organisation / gardens). Handoff anatomy:
 * 1px hairline with `16px 0` vertical margin.
 */
export function SheetDivider({ className, style }: SheetDividerProps) {
  return (
    <div
      data-component="SheetDivider"
      role="separator"
      aria-orientation="horizontal"
      className={className}
      style={{ ...baseStyle, ...style }}
    />
  );
}
