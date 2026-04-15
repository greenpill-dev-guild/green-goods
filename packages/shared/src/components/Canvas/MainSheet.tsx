import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type MutableRefObject,
  type ReactNode,
} from "react";
import { animated, useSpring } from "@react-spring/web";
import { cn } from "../../utils";
import { SPRING_CONFIGS } from "./springConfig";

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

  const recessionSpring = useSpring({
    scale: isMainSheetReceded ? 0.96 : 1,
    opacity: isMainSheetReceded ? 0.5 : 1,
    blur: isMainSheetReceded ? 3 : 0,
    y: isMainSheetReceded ? 8 : 0,
    config: SPRING_CONFIGS.sheet,
  });

  return (
    <CanvasPortalContext.Provider value={canvasPortalValue}>
      <div
        className={cn("canvas-area-main relative mx-4 mb-4 flex-1 min-h-0 max-w-[1400px] self-center", className)}
        data-testid="main-sheet"
      >
        <div className="relative h-full min-h-0 overflow-hidden rounded-[1.25rem]">
          <animated.div
            className={cn(
              "h-full min-h-0 rounded-[inherit] will-change-[transform,opacity,filter]",
              "glass-surface"
            )}
            style={{
              transform: recessionSpring.scale.to((s) =>
                `translateY(${recessionSpring.y.get()}px) scale(${s})`
              ),
              opacity: recessionSpring.opacity,
              filter: recessionSpring.blur.to(
                (b) => `blur(${b}px) saturate(${b > 0 ? 0.88 : 1}) brightness(${b > 0 ? 0.98 : 1})`
              ),
            }}
            data-testid="main-sheet-content"
          >
            {children}
          </animated.div>
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
