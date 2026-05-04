import type { CSSProperties, ReactNode } from "react";

export interface SheetFooterProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

const baseStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  padding: "12px 16px",
  borderTop: "1px solid var(--hairline)",
  background: "var(--surface-raised)",
  flexShrink: 0,
};

/**
 * SheetFooter — bottom slot for LeftSheet / RightSheet (Save / Cancel /
 * Sign out actions). Handoff anatomy: `12px 16px` padding, hairline top
 * border, `gap: 8px`.
 */
export function SheetFooter({ children, className, style }: SheetFooterProps) {
  return (
    <div data-component="SheetFooter" className={className} style={{ ...baseStyle, ...style }}>
      {children}
    </div>
  );
}
