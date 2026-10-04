import { PwaSheet } from "@green-goods/shared/components/Dialog/PwaSheet";
import { useState } from "react";
import { useIntl } from "react-intl";

interface DraftSheetProps {
  isOpen: boolean;
  onContinue: () => void | Promise<void>;
  onStartFresh: () => void | Promise<void>;
  /** Opens Your Work on its drafts: the way on when every draft slot is taken. */
  onManage: () => void;
  onClose?: () => void;
  legacyRecovery?: boolean;
  imageCount: number;
}

/**
 * Resume or recover prompt for a saved work draft. Renders the shared PwaSheet
 * with its built-in header and action bar, the same sheet the delete
 * confirmation and every other confirm-style action use in the installed app.
 *
 * Start Fresh keeps the saved draft in Your Work, so it asks nothing. Photos
 * saved before an account existed have no such home: there Start Fresh still
 * asks before it discards them.
 */
export function DraftSheet({
  isOpen,
  onContinue,
  onStartFresh,
  onManage,
  onClose,
  legacyRecovery = false,
}: DraftSheetProps) {
  const intl = useIntl();
  const [pending, setPending] = useState<"primary" | "secondary" | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [failure, setFailure] = useState<"failed" | "limit" | null>(null);
  const title = intl.formatMessage({
    id: confirmDiscard
      ? "app.garden.draft.discardTitle"
      : legacyRecovery
        ? "app.garden.draft.recoverTitle"
        : "app.garden.draft.title",
  });
  const description =
    failure === "limit" ? (
      // In the prompt's own place, so the sheet keeps its height on the smallest phones.
      <span role="alert">{intl.formatMessage({ id: "app.garden.draft.limit" })}</span>
    ) : (
      intl.formatMessage({
        id: confirmDiscard
          ? "app.garden.draft.discardDescription"
          : legacyRecovery
            ? "app.garden.draft.recoverDescription"
            : "app.garden.draft.resumeDescription",
      })
    );
  const run = async (role: "primary" | "secondary", action: () => void | Promise<void>) => {
    setPending(role);
    setFailure(null);
    try {
      await action();
      setConfirmDiscard(false);
    } catch (error) {
      // Only a fresh start needs a free draft slot; the store names that refusal.
      const full =
        role === "secondary" && error instanceof Error && error.message === "draft-limit";
      setFailure(full ? "limit" : "failed");
    } finally {
      setPending(null);
    }
  };
  const close = () => {
    if (pending) return;
    setConfirmDiscard(false);
    setFailure(null);
    onClose?.();
  };
  const secondary =
    failure === "limit"
      ? { label: intl.formatMessage({ id: "app.garden.draft.manage" }), onClick: () => onManage() }
      : confirmDiscard
        ? {
            label: intl.formatMessage({ id: "app.garden.draft.keep" }),
            onClick: () => setConfirmDiscard(false),
          }
        : {
            label: intl.formatMessage({ id: "app.garden.draft.startFresh" }),
            loading: pending === "secondary",
            onClick: legacyRecovery
              ? () => setConfirmDiscard(true)
              : () => void run("secondary", onStartFresh),
          };
  return (
    <PwaSheet
      open={isOpen}
      onClose={close}
      title={title}
      description={description}
      closeLabel={intl.formatMessage({ id: "app.garden.draft.close" })}
      preventClose={pending !== null}
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
          loading: pending === "primary",
          disabled: pending === "secondary",
          onClick: () => void run("primary", confirmDiscard ? onStartFresh : onContinue),
        },
        secondary: { ...secondary, disabled: pending === "primary" },
      }}
    >
      {failure === "failed" && (
        <p role="alert">{intl.formatMessage({ id: "app.garden.draft.failed" })}</p>
      )}
    </PwaSheet>
  );
}
