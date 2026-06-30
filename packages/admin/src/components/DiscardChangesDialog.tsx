import { useIntl } from "react-intl";
import { AdminConfirmDialog } from "@/components/AdminDialog";

interface DiscardChangesDialogProps {
  /** Whether the confirm is showing — pair with `useDirtyClose().confirmOpen`. */
  open: boolean;
  /** "Keep editing" — pair with `useDirtyClose().cancelClose`. */
  onKeepEditing: () => void;
  /** "Discard" — pair with `useDirtyClose().confirmClose`. */
  onDiscard: () => void;
}

/**
 * The shared confirm-before-discard prompt for admin flow dialogs. Binds the
 * generic `app.admin.flow.discardChanges.*` copy to `AdminConfirmDialog` so
 * every flow (Submit Work, Create Assessment, Create Hypercert, …) shows the
 * same warning. Drive it with `useDirtyClose` from `@green-goods/shared`.
 */
export function DiscardChangesDialog({
  open,
  onKeepEditing,
  onDiscard,
}: DiscardChangesDialogProps) {
  const { formatMessage } = useIntl();
  return (
    <AdminConfirmDialog
      isOpen={open}
      onClose={onKeepEditing}
      onConfirm={onDiscard}
      title={formatMessage({
        id: "app.admin.flow.discardChanges.title",
        defaultMessage: "Discard changes?",
      })}
      description={formatMessage({
        id: "app.admin.flow.discardChanges.description",
        defaultMessage: "Any unsaved changes will be lost.",
      })}
      confirmLabel={formatMessage({
        id: "app.admin.flow.discardChanges.confirm",
        defaultMessage: "Discard",
      })}
      cancelLabel={formatMessage({
        id: "app.admin.flow.discardChanges.cancel",
        defaultMessage: "Keep editing",
      })}
      variant="warning"
    />
  );
}
