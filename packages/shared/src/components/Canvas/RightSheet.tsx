// packages/shared/src/components/Canvas/RightSheet.tsx
import * as Dialog from "@radix-ui/react-dialog";
import { RiCloseLine } from "@remixicon/react";
import { useDrag } from "@use-gesture/react";
import { useSpring } from "@react-spring/web";
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
 * Used for: Notifications, Settings, Account (as tabbed panel).
 * Width: viewport-driven via CSS clamp (set by grid column).
 * Animation: react-spring physics with gesture-driven drag-dismiss.
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

  const [springs, api] = useSpring(() => ({
    x: open ? 0 : 100,
    opacity: open ? 1 : 0,
    config: SPRING_CONFIGS.sheet,
  }));

  useSpring({
    x: open ? 0 : 100,
    opacity: open ? 1 : 0,
    config: SPRING_CONFIGS.sheet,
    onChange: () => {},
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
      api.start({ x: Math.max(0, mx * 0.6), immediate: true });
    },
    {
      from: () => [springs.x.get(), 0],
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

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal container={container ?? undefined}>
        <Dialog.Overlay
          className={cn(
            isBounded ? "absolute inset-0" : "fixed inset-0",
            isBounded ? "z-[45] bg-transparent" : "z-overlay bg-neutral-950/18 backdrop-blur-sm",
            isBounded && "pointer-events-auto",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "duration-[260ms] motion-reduce:duration-0"
          )}
          data-testid="right-sheet-overlay"
        />

        <Dialog.Content
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
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "duration-[300ms] motion-reduce:duration-0"
          )}
          style={{
            top: 0,
            right: 0,
            width: "100%",
            maxWidth: "var(--canvas-right-sheet-width, clamp(320px, 28vw, 480px))",
            paddingBottom: isBounded ? undefined : "env(safe-area-inset-bottom)",
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
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
