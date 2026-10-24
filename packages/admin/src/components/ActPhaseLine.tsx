import { getChainName } from "@green-goods/shared/config/chains";
import type { TxActPhase } from "@green-goods/shared/hooks/admin-ui/pool/controller.types";
import { cn } from "@green-goods/shared/utils/styles/cn";
import { type IntlShape, useIntl } from "react-intl";

export interface ActPhaseLineProps {
  /** The act started from this row; idle renders nothing. */
  phase: TxActPhase;
  chainId: number;
  /** What the settled act did, in the row's own words. */
  confirmed: string;
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
      return formatMessage({
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
export function ActPhaseLine({ phase, chainId, confirmed, className }: ActPhaseLineProps) {
  const intl = useIntl();
  const line = actPhaseText(intl, { phase, chainId, confirmed });
  if (line === null) return null;
  return (
    <p
      role="status"
      data-component="ActPhaseLine"
      data-phase={phase.status}
      className={cn(
        "type-meta",
        phase.status === "failed" ? "text-error-dark" : "text-text-soft",
        className
      )}
    >
      {line}
    </p>
  );
}
