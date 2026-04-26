import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type MutableRefObject,
  type ReactNode,
} from "react";
import { useMediaQuery } from "../../hooks/ui/useMediaQuery";
import { cn } from "../../utils";

interface CanvasPortalContextValue {
  portalTarget: HTMLDivElement | null;
  setOverlayActive: (id: string, active: boolean) => void;
}

const CanvasPortalContext = createContext<CanvasPortalContextValue>({
  portalTarget: null,
  setOverlayActive: () => {},
});

/**
 * Accepts either a mutable ref object (legacy) or a React callback ref.
 * Callback refs let consumers drive component state on mount — critical
 * for the canvas overlay root, which must trigger a re-render when it
 * attaches so sheets can bind `container` on first open.
 */
type OverlayRef = MutableRefObject<HTMLDivElement | null> | ((node: HTMLDivElement | null) => void);

export interface MainSheetProps {
  /** Whether the main sheet is in receded state (sheet is open) */
  isReceded: boolean;
  /** Children rendered inside the main sheet content zone */
  children: ReactNode;
  /** Optional ref to the overlay portal root for shell-owned sheets */
  overlayRef?: OverlayRef;
  className?: string;
}

export function useCanvasPortal() {
  return useContext(CanvasPortalContext);
}

/**
 * MainSheet — the primary content surface that lives inside the admin canvas.
 *
 * Floats above the atmospheric canvas field, bounded between the top axis and nav dock.
 * When a sheet opens, the main sheet recedes with a slightly stronger depth response.
 * Sheets portal into the overlay root so they're bounded to this zone without
 * being clipped by the scrolling content layer.
 *
 * The main sheet has two internal layers:
 * - a transformed content surface that scrolls and recedes
 * - a bounded overlay root that stays crisp above the content surface
 */
export function MainSheet({ isReceded, children, overlayRef, className }: MainSheetProps) {
  const [portalTarget, setPortalTarget] = useState<HTMLDivElement | null>(null);
  const [activeOverlayIds, setActiveOverlayIds] = useState<Set<string>>(() => new Set());
  const prefersReducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");

  const handlePortalTargetRef = useCallback(
    (node: HTMLDivElement | null) => {
      setPortalTarget(node);
      if (typeof overlayRef === "function") {
        overlayRef(node);
      } else if (overlayRef) {
        overlayRef.current = node;
      }
    },
    [overlayRef]
  );

  const setOverlayActive = useCallback((id: string, active: boolean) => {
    setActiveOverlayIds((current) => {
      const next = new Set(current);
      if (active) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }, []);

  const canvasPortalValue = useMemo(
    () => ({
      portalTarget,
      setOverlayActive,
    }),
    [portalTarget, setOverlayActive]
  );

  const isMainSheetReceded = isReceded || activeOverlayIds.size > 0;
  const mainSheetState = isMainSheetReceded ? "receded" : "resting";
  const overlayState = activeOverlayIds.size > 0 ? "active" : "idle";

  return (
    <CanvasPortalContext.Provider value={canvasPortalValue}>
      <div
        className={cn("canvas-area-main relative flex-1 min-h-0", className)}
        style={{
          width: "min(calc(100% - 2rem), 1400px)",
          justifySelf: "center",
          marginBottom: "1rem",
        }}
        data-component="MainSheet"
        data-slot="root"
        data-state={mainSheetState}
        data-testid="main-sheet"
      >
        <div
          className="relative h-full min-h-0 overflow-hidden rounded-[1.25rem]"
          data-slot="frame"
        >
          <div
            className={cn(
              "h-full min-h-0 rounded-[inherit] will-change-[transform,opacity,filter]",
              "glass-surface"
            )}
            style={{
              transition: prefersReducedMotion
                ? "none"
                : [
                    "opacity var(--spring-spatial-duration) var(--spring-spatial-easing)",
                    "transform var(--spring-spatial-duration) var(--spring-spatial-easing)",
                    "filter var(--spring-spatial-duration) var(--spring-spatial-easing)",
                  ].join(", "),
              transform: isMainSheetReceded ? "translateY(var(--canvas-recede-y, 8px))" : "none",
              opacity: isMainSheetReceded ? "var(--canvas-opacity-receded, 0.95)" : 1,
              filter: isMainSheetReceded ? "blur(var(--canvas-blur-receded, 1.5px))" : "none",
            }}
            data-component="MainSheet"
            data-slot="surface"
            data-state={mainSheetState}
            data-testid="main-sheet-content"
          >
            {children}
          </div>
        </div>

        <div
          ref={handlePortalTargetRef}
          className="pointer-events-none absolute inset-0 z-raised overflow-hidden rounded-[1.25rem]"
          data-component="MainSheet"
          data-slot="overlay-root"
          data-state={overlayState}
          data-testid="main-sheet-overlay-root"
        />
      </div>
    </CanvasPortalContext.Provider>
  );
}
