import { Button } from "@green-goods/shared/components/Button";
import { SheetActions } from "@green-goods/shared/components/Dialog/SheetActions";
import { logger } from "@green-goods/shared/modules/app/logger";
import { MAX_REASON } from "@green-goods/shared/modules/commitment-pooling/reasons";
import { type ReactNode, useState } from "react";
import { useIntl } from "react-intl";
import { AdminDialog, type AdminDialogProps } from "./AdminDialog";
import { AdminTextArea } from "./AdminTextField";

export interface AdminReasonDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** Receives the trimmed reason. Rejections keep the dialog open with the words intact. */
  onConfirm: (reason: string) => void | Promise<void>;
  onError?: (error: unknown) => void;
  title: string;
  /** The blast-radius line: who and what this act changes, in one sentence. */
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  reasonLabel?: string;
  reasonPlaceholder?: string;
  /** Text the field starts from each time the dialog opens, such as words already typed elsewhere. */
  initialReason?: string;
  /**
   * Maximum accepted reason length when the downstream contract is narrower.
   * Defaults to the commitment-pooling limit the reason builder refuses past.
   */
  maxReasonLength?: number;
  /** Short phrases a steward can start from; each fills the field, editable. */
  suggestions?: string[];
  variant?: "default" | "danger";
  isLoading?: boolean;
  /** Blocks the act without hiding it, with the sentence saying why (offline, paused). */
  blockedReason?: string;
  tone?: AdminDialogProps["tone"];
  /** What the act writes to, named under the title (see AdminDialogProps.target). */
  target?: ReactNode;
  /** A rare second way to finish with the same reason, rendered as a text button. */
  alternative?: { label: string; onConfirm: (reason: string) => void | Promise<void> };
  /** Extra facts rendered above the field (for example what is frozen or who confirms). */
  children?: ReactNode;
}

/**
 * AdminReasonDialog — the reason-required confirmation.
 *
 * Every steward act the contract records with a reason (pause, cancel a
 * cycle, decline a claim, cancel or dispute a commitment, an override or a
 * fallback confirmation) goes through this one surface: a confirm dialog whose
 * primary act stays disabled until the steward has written why, and whose
 * description names the blast radius. The words are handed back trimmed; the
 * caller pins or sends them. A submission that fails leaves the dialog open
 * with the text in place so a retry costs nothing.
 *
 * Built on AdminDialog's `confirm` variant so it sits in the same size tier
 * as AdminConfirmDialog (sm) and inherits its mobile bottom-sheet presentation;
 * its Cancel and confirm are the shared action bar's (`SheetActions`). The
 * shared `ConfirmDialog` has no body for the reason field, so the dialog stays
 * on AdminDialog (DL-117).
 */
export function AdminReasonDialog({
  isOpen,
  onClose,
  onConfirm,
  onError,
  title,
  description,
  confirmLabel,
  cancelLabel,
  reasonLabel,
  reasonPlaceholder,
  initialReason = "",
  maxReasonLength = MAX_REASON,
  suggestions = [],
  variant = "default",
  isLoading = false,
  blockedReason,
  tone,
  target,
  alternative,
  children,
}: AdminReasonDialogProps) {
  const { formatMessage } = useIntl();
  const [reason, setReason] = useState(isOpen ? initialReason : "");
  const [openState, setOpenState] = useState(isOpen);
  const [submitting, setSubmitting] = useState(false);
  const busy = isLoading || submitting;
  const trimmed = reason.replace(/\s+/g, " ").trim();
  // The field's maxLength stops typing past the limit, not a prefilled reason.
  const tooLong = trimmed.length > maxReasonLength;
  const canConfirm = trimmed.length > 0 && !tooLong && !busy && !blockedReason;
  const isDanger = variant === "danger";

  // Each opening starts from `initialReason` (empty by default); the text
  // survives a failed submission because the dialog stays open.
  if (isOpen !== openState) {
    setOpenState(isOpen);
    setReason(isOpen ? initialReason : "");
  }

  const handleConfirm = async (confirm: (reason: string) => void | Promise<void>) => {
    if (!canConfirm) return;
    setSubmitting(true);
    try {
      await confirm(trimmed);
    } catch (error) {
      logger.error("[AdminReasonDialog] confirm failed", {
        title,
        error: error instanceof Error ? error.message : String(error),
      });
      // The click boundary invokes this with `void`, so a rethrow here becomes
      // an unhandled rejection that no error boundary catches — after the
      // failure has already been logged and surfaced by the mutation layer.
      // The dialog stays open with the reason intact so the steward can retry.
      onError?.(error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AdminDialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
      title={title}
      target={target}
      description={description}
      variant="confirm"
      role="dialog"
      tone={tone}
      preventClose={busy}
      hideCloseButton={busy}
      bodyClassName="space-y-3"
      actions={
        <SheetActions
          primary={{
            label: confirmLabel,
            onClick: () => void handleConfirm(onConfirm),
            loading: busy,
            // A busy confirm stays focusable; only a missing reason disables it.
            disabled: !busy && !canConfirm,
            tone: isDanger ? "danger" : "default",
          }}
          secondary={{
            label:
              cancelLabel ?? formatMessage({ id: "app.common.cancel", defaultMessage: "Cancel" }),
            onClick: onClose,
            disabled: busy,
          }}
          tertiary={
            alternative && {
              label: alternative.label,
              onClick: () => void handleConfirm(alternative.onConfirm),
              // It needs the same reason, and waits for the same one.
              disabled: !canConfirm,
            }
          }
        />
      }
    >
      {children}
      <div className="space-y-1.5">
        <AdminTextArea
          label={
            reasonLabel ??
            formatMessage({
              id: "cockpit.reasonDialog.reasonLabel",
              defaultMessage: "Reason",
            })
          }
          required
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={3}
          disabled={busy}
          placeholder={
            reasonPlaceholder ??
            formatMessage({
              id: "cockpit.reasonDialog.reasonPlaceholder",
              defaultMessage: "In your own words. Members read this.",
            })
          }
          error={
            tooLong
              ? formatMessage(
                  {
                    id: "cockpit.reasonDialog.tooLong",
                    defaultMessage: "Shorten the reason to {max} characters or fewer.",
                  },
                  { max: maxReasonLength }
                )
              : undefined
          }
          textareaProps={{
            maxLength: maxReasonLength,
            "data-component": "AdminReasonDialogField",
          }}
        />
        {suggestions.length > 0 ? (
          <div
            className="flex flex-wrap gap-1.5"
            aria-label={formatMessage({
              id: "cockpit.reasonDialog.suggestions",
              defaultMessage: "Suggested reasons",
            })}
          >
            {suggestions.map((suggestion) => (
              <Button
                key={suggestion}
                type="button"
                emphasis="secondary"
                size="compact"
                disabled={busy}
                onClick={() => setReason(suggestion)}
              >
                {suggestion}
              </Button>
            ))}
          </div>
        ) : null}
        {blockedReason ? (
          <p className="type-meta text-warning-dark" role="status">
            {blockedReason}
          </p>
        ) : null}
      </div>
    </AdminDialog>
  );
}

AdminReasonDialog.displayName = "AdminReasonDialog";
