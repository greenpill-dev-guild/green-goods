import type { ReactNode } from "react";
import { cn } from "../../utils";

export interface MainSheetProps {
  /** Children rendered inside the main sheet content zone */
  children: ReactNode;
  className?: string;
}

/**
 * MainSheet — the primary content surface that lives inside the admin canvas.
 *
 * Floats above the atmospheric canvas field, bounded between the top axis and
 * nav dock. It stays put when side sheets open — the sheets' own scrim and
 * elevation carry the depth (QA refinement pass: the previous
 * blur/dim/translate recession read as an accidental shift and was removed).
 * Sheets portal into CanvasLayout's dedicated sheet layer, not into this
 * surface, so the canvas stays crisp and readable behind them.
 */
export function MainSheet({ children, className }: MainSheetProps) {
  return (
    <div
      className={cn("canvas-area-main relative flex-1 min-h-0 w-full", className)}
      style={{
        marginBottom: "1rem",
      }}
      data-component="MainSheet"
      data-slot="root"
      data-state="resting"
      data-testid="main-sheet"
    >
      <div className="relative h-full min-h-0 overflow-hidden" data-slot="frame">
        <div
          className={cn("h-full min-h-0", "glass-surface")}
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
