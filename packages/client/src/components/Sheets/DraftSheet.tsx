import { PwaSheet } from "@green-goods/shared/components/Dialog/PwaSheet";
import { useState } from "react";
import { useIntl } from "react-intl";

interface DraftSheetProps {
  isOpen: boolean;
  onContinue: () => void | Promise<void>;
  onStartFresh: () => void | Promise<void>;
  onClose?: () => void;
  legacyRecovery?: boolean;
  imageCount: number;
}

/**
 * Resume / recover / discard prompt for a saved work draft. Renders the shared
 * PwaSheet with its built-in header and action bar, the same sheet the delete
 * confirmation and every other confirm-style action use in the installed app.
 */
export function DraftSheet({
  isOpen,
  onContinue,
  onStartFresh,
  onClose,
  legacyRecovery = false,
}: DraftSheetProps) {
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
  return (
    <PwaSheet
      open={isOpen}
      onClose={close}
      title={title}
      description={description}
      closeLabel={intl.formatMessage({ id: "app.garden.draft.close" })}
      preventClose={pending}
      testId="draft-sheet"
      actions={{
        primary: {
          label: intl.formatMessage({
            id: confirmDiscard
              ? "app.garden.draft.discard"
              : legacyRecovery
                ? "app.garden.draft.recover"
                : "app.garden.draft.continue",
          }),
          tone: confirmDiscard ? "danger" : "default",
          loading: pending,
          onClick: () => void run(confirmDiscard ? onStartFresh : onContinue),
        },
        secondary: {
          label: intl.formatMessage({
            id: confirmDiscard ? "app.garden.draft.keep" : "app.garden.draft.startFresh",
          }),
          disabled: pending,
          onClick: () => setConfirmDiscard(!confirmDiscard),
        },
      }}
    >
      {failed && <p role="alert">{intl.formatMessage({ id: "app.garden.draft.failed" })}</p>}
    </PwaSheet>
  );
}
