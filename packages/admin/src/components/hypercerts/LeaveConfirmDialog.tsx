import { ConfirmDialog } from "@green-goods/shared";
import { useIntl } from "react-intl";

interface LeaveConfirmDialogProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function LeaveConfirmDialog({ isOpen, onConfirm, onCancel }: LeaveConfirmDialogProps) {
  const { formatMessage } = useIntl();

  return (
    <ConfirmDialog
      isOpen={isOpen}
      onClose={onCancel}
      onConfirm={onConfirm}
      title={formatMessage({ id: "app.hypercerts.wizard.leaveConfirm.title" })}
      description={formatMessage({ id: "app.hypercerts.wizard.unsavedChanges" })}
      confirmLabel={formatMessage({ id: "app.hypercerts.wizard.leaveConfirm.confirm" })}
      cancelLabel={formatMessage({ id: "app.hypercerts.wizard.leaveConfirm.cancel" })}
      variant="warning"
    />
  );
}
