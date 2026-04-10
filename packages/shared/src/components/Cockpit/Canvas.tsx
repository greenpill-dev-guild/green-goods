import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type MutableRefObject,
  type ReactNode,
} from "react";
import { cn } from "../../utils";

interface CanvasPortalContextValue {
  portalTarget: HTMLDivElement | null;
  setOverlayActive: (id: string, active: boolean) => void;
}

const CanvasPortalContext = createContext<CanvasPortalContextValue>({
  portalTarget: null,
  setOverlayActive: () => {},
});

export interface CanvasProps {
  /** Whether the canvas is in receded state (sheet is open) */
  isReceded: boolean;
  /** Children rendered inside the canvas content zone */
  children: ReactNode;
  /** Optional ref to the overlay portal root for shell-owned sheets */
  overlayRef?: MutableRefObject<HTMLDivElement | null>;
  className?: string;
}

export function useCanvasPortal() {
  return useContext(CanvasPortalContext);
}

/**
 * Canvas — The main content surface in the Three-Body System.
 *
 * Floats above the ground (Z2), bounded between top axis and nav bar.
 * When a sheet opens, the canvas recedes: scale(0.97) + opacity(0.85) + blur(2px).
 * Sheets portal into the overlay root so they're bounded to this zone without
 * being clipped by the scrolling content layer.
 *
 * The canvas has two internal layers:
 * - a transformed content surface that scrolls and recedes
 * - a bounded overlay root that stays crisp above the content surface
 */
export function Canvas({ isReceded, children, overlayRef, className }: CanvasProps) {
  const [portalTarget, setPortalTarget] = useState<HTMLDivElement | null>(null);
  const [activeOverlayIds, setActiveOverlayIds] = useState<Set<string>>(() => new Set());

  const handlePortalTargetRef = useCallback(
    (node: HTMLDivElement | null) => {
      setPortalTarget(node);
      if (overlayRef) {
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

  const isCanvasReceded = isReceded || activeOverlayIds.size > 0;

  return (
    <CanvasPortalContext.Provider value={canvasPortalValue}>
      <div
        className={cn("cockpit-canvas-frame relative flex-1 min-h-0", className)}
        data-testid="canvas"
      >
        <div className="relative h-full min-h-0 overflow-hidden rounded-[1.25rem]">
          <div
            className={cn(
              "h-full min-h-0 rounded-[inherit] bg-bg-white will-change-[transform,opacity,filter]"
            )}
            style={{
              boxShadow: "var(--edge-rest), 0 1px 3px rgba(0, 0, 0, 0.04)",
              transform: isCanvasReceded
                ? "translateY(4px) scale(var(--canvas-scale-receded))"
                : "translateY(0) scale(1)",
              opacity: isCanvasReceded ? "var(--canvas-opacity-receded)" : "1",
              filter: isCanvasReceded ? "blur(var(--canvas-blur-receded)) saturate(0.92)" : "none",
              transitionProperty: "transform, opacity, filter",
              transitionDuration: "var(--spring-spatial-duration, 300ms)",
              transitionTimingFunction:
                "var(--spring-spatial-easing, cubic-bezier(0.16, 1, 0.3, 1))",
            }}
            data-testid="canvas-content"
          >
            {children}
          </div>
        </div>

        <div
          ref={handlePortalTargetRef}
          className="pointer-events-none absolute inset-0 z-raised overflow-hidden rounded-[1.25rem]"
          data-testid="canvas-overlay-root"
        />
      </div>
    </CanvasPortalContext.Provider>
  );
}
