import { Button } from "@green-goods/shared/components/Button";
import { getChainName } from "@green-goods/shared/config/chains";
import type { TxActPhase } from "@green-goods/shared/hooks/admin-ui/pool/controller.types";
import { SEND_STAGE_WORDS } from "@green-goods/shared/modules/transactions/send-stage";
import { cn } from "@green-goods/shared/utils/styles/cn";
import { type IntlShape, useIntl } from "react-intl";

export interface ActPhaseLineProps {
  /** The act started from this row; idle renders nothing. */
  phase: TxActPhase;
  chainId: number;
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
 * details with these words and keeps the line only for screen readers.
 */
export function actPhaseText(
  intl: Pick<IntlShape, "formatMessage">,
  { phase, chainId, confirmed }: Pick<ActPhaseLineProps, "phase" | "chainId" | "confirmed">
): string | null {
  const { formatMessage } = intl;
  switch (phase.status) {
    case "idle":
      return null;
    case "signing":
      // Past 20 seconds it says to open the wallet (PRD-1551).
      return phase.slow
        ? formatMessage(SEND_STAGE_WORDS.wallet.detail!)
        : formatMessage({
            id: "app.admin.actPhase.signing",
            defaultMessage: "Confirm in your wallet.",
          });
    case "confirming":
      return formatMessage(
        { id: "app.admin.actPhase.confirming", defaultMessage: "Confirming on {network}…" },
        { network: getChainName(chainId) }
      );
    case "confirmed":
      return confirmed;
    case "queued":
      return formatMessage({
        id: "app.admin.actPhase.queued",
        defaultMessage: "Queued on this device. Check its status before trying again.",
      });
    // Three endings that may still land, so never read as failed (PRD-1551).
    case "still-confirming":
      return formatMessage(SEND_STAGE_WORDS["still-confirming"].detail!);
    case "safe-signers":
      return formatMessage(SEND_STAGE_WORDS["safe-signers"].label);
    case "stopped":
      return formatMessage(SEND_STAGE_WORDS.wallet.stopped!);
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
 * nothing changed. Waiting on the wallet past 20 seconds, it says to open the
 * wallet and offers Cancel, which stops this wait for the wallet's answer.
 */
export function ActPhaseLine({ phase, chainId, confirmed, reason, className }: ActPhaseLineProps) {
  const intl = useIntl();
  const saysReason = Boolean(reason) && phase.status !== "idle";
  const line = saysReason ? (reason as string) : actPhaseText(intl, { phase, chainId, confirmed });
  if (line === null) return null;
  const cancel = !saysReason && phase.status === "signing" && phase.slow ? phase.cancel : undefined;
  return (
    <p
      role="status"
      data-component="ActPhaseLine"
      data-phase={phase.status}
      className={cn(
        "type-meta",
        phase.status === "failed" && !saysReason ? "text-error-dark" : "text-text-soft",
        cancel && "flex flex-wrap items-center gap-x-2 gap-y-1",
        className
      )}
    >
      {cancel ? <span>{line}</span> : line}
      {cancel ? (
        <Button type="button" emphasis="tertiary" size="compact" onClick={cancel}>
          {intl.formatMessage({ id: "app.common.cancel", defaultMessage: "Cancel" })}
        </Button>
      ) : null}
    </p>
  );
}
