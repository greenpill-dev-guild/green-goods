import { PwaSheet } from "@green-goods/shared/components/Dialog/PwaSheet";
import { RiCloseLine } from "@remixicon/react";
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
      ariaLabel={title}
      testId="draft-dialog"
      dragToDismiss={!pending}
    >
      <div className="flex flex-col gap-4 p-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            type="button"
            onClick={close}
            disabled={pending}
            data-testid="pwa-sheet-close"
            className="min-h-11 min-w-11"
            aria-label={intl.formatMessage({ id: "app.garden.draft.close" })}
          >
            <RiCloseLine aria-hidden="true" />
          </button>
        </div>
        <p className="text-sm text-text-sub-600">
          {intl.formatMessage({
            id: confirmDiscard
              ? "app.garden.draft.discardDescription"
              : legacyRecovery
                ? "app.garden.draft.recoverDescription"
                : "app.garden.draft.resumeDescription",
          })}
        </p>
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
      </div>
    </PwaSheet>,
    document.body
  );
}
