import { getChainName } from "@green-goods/shared/config/chains";
import type { TxActPhase } from "@green-goods/shared/hooks/admin-ui/pool/controller.types";
import { cn } from "@green-goods/shared/utils/styles/cn";
import { useIntl } from "react-intl";

export interface ActPhaseLineProps {
  /** The act started from this row; idle renders nothing. */
  phase: TxActPhase;
  chainId: number;
  /** What the settled act did, in the row's own words. */
  confirmed: string;
}

/**
 * The one line a single-signature act shows on the row it started from, so a
 * steward never watches a greyed-out button in silence: waiting on the wallet,
 * waiting on the chain, done, left queued on this device, or failed with
 * nothing changed.
 */
export function ActPhaseLine({ phase, chainId, confirmed }: ActPhaseLineProps) {
  const { formatMessage } = useIntl();
  if (phase.status === "idle") return null;
  const line =
    phase.status === "signing"
      ? formatMessage({
          id: "app.admin.actPhase.signing",
          defaultMessage: "Confirm in your wallet.",
        })
      : phase.status === "confirming"
        ? formatMessage(
            { id: "app.admin.actPhase.confirming", defaultMessage: "Confirming on {network}…" },
            { network: getChainName(chainId) }
          )
        : phase.status === "confirmed"
          ? confirmed
          : phase.status === "queued"
            ? formatMessage({
                id: "app.admin.actPhase.queued",
                defaultMessage: "Queued on this device. Check its status before trying again.",
              })
            : formatMessage({
                id: "app.admin.actPhase.failed",
                defaultMessage: "It didn’t go through, and nothing changed. You can try again.",
              });
  return (
    <p
      role="status"
      data-component="ActPhaseLine"
      data-phase={phase.status}
      className={cn("body-xs", phase.status === "failed" ? "text-error-dark" : "text-text-soft")}
    >
      {line}
    </p>
  );
}
