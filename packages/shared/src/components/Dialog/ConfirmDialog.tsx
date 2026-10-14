import { SheetActions, type SheetActionsProps } from "./SheetActions";
import { SheetHeader } from "./SheetHeader";
import * as Dialog from "@radix-ui/react-dialog";
import { useIntl } from "react-intl";
import { useSheetPresence } from "../../hooks/ui/useSheetPresence";
import { logger } from "../../modules/app/logger";
import {
  dialogOverlayClassName,
  dialogOverlayStyle,
  dialogSurfaceStyle,
  useRendersAsSheet,
} from "./dialogChrome";
import { PwaSheet } from "./PwaSheet";

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  /** Optional handler for explicit cancel action (not overlay/escape close). */
  onCancel?: () => void | Promise<void>;
  /**
   * Optional error handler for when onConfirm throws.
   * If not provided, errors will be re-thrown.
   */
  onError?: (error: unknown) => void;
  /**
   * Optional error handler for when onCancel throws.
   * If not provided, errors will be re-thrown (matching onError behavior).
   */
  onCancelError?: (error: unknown) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /**
   * `warning` and `danger` fill the confirm with the warning or error color
   * and announce the dialog as an alertdialog. The header carries no icon
   * (DL-028): the tone lives in the primary action and the role.
   */
  variant?: "default" | "warning" | "danger";
  isLoading?: boolean;
}

/**
 * A confirmation dialog using Radix Dialog for accessibility.
 * Centered at 640px and wider; below that it renders the shared PwaSheet
 * bottom sheet, so drafts, deletes, and every other confirm share one
 * surface in the installed app. Both presentations render the shared
 * header (`SheetHeader`, DL-028) and their buttons through the shared
 * action bar (`SheetActions`, DL-016): stacked with the confirm on top in
 * the sheet, one right-aligned row when centered.
 * Replaces window.confirm() for consistent UX across the application.
 */
export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  onCancel,
  onError,
  onCancelError,
  title,
  description,
  confirmLabel,
  cancelLabel,
  variant = "default",
  isLoading = false,
}: ConfirmDialogProps) {
  const { formatMessage } = useIntl();
  const rendersAsSheet = useRendersAsSheet();
  // The sheet registers itself; the centered surface registers here so the
  // installed app's AppBar also steps aside on wide screens (DL-015).
  useSheetPresence(isOpen && !rendersAsSheet);
  const resolvedConfirmLabel = confirmLabel ?? formatMessage({ id: "app.common.confirm" });
  const resolvedCancelLabel = cancelLabel ?? formatMessage({ id: "app.common.cancel" });
  const resolvedCloseLabel = formatMessage({ id: "app.common.close" });
  /**
   * Handle confirmation with error handling.
   * If onError is provided, it will be called with the error.
   * Otherwise, errors are re-thrown.
   */
  const handleConfirm = async () => {
    try {
      await onConfirm();
    } catch (error) {
      logger.error("[ConfirmDialog] handleConfirm failed", {
        title,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      if (onError) {
        onError(error);
      } else {
        throw error;
      }
    }
  };

  const handleCancel = async () => {
    if (!onCancel) return;
    try {
      await onCancel();
    } catch (error) {
      logger.error("[ConfirmDialog] handleCancel failed", {
        title,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      if (onCancelError) {
        onCancelError(error);
      } else {
        throw error;
      }
    }
  };

  const isDestructive = variant === "danger" || variant === "warning";

  const actions: SheetActionsProps = {
    primary: {
      label: resolvedConfirmLabel,
      onClick: handleConfirm,
      loading: isLoading,
      tone: variant,
    },
    secondary: {
      label: resolvedCancelLabel,
      disabled: isLoading,
      onClick: () => {
        void handleCancel();
        onClose();
      },
    },
  };

  if (rendersAsSheet) {
    return (
      <PwaSheet
        open={isOpen}
        onClose={onClose}
        role={isDestructive ? "alertdialog" : "dialog"}
        title={title}
        description={description}
        closeLabel={resolvedCloseLabel}
        preventClose={isLoading}
        testId="confirm-dialog"
        actions={actions}
      />
    );
  }

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open: boolean) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay
          data-component="ConfirmDialog"
          data-slot="overlay"
          className={dialogOverlayClassName}
          style={dialogOverlayStyle}
          data-testid="confirm-dialog-overlay"
        />
        <Dialog.Content
          data-component="ConfirmDialog"
          data-slot="surface"
          role={isDestructive ? "alertdialog" : "dialog"}
          className="fixed bottom-0 left-1/2 z-modal w-full max-w-none -translate-x-1/2 overflow-hidden border border-stroke-soft-200 bg-[var(--color-material-solid)] shadow-[var(--shadow-float)] focus:outline-none sm:bottom-auto sm:top-1/2 sm:max-w-md sm:-translate-y-1/2"
          style={dialogSurfaceStyle}
          data-testid="confirm-dialog"
          onPointerDownOutside={(e: Event) => {
            if (isLoading) e.preventDefault();
          }}
          onEscapeKeyDown={(e: KeyboardEvent) => {
            if (isLoading) e.preventDefault();
          }}
        >
          <SheetHeader
            title={title}
            description={description}
            titleAs={Dialog.Title}
            descriptionAs={Dialog.Description}
            closeLabel={resolvedCloseLabel}
            onClose={onClose}
            closeDisabled={isLoading}
            closeTestId="confirm-dialog-close"
            standalone
          />
          <SheetActions {...actions} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
