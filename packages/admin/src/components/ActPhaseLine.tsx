import type { TxActPhase } from "@green-goods/shared/hooks/admin-ui/pool/controller.types";
import { SEND_STAGE_WORDS } from "@green-goods/shared/modules/transactions/send-stage";
import { cn } from "@green-goods/shared/utils/styles/cn";
import { type IntlShape, useIntl } from "react-intl";

export interface ActPhaseLineProps {
  /** The act started from this row; idle renders nothing. */
  phase: TxActPhase;
  /** What the settled act did, in the row's own words. */
  confirmed: string;
  /**
   * Why the act can no longer go, said in place of the phase once an act has run, so the line
   * announces it: a queued promise the queue refused when a send found it so. The caller keeps
   * it back while an act is in flight; while idle it says nothing.
   */
  reason?: string | null;
  className?: string;
}

/**
 * What the line says for a phase, or null while the act is idle. A row that cannot give
 * the line its own place (the commitment item row, which keeps one height) leads its
 * details with these words and keeps the line only for screen readers. Waiting on the
 * wallet, confirming and still confirming are the shared stage words (PRD-1552).
 */
export function actPhaseText(
  intl: Pick<IntlShape, "formatMessage">,
  { phase, confirmed }: Pick<ActPhaseLineProps, "phase" | "confirmed">
): string | null {
  const { formatMessage } = intl;
  switch (phase.status) {
    case "idle":
      return null;
    case "signing":
      return formatMessage(SEND_STAGE_WORDS.wallet.label);
    case "confirming":
      return formatMessage(SEND_STAGE_WORDS.confirming.label);
    case "confirmed":
      return confirmed;
    case "queued":
      // Kept on this device after its broadcast: it went out and its receipt has not come.
      if (phase.hash) return formatMessage(SEND_STAGE_WORDS["still-confirming"].detail);
      return formatMessage({
        id: "app.admin.actPhase.queued",
        defaultMessage: "Queued on this device. Check its status before trying again.",
      });
    default:
      return formatMessage({
        id: "app.admin.actPhase.failed",
        defaultMessage: "It didn’t go through, and nothing changed. You can try again.",
      });
  }
}

/**
 * The one line a single-signature act shows on the row it started from, so a
 * steward never watches a greyed-out button in silence: waiting on the wallet,
 * waiting on the chain, done, left queued on this device, or failed with
 * nothing changed.
 */
export function ActPhaseLine({ phase, confirmed, reason, className }: ActPhaseLineProps) {
  const intl = useIntl();
  const saysReason = Boolean(reason) && phase.status !== "idle";
  const line = saysReason ? (reason as string) : actPhaseText(intl, { phase, confirmed });
  if (line === null) return null;
  return (
    <p
      role="status"
      data-component="ActPhaseLine"
      data-phase={phase.status}
      className={cn(
        "type-meta",
        phase.status === "failed" && !saysReason ? "text-error-dark" : "text-text-soft",
        className
      )}
    >
      {line}
    </p>
  );
}
