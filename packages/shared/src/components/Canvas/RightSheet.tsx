// packages/shared/src/components/Canvas/RightSheet.tsx
import * as Dialog from "@radix-ui/react-dialog";
import { RiCloseLine } from "@remixicon/react";
import { useDrag } from "@use-gesture/react";
import { animated, useSpring } from "@react-spring/web";
import { useCallback, useRef } from "react";
import { useIntl } from "react-intl";
import { cn } from "../../utils";
import { SheetErrorBoundary } from "./SheetErrorBoundary";
import { SPRING_CONFIGS, DISMISS_VELOCITY_THRESHOLD } from "./springConfig";

export interface RightSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  /**
   * Portal container element. When provided, uses absolute positioning
   * bounded to the container (canvas overlay root).
   */
  container?: HTMLElement | null;
}

/**
 * RightSheet — config and alerts panel that slides in from the right edge.
 *
 * Animation: fully spring-driven via react-spring. Radix Dialog with forceMount
 * provides accessibility (focus trap, escape, aria) while springs control
 * the visual transition. Gesture drag-dismiss also uses the same spring.
 */
export function RightSheet({
  open,
  onClose,
  title,
  description,
  children,
  container,
}: RightSheetProps) {
  const isBounded = container !== undefined && container !== null;
  const { formatMessage } = useIntl();
  const closeLabel = formatMessage({ id: "app.common.close" });
  const contentRef = useRef<HTMLDivElement>(null);

  // Single spring drives both open/close slide AND drag gesture.
  // x: 0 = fully open, 100 = fully off-screen right
  const [springs, api] = useSpring(() => ({
    x: open ? 0 : 100,
    overlay: open ? 1 : 0,
    config: SPRING_CONFIGS.sheet,
  }));

  // React to open prop changes
  useSpring({
    x: open ? 0 : 100,
    overlay: open ? 1 : 0,
    config: SPRING_CONFIGS.sheet,
    onChange: ({ value }) => {
      // Sync the main spring API so drag gesture reads correct position
      if (!open && value.x >= 99) {
        api.set({ x: 100, overlay: 0 });
      }
    },
  });

  const bind = useDrag(
    ({ movement: [mx], velocity: [vx], direction: [dx], cancel }) => {
      // Only allow dragging right (positive x)
      if (mx < -20) {
        cancel();
        return;
      }
      if (dx > 0 && vx > DISMISS_VELOCITY_THRESHOLD) {
        onClose();
        return;
      }
      if (mx > 120) {
        onClose();
        return;
      }
      // Convert px drag to percentage of sheet width
      const sheetWidth = contentRef.current?.offsetWidth ?? 400;
      const pct = Math.max(0, (mx / sheetWidth) * 100 * 0.6);
      api.start({ x: pct, immediate: true });
    },
    {
      from: () => [0, 0],
      axis: "x",
      filterTaps: true,
    }
  );

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) onClose();
    },
    [onClose]
  );

  // When closed, hide from pointer events and screen readers
  const isVisuallyHidden = !open && springs.x.get() >= 99;

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal container={container ?? undefined} forceMount>
        {/* Overlay — spring-driven opacity */}
        <Dialog.Overlay forceMount asChild>
          <animated.div
            className={cn(
              isBounded ? "absolute inset-0" : "fixed inset-0",
              isBounded ? "z-[45]" : "z-overlay",
              isBounded && "pointer-events-auto",
              "motion-reduce:transition-none"
            )}
            style={{
              opacity: isBounded ? 0 : springs.overlay,
              backgroundColor: isBounded ? "transparent" : "rgba(10, 10, 10, 0.18)",
              backdropFilter: isBounded
                ? undefined
                : springs.overlay.to((o) => `blur(${o * 4}px)`),
              WebkitBackdropFilter: isBounded
                ? undefined
                : springs.overlay.to((o) => `blur(${o * 4}px)`),
              pointerEvents: open ? "auto" : "none",
            }}
            data-testid="right-sheet-overlay"
          />
        </Dialog.Overlay>

        {/* Content — spring-driven translateX slide via animated.div + asChild */}
        <Dialog.Content asChild forceMount>
          <animated.div
            ref={contentRef}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className={cn(
              isBounded ? "absolute" : "fixed",
              isBounded ? "z-[46]" : "z-modal",
              "flex h-full flex-col rounded-l-xl",
              "focus:outline-none will-change-transform",
              isBounded && "pointer-events-auto",
              "glass-floating",
              "motion-reduce:transition-none"
            )}
            style={{
              top: 0,
              right: 0,
              width: "100%",
              maxWidth: "var(--canvas-right-sheet-width, clamp(320px, 28vw, 480px))",
              paddingBottom: isBounded ? undefined : "env(safe-area-inset-bottom)",
              transform: springs.x.to((x) => `translateX(${x}%)`),
              opacity: springs.x.to((x) => (x > 98 ? 0 : 1)),
              pointerEvents: open ? "auto" : "none",
              visibility: isVisuallyHidden ? "hidden" : "visible",
            }}
            data-testid="right-sheet"
            {...bind()}
          >
          {description ? (
            <Dialog.Description className="sr-only">{description}</Dialog.Description>
          ) : null}

          {/* Header */}
          {title && (
            <div className="flex items-center justify-between border-b border-stroke-soft/80 px-4 py-3">
              <Dialog.Title className="text-lg font-semibold text-text-strong">
                {title}
              </Dialog.Title>
              <Dialog.Close asChild>
                <button
                  type="button"
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-lg",
                    "text-text-soft transition-colors hover:bg-bg-soft",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-base focus-visible:ring-offset-2"
                  )}
                  aria-label={closeLabel}
                  data-testid="right-sheet-close"
                >
                  <RiCloseLine className="h-5 w-5" />
                </button>
              </Dialog.Close>
            </div>
          )}

          {!title && (
            <div className="flex px-4 pt-3 justify-end">
              <Dialog.Close asChild>
                <button
                  type="button"
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-lg",
                    "text-text-soft transition-colors hover:bg-bg-soft",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-base focus-visible:ring-offset-2"
                  )}
                  aria-label={closeLabel}
                  data-testid="right-sheet-close"
                >
                  <RiCloseLine className="h-5 w-5" />
                </button>
              </Dialog.Close>
            </div>
          )}

          {/* Body */}
          <div className="flex-1 overflow-y-auto">
            <SheetErrorBoundary onClose={onClose}>{children}</SheetErrorBoundary>
          </div>
          </animated.div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
