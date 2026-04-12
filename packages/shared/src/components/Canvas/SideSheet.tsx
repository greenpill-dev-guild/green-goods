import * as Dialog from "@radix-ui/react-dialog";
import { RiCloseLine } from "@remixicon/react";
import { useIntl } from "react-intl";
import { cn } from "../../utils";
import { SheetErrorBoundary } from "./SheetErrorBoundary";

const SPRING_EASING = "cubic-bezier(0.22, 1, 0.36, 1)";

export interface SideSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  /** Width in px, default 400 */
  width?: number;
  /** Which edge the sheet opens from, default "right" */
  side?: "left" | "right";
  /**
   * Portal container element. When provided, the sheet portals into this
   * element instead of document.body, and uses absolute positioning
   * (bounded to the container). Used by the canvas shell to scope
   * sheets within the main-sheet content zone.
   *
   * When null/undefined, falls back to default Radix behavior (body portal).
   */
  container?: HTMLElement | null;
}

/**
 * Side sheet that opens from the left or right edge on desktop.
 *
 * Built on Radix Dialog for accessible focus trapping, Escape-to-close,
 * and overlay click dismiss. Content is wrapped in a SheetErrorBoundary
 * so errors never propagate to the parent toolbar.
 *
 * Use `side="left"` for creation flows (work submission, assessments).
 * Use `side="right"` (default) for detail/review panels.
 *
 * Animations use spring easing and respect `prefers-reduced-motion`.
 */
export function SideSheet({
  open,
  onClose,
  title,
  description,
  children,
  width = 400,
  side = "right",
  container,
}: SideSheetProps) {
  const isBounded = container !== undefined && container !== null;
  const { formatMessage } = useIntl();
  const closeLabel = formatMessage({ id: "app.common.close" });

  const isLeft = side === "left";

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal container={container ?? undefined}>
        {/* Overlay — no dark scrim in bounded mode (depth comes from main-sheet recession) */}
        <Dialog.Overlay
          className={cn(
            isBounded ? "absolute inset-0" : "fixed inset-0",
            isBounded
              ? "z-[45] bg-transparent"
              : "z-overlay bg-neutral-950/18 backdrop-blur-sm",
            isBounded && "pointer-events-auto",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "duration-[260ms] motion-reduce:duration-0"
          )}
          style={{
            animationTimingFunction: SPRING_EASING,
          }}
          data-testid="side-sheet-overlay"
        />

        {/* Content panel */}
        <Dialog.Content
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className={cn(
            isBounded ? "absolute top-0" : "fixed top-0",
            isBounded ? "z-[46]" : "z-modal",
            "flex h-full flex-col",
            "glass-floating focus:outline-none",
            "will-change-transform",
            isBounded && "pointer-events-auto",
            // Position + rounding per spec: 20px concentric radius
            isLeft
              ? "left-0 rounded-r-xl border-l-0"
              : "right-0 rounded-l-xl border-r-0",
            // Slide animation direction
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            isLeft
              ? "data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left"
              : "data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "duration-[var(--spring-medium-duration,300ms)]",
            // Reduce motion: disable animations
            "motion-reduce:duration-0"
          )}
          style={{
            width: `min(${width}px, 100vw)`,
            animationTimingFunction: SPRING_EASING,
            paddingBottom: isBounded ? undefined : "env(safe-area-inset-bottom)",
            left: isLeft ? 0 : undefined,
            right: isLeft ? undefined : 0,
            boxShadow: "var(--elevation-4)",
          }}
          data-testid="side-sheet"
        >
          {description ? (
            <Dialog.Description className="sr-only">{description}</Dialog.Description>
          ) : null}

          {/* Header */}
          {title && (
            <div
              className={cn(
                "flex items-center justify-between border-b border-stroke-soft/80 px-4 py-3",
                isLeft && "flex-row-reverse"
              )}
            >
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
                  data-testid="side-sheet-close"
                >
                  <RiCloseLine className="h-5 w-5" />
                </button>
              </Dialog.Close>
            </div>
          )}

          {/* Close button when no title */}
          {!title && (
            <div className={cn("flex px-4 pt-3", isLeft ? "justify-start" : "justify-end")}>
              <Dialog.Close asChild>
                <button
                  type="button"
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-lg",
                    "text-text-soft transition-colors hover:bg-bg-soft",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-base focus-visible:ring-offset-2"
                  )}
                  aria-label={closeLabel}
                  data-testid="side-sheet-close"
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
