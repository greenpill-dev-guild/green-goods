import { PwaSheet } from "@green-goods/shared/components/Dialog/PwaSheet";
import { createPortal } from "react-dom";
import { useState } from "react";
import { useIntl } from "react-intl";
import { Button } from "@/components/Actions";

interface DraftDialogProps {
  isOpen: boolean;
  onContinue: () => void | Promise<void>;
  onStartFresh: () => void | Promise<void>;
  onClose?: () => void;
  legacyRecovery?: boolean;
  imageCount: number;
}

/**
 * Resume / recover / discard prompt for a saved work draft. Renders the shared
 * PwaSheet with its built-in header, the same sheet the delete confirmation
 * and every other confirm-style action use in the installed app.
 */
export function DraftDialog({
  isOpen,
  onContinue,
  onStartFresh,
  onClose,
  legacyRecovery = false,
}: DraftDialogProps) {
  const intl = useIntl();
  const [pending, setPending] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [failed, setFailed] = useState(false);
  const title = intl.formatMessage({
    id: confirmDiscard
      ? "app.garden.draft.discardTitle"
      : legacyRecovery
        ? "app.garden.draft.recoverTitle"
        : "app.garden.draft.title",
  });
  const description = intl.formatMessage({
    id: confirmDiscard
      ? "app.garden.draft.discardDescription"
      : legacyRecovery
        ? "app.garden.draft.recoverDescription"
        : "app.garden.draft.resumeDescription",
  });
  const run = async (action: () => void | Promise<void>) => {
    setPending(true);
    setFailed(false);
    try {
      await action();
      setConfirmDiscard(false);
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
    }
  };
  const close = () => {
    if (pending) return;
    setConfirmDiscard(false);
    setFailed(false);
    onClose?.();
  };
  return createPortal(
    <PwaSheet
      open={isOpen}
      onClose={close}
      title={title}
      description={description}
      closeLabel={intl.formatMessage({ id: "app.garden.draft.close" })}
      preventClose={pending}
      testId="draft-dialog"
    >
      {failed && <p role="alert">{intl.formatMessage({ id: "app.garden.draft.failed" })}</p>}
      <Button
        onClick={() => void run(confirmDiscard ? onStartFresh : onContinue)}
        disabled={pending}
        label={intl.formatMessage({
          id: confirmDiscard
            ? "app.garden.draft.discard"
            : legacyRecovery
              ? "app.garden.draft.recover"
              : "app.garden.draft.continue",
        })}
        variant="primary"
        mode="filled"
        size="medium"
      />
      <Button
        onClick={() => setConfirmDiscard(!confirmDiscard)}
        disabled={pending}
        label={intl.formatMessage({
          id: confirmDiscard ? "app.garden.draft.keep" : "app.garden.draft.startFresh",
        })}
        variant="neutral"
        mode="stroke"
        size="medium"
      />
    </PwaSheet>,
    document.body
  );
}
