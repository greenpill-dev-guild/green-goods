import { SheetActions, type SheetActionsProps } from "./SheetActions";
import { SheetHeader } from "./SheetHeader";
import * as Dialog from "@radix-ui/react-dialog";
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
  /** Centered surface only: extra classes on the shared header row. */
  headerClassName?: string;
  /** Centered surface only: extra classes on the shared header's description. */
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

/**
 * The shared dialog shell. Below 640px it renders the PwaSheet bottom sheet;
 * from 640px it is a centered Radix surface. Both render the one sheet
 * header (`SheetHeader`, DL-028) and pin their actions in the shared bar
 * (DL-016).
 */
export function DialogShell({
  open,
  onOpenChange,
  title,
  description,
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
  const closeLabel = formatMessage({ id: "app.common.close" });

  if (rendersAsSheet) {
    return (
      <PwaSheet
        open={open}
        onClose={() => onOpenChange(false)}
        size={sheetSize}
        title={title}
        description={description}
        closeLabel={closeLabel}
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
            "fixed z-modal w-full max-w-[calc(100vw-2rem)] overflow-hidden bg-[var(--color-material-solid)] border border-stroke-soft-200 shadow-[var(--shadow-float)] focus:outline-none bottom-0 left-1/2 -translate-x-1/2 sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2",
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
          <SheetHeader
            title={title}
            description={description}
            titleAs={Dialog.Title}
            descriptionAs={Dialog.Description}
            closeLabel={closeLabel}
            onClose={() => onOpenChange(false)}
            closeDisabled={preventClose}
            hideCloseButton={hideCloseButton}
            className={headerClassName}
            descriptionClassName={descriptionClassName}
            standalone
          />
          <div
            data-component="DialogShell"
            data-slot="body"
            data-scroll-edge={actions ? "both" : "top"}
            className={cn("overflow-y-auto p-4 sm:p-6", bodyClassName)}
          >
            {children}
          </div>
          {actions ? <SheetActions {...actions} /> : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
