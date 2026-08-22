import {
  Alert,
  type CommitmentDialogController,
  type CommitmentReadModel,
} from "@green-goods/shared";
import { useIntl } from "react-intl";
import type { FallbackPath } from "./commitmentDialogPresentation";

/**
 * What is true of the record right now and needs saying before any act: a
 * review under way, a recorded cancellation, an unreachable ordinary
 * confirmation, or a paused pool.
 */
export function CommitmentAlerts({
  onchainState,
  disputeReason,
  cancelReason,
  fallbackPath,
  poolPaused,
}: {
  onchainState: CommitmentReadModel["onchainState"];
  disputeReason: CommitmentDialogController["disputeReason"];
  cancelReason: CommitmentDialogController["cancelReason"];
  fallbackPath: FallbackPath;
  poolPaused: boolean;
}) {
  const { formatMessage } = useIntl();

  return (
    <>
      {onchainState === "DISPUTED" ? (
        <Alert variant="warning">
          {disputeReason.reason
            ? formatMessage(
                {
                  id: "cockpit.garden.pool.commitment.disputed.withReason",
                  defaultMessage:
                    "Under review by stewards: “{reason}”. Members see only that it is under review.",
                },
                { reason: disputeReason.reason.reason }
              )
            : formatMessage({
                id: "cockpit.garden.pool.commitment.disputed.noReason",
                defaultMessage:
                  "Under review by stewards. Members see only that it is under review.",
              })}
        </Alert>
      ) : null}
      {onchainState === "CANCELLED" && cancelReason.reason ? (
        <Alert variant="info">
          {formatMessage(
            {
              id: "cockpit.garden.pool.commitment.cancelled.withReason",
              defaultMessage: "Cancelled: “{reason}”.",
            },
            { reason: cancelReason.reason.reason }
          )}
        </Alert>
      ) : null}
      {fallbackPath ? (
        <div data-testid="commitment-fallback-eligible">
          <Alert variant="warning">
            {fallbackPath === "POOL_FALLBACK"
              ? formatMessage({
                  id: "cockpit.garden.pool.commitment.fallback.garden",
                  defaultMessage:
                    "Nobody on the ordinary path can still confirm this. As a steward of this garden you may confirm it with a recorded reason; every contributor is excluded.",
                })
              : formatMessage({
                  id: "cockpit.garden.pool.commitment.fallback.protocol",
                  defaultMessage:
                    "Nobody on the ordinary path can still confirm this, and the commitment lets the Green Goods team step in. As a protocol steward you may confirm it with a recorded reason; every contributor is excluded.",
                })}
          </Alert>
        </div>
      ) : null}
      {poolPaused ? (
        <Alert variant="warning">
          {formatMessage({
            id: "cockpit.garden.pool.commitment.poolPaused",
            defaultMessage:
              "The pool is paused: accepting, readying and confirming wait; proof, wind-down and recovery stay open.",
          })}
        </Alert>
      ) : null}
    </>
  );
}
