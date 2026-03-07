import { ConfirmDialog, logger, toastService } from "@green-goods/shared";
import { useCallback, useState } from "react";
import { useIntl } from "react-intl";

interface RestoreDraftDialogProps {
  isOpen: boolean;
  draftId: string | null;
  onClose: () => void;
  loadDraft: () => Promise<void>;
  clearDraft: () => Promise<void>;
}

export function RestoreDraftDialog({
  isOpen,
  draftId,
  onClose,
  loadDraft,
  clearDraft,
}: RestoreDraftDialogProps) {
  const { formatMessage } = useIntl();
  const [isLoading, setIsLoading] = useState(false);

  const handleConfirm = useCallback(async () => {
    setIsLoading(true);
    await loadDraft();
    setIsLoading(false);
    onClose();
  }, [loadDraft, onClose]);

  const handleError = useCallback(() => {
    setIsLoading(false);
    onClose();
  }, [onClose]);

  const handleCancel = useCallback(async () => {
    try {
      await clearDraft();
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error("[HypercertWizard] Failed to clear draft on cancel", {
        error: err.message,
        stack: err.stack,
        draftId,
      });
      toastService.show({
        status: "info",
        message: formatMessage({ id: "app.hypercerts.wizard.draft.clear.failed" }),
        duration: 3000,
      });
    }
    onClose();
  }, [clearDraft, draftId, formatMessage, onClose]);

  return (
    <ConfirmDialog
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={handleConfirm}
      onError={handleError}
      title={formatMessage({ id: "app.hypercerts.wizard.restore.title" })}
      description={formatMessage({ id: "app.hypercerts.wizard.restore.description" })}
      confirmLabel={formatMessage({ id: "app.hypercerts.wizard.restore.confirm" })}
      cancelLabel={formatMessage({ id: "app.hypercerts.wizard.restore.cancel" })}
      onCancel={handleCancel}
      variant="warning"
      isLoading={isLoading}
    />
  );
}
