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

export interface MainSheetProps {
  /** Whether the main sheet is in receded state (sheet is open) */
  isReceded: boolean;
  /** Children rendered inside the main sheet content zone */
  children: ReactNode;
  /** Optional ref to the overlay portal root for shell-owned sheets */
  overlayRef?: MutableRefObject<HTMLDivElement | null>;
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

  const isMainSheetReceded = isReceded || activeOverlayIds.size > 0;

  return (
    <CanvasPortalContext.Provider value={canvasPortalValue}>
      <div
        className={cn("canvas-main-sheet-frame relative flex-1 min-h-0", className)}
        data-testid="main-sheet"
      >
        <div className="relative h-full min-h-0 overflow-hidden rounded-[1.25rem]">
          <div
            className={cn(
              "h-full min-h-0 rounded-[inherit] will-change-[transform,opacity,filter]"
            )}
            style={{
              background: "linear-gradient(180deg, rgb(var(--neutral-0)) 0%, rgb(var(--neutral-50) / 0.5) 100%)",
              boxShadow:
                "inset 0 0 0 1px rgba(255,255,255,0.65), 0 18px 46px rgba(21, 16, 10, 0.14)",
              transform: isMainSheetReceded
                ? "translateY(8px) scale(var(--canvas-scale-receded))"
                : "translateY(0) scale(1)",
              opacity: isMainSheetReceded ? "var(--canvas-opacity-receded)" : "1",
              filter: isMainSheetReceded
                ? "blur(var(--canvas-blur-receded)) saturate(0.88) brightness(0.98)"
                : "none",
              transitionProperty: "transform, opacity, filter",
              transitionDuration: "var(--spring-spatial-slow-duration, 420ms)",
              transitionTimingFunction:
                "var(--spring-spatial-easing, cubic-bezier(0.16, 1, 0.3, 1))",
            }}
            data-testid="main-sheet-content"
          >
            {children}
          </div>
        </div>

        <div
          ref={handlePortalTargetRef}
          className="pointer-events-none absolute inset-0 z-raised overflow-hidden rounded-[1.25rem]"
          data-testid="main-sheet-overlay-root"
        />
      </div>
    </CanvasPortalContext.Provider>
  );
}
