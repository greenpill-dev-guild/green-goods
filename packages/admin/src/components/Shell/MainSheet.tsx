import type { ReactNode } from "react";
import { cn } from "@green-goods/shared";

// ----------------------------------------------------------------------------
// Admin fork of the shared Canvas MainSheet (Cockpit M3, finished — 1a).
//
// The content zone is transparent: the linen canvas and its faint tone wash
// are the page ground, and route content (headers, tab rail, cards) sits
// directly on it. The previous glass treatment lived in shared JSX and was
// neutralized remotely from admin-m3-overrides.css — the fork simply owns the
// transparent surface.
// ----------------------------------------------------------------------------

export interface MainSheetProps {
  /** Children rendered inside the main sheet content zone */
  children: ReactNode;
  className?: string;
}

/**
 * MainSheet — the primary content zone between the top axis and nav dock.
 *
 * It stays put when side sheets open — the sheets' own scrim and elevation
 * carry the depth. Sheets portal into CanvasLayout's dedicated sheet layer,
 * not into this surface, so the canvas stays crisp and readable behind them.
 */
export function MainSheet({ children, className }: MainSheetProps) {
  return (
    <div
      className={cn("canvas-area-main relative min-h-0 w-full flex-1", className)}
      style={{
        marginBottom: "var(--admin-main-sheet-bottom-gap, 1rem)",
      }}
      data-component="MainSheet"
      data-slot="root"
      data-state="resting"
      data-testid="main-sheet"
    >
      <div className="relative h-full min-h-0 overflow-hidden" data-slot="frame">
        <div
          className="h-full min-h-0 bg-transparent"
          data-component="MainSheet"
          data-slot="surface"
          data-state="resting"
          data-testid="main-sheet-content"
        >
          {children}
        </div>
      </div>
    </div>
  );
}
