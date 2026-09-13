import { SheetActions, type SheetActionsProps } from "./SheetActions";
import * as Dialog from "@radix-ui/react-dialog";
import { RiCloseLine } from "@remixicon/react";
import type { ReactNode } from "react";
import { useIntl } from "react-intl";
import { useSheetPresence } from "../../hooks/ui/useSheetPresence";
import { cn } from "../../utils/styles/cn";
import {
  dialogOverlayClassName,
  dialogOverlayStyle,
  dialogSurfaceStyle,
  useRendersAsSheet,
} from "./dialogChrome";
import { PwaSheet, type SheetSize } from "./PwaSheet";

export interface DialogShellProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  iconContainerClassName?: string;
  children?: ReactNode;
  /**
   * The dialog's actions, pinned under the body in the shared action bar
   * (DL-016): stacked below 640px, one right-aligned row from 640px.
   */
  actions?: SheetActionsProps;
  /** Width of the centered surface at `sm` and above. */
  size?: "md" | "lg" | "xl" | "2xl";
  /** Height tier of the narrow-viewport sheet (DL-014). Defaults to `compact`. */
  sheetSize?: SheetSize;
  className?: string;
  bodyClassName?: string;
  /** Centered surface only; the narrow-viewport sheet owns its own header. */
  headerClassName?: string;
  /** Centered surface only; the narrow-viewport sheet owns its own header. */
  descriptionClassName?: string;
  hideCloseButton?: boolean;
  /** When true, prevents close via overlay click or Escape — useful during in-flight mutations. */
  preventClose?: boolean;
}

const dialogShellSizeClasses: Record<NonNullable<DialogShellProps["size"]>, string> = {
  md: "sm:max-w-md",
  lg: "sm:max-w-lg",
  xl: "sm:max-w-2xl",
  "2xl": "sm:max-w-4xl lg:max-w-5xl",
};

const dialogShellIconContainerClassName =
  "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-bg-soft text-text-sub sm:h-10 sm:w-10";

export function DialogShell({
  open,
  onOpenChange,
  title,
  description,
  icon,
  iconContainerClassName,
  children,
  actions,
  size = "md",
  sheetSize = "compact",
  className,
  bodyClassName,
  headerClassName,
  descriptionClassName,
  hideCloseButton = false,
  preventClose = false,
}: DialogShellProps) {
  const { formatMessage } = useIntl();
  const rendersAsSheet = useRendersAsSheet();
  // The sheet registers itself; the centered surface registers here so the
  // installed app's AppBar also steps aside on wide screens (DL-015).
  useSheetPresence(open && !rendersAsSheet);
  const iconContainer = icon ? (
    <div className={cn(dialogShellIconContainerClassName, iconContainerClassName)}>{icon}</div>
  ) : null;

  if (rendersAsSheet) {
    return (
      <PwaSheet
        open={open}
        onClose={() => onOpenChange(false)}
        size={sheetSize}
        title={title}
        description={description}
        icon={iconContainer ?? undefined}
        closeLabel={formatMessage({ id: "app.common.close" })}
        hideCloseButton={hideCloseButton}
        preventClose={preventClose}
        panelClassName={className}
        testId="dialog-shell"
        actions={actions}
      >
        {bodyClassName ? <div className={bodyClassName}>{children}</div> : children}
      </PwaSheet>
    );
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          data-component="DialogShell"
          data-slot="overlay"
          className={dialogOverlayClassName}
          style={dialogOverlayStyle}
        />
        <Dialog.Content
          data-component="DialogShell"
          data-slot="surface"
          className={cn(
            "fixed z-modal w-full max-w-[calc(100vw-2rem)] max-h-[90vh] overflow-hidden bg-[var(--color-material-solid)] border border-stroke-soft-200 shadow-[var(--shadow-float)] focus:outline-none bottom-0 left-1/2 -translate-x-1/2 sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2",
            dialogShellSizeClasses[size],
            className
          )}
          style={dialogSurfaceStyle}
          data-has-actions={actions ? "" : undefined}
          onPointerDownOutside={(event) => {
            if (preventClose) event.preventDefault();
          }}
          onEscapeKeyDown={(event) => {
            if (preventClose) event.preventDefault();
          }}
        >
          <div
            className={cn(
              "sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-stroke-soft px-4 py-3 sm:px-6 sm:py-4",
              headerClassName
            )}
          >
            <div className="flex min-w-0 flex-1 items-start gap-3">
              {iconContainer}
              <div className="min-w-0 flex-1">
                <Dialog.Title className="truncate text-title-lg font-semibold text-text-strong">
                  {title}
                </Dialog.Title>
                {description && (
                  <Dialog.Description
                    className={cn("text-body-lg text-text-soft", descriptionClassName)}
                  >
                    {description}
                  </Dialog.Description>
                )}
              </div>
            </div>
            {!hideCloseButton && (
              <Dialog.Close asChild>
                <button
                  type="button"
                  data-slot="close"
                  className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-text-soft transition hover:bg-bg-soft active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-base focus-visible:ring-offset-2"
                  aria-label={formatMessage({ id: "app.common.close" })}
                >
                  <RiCloseLine className="h-5 w-5" />
                </button>
              </Dialog.Close>
            )}
          </div>

          <div
            data-component="DialogShell"
            data-slot="body"
            data-scroll-edge={actions ? "bottom" : undefined}
            className={cn(
              !actions && "max-h-[calc(90vh-80px)]",
              "overflow-y-auto p-4 sm:p-6",
              bodyClassName
            )}
          >
            {children}
          </div>
          {actions ? <SheetActions {...actions} /> : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
