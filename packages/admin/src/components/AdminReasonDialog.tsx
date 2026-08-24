import { logger } from "@green-goods/shared/modules/app/logger";
import { cn } from "@green-goods/shared/utils/styles/cn";
import { RiAlertLine } from "@remixicon/react";
import { type ReactNode, useEffect, useId, useState } from "react";
import { useIntl } from "react-intl";
import { AdminButton } from "./AdminButton";
import { AdminDialog, type AdminDialogProps } from "./AdminDialog";

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
  /** Short phrases a steward can start from; each fills the field, editable. */
  suggestions?: string[];
  variant?: "default" | "danger";
  isLoading?: boolean;
  /** Blocks the act without hiding it, with the sentence saying why (offline, paused). */
  blockedReason?: string;
  tone?: AdminDialogProps["tone"];
  /** Extra facts rendered above the field (for example what is frozen or who confirms). */
  children?: ReactNode;
}

const MAX_REASON = 2000;

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
 * as AdminConfirmDialog (sm) and inherits its mobile bottom-sheet presentation.
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
  suggestions = [],
  variant = "default",
  isLoading = false,
  blockedReason,
  tone,
  children,
}: AdminReasonDialogProps) {
  const { formatMessage } = useIntl();
  const fieldId = useId();
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const busy = isLoading || submitting;
  const trimmed = reason.replace(/\s+/g, " ").trim();
  const canConfirm = trimmed.length > 0 && !busy && !blockedReason;
  const isDanger = variant === "danger";

  // A fresh dialog starts empty; the text survives a failed submission.
  useEffect(() => {
    if (!isOpen) setReason("");
  }, [isOpen]);

  const handleConfirm = async () => {
    if (!canConfirm) return;
    setSubmitting(true);
    try {
      await onConfirm(trimmed);
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
      description={description}
      icon={isDanger ? <RiAlertLine className="h-6 w-6 text-[rgb(var(--m3-error))]" /> : undefined}
      variant="confirm"
      role="dialog"
      tone={tone}
      preventClose={busy}
      hideCloseButton={busy}
      bodyClassName="space-y-3"
      actions={
        <>
          <AdminButton type="button" variant="text" onClick={onClose} disabled={busy}>
            {cancelLabel ?? formatMessage({ id: "app.common.cancel", defaultMessage: "Cancel" })}
          </AdminButton>
          <AdminButton
            type="button"
            variant={isDanger ? "danger" : "filled"}
            onClick={() => void handleConfirm()}
            disabled={!canConfirm}
            loading={busy}
          >
            {confirmLabel}
          </AdminButton>
        </>
      }
    >
      {children}
      <div className="space-y-1.5">
        <label htmlFor={fieldId} className="label-md block text-text-strong">
          {reasonLabel ??
            formatMessage({
              id: "cockpit.reasonDialog.reasonLabel",
              defaultMessage: "Reason",
            })}
          <span aria-hidden="true" className="ml-0.5 text-[rgb(var(--m3-error))]">
            *
          </span>
        </label>
        <textarea
          id={fieldId}
          data-component="AdminReasonDialogField"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          maxLength={MAX_REASON}
          rows={3}
          required
          disabled={busy}
          placeholder={
            reasonPlaceholder ??
            formatMessage({
              id: "cockpit.reasonDialog.reasonPlaceholder",
              defaultMessage: "In your own words. Members read this.",
            })
          }
          className={cn(
            "w-full resize-y rounded-[var(--m3-shape-sm)] px-3 py-2 text-body-md",
            "bg-[rgb(var(--m3-surface-container-highest))] text-[rgb(var(--m3-on-surface))]",
            "ring-1 ring-inset ring-[rgb(var(--m3-outline-variant))]",
            "placeholder:text-[rgb(var(--m3-on-surface-variant))]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--tone-focus-ring,var(--m3-primary)))]",
            "disabled:opacity-[0.38]"
          )}
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
              <AdminButton
                key={suggestion}
                type="button"
                variant="outlined"
                size="sm"
                disabled={busy}
                onClick={() => setReason(suggestion)}
              >
                {suggestion}
              </AdminButton>
            ))}
          </div>
        ) : null}
        {blockedReason ? (
          <p className="text-xs text-warning-dark" role="status">
            {blockedReason}
          </p>
        ) : null}
      </div>
    </AdminDialog>
  );
}

AdminReasonDialog.displayName = "AdminReasonDialog";
