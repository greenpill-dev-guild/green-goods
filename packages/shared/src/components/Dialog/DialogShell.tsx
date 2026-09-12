import * as Dialog from "@radix-ui/react-dialog";
import { RiCloseLine } from "@remixicon/react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { useIntl } from "react-intl";
import { cn } from "../../utils/styles/cn";
import {
  dialogOverlayClassName,
  dialogOverlayStyle,
  dialogSurfaceStyle,
  useRendersAsSheet,
} from "./dialogChrome";
import { PwaSheet } from "./PwaSheet";

export interface DialogShellProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  iconContainerClassName?: string;
  children: ReactNode;
  size?: "md" | "lg" | "xl" | "2xl";
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
  size = "md",
  className,
  bodyClassName,
  headerClassName,
  descriptionClassName,
  hideCloseButton = false,
  preventClose = false,
}: DialogShellProps) {
  const { formatMessage } = useIntl();
  const rendersAsSheet = useRendersAsSheet();
  const iconContainer = icon ? (
    <div className={cn(dialogShellIconContainerClassName, iconContainerClassName)}>{icon}</div>
  ) : null;

  if (rendersAsSheet) {
    return createPortal(
      <PwaSheet
        open={open}
        onClose={() => onOpenChange(false)}
        title={title}
        description={description}
        icon={iconContainer ?? undefined}
        closeLabel={formatMessage({ id: "app.common.close" })}
        hideCloseButton={hideCloseButton}
        preventClose={preventClose}
        panelClassName={className}
        testId="dialog-shell"
      >
        {bodyClassName ? <div className={bodyClassName}>{children}</div> : children}
      </PwaSheet>,
      document.body
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

          <div className={cn("max-h-[calc(90vh-80px)] overflow-y-auto p-4 sm:p-6", bodyClassName)}>
            {children}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
