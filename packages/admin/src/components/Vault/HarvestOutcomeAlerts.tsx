import { Alert } from "@green-goods/shared/components/Alert";
import type { HarvestDistributionResult } from "@green-goods/shared/hooks/yield/useHarvestDistribution";
import type { Address } from "@green-goods/shared/types/domain";
import { formatAddress } from "@green-goods/shared/utils/app/text";
import { useIntl } from "react-intl";
import { AdminButton } from "@/components/AdminButton";

type HarvestIncompleteFailure = Extract<
  HarvestDistributionResult,
  { status: "harvest_incomplete" }
>["failure"];

const HARVEST_INCOMPLETE_MESSAGE_ID: Record<HarvestIncompleteFailure, string> = {
  report_failed: "app.yield.harvestDistribution.harvestIncompleteReportDetails",
  registration_failed: "app.yield.harvestDistribution.harvestIncompleteRegistrationDetails",
  reverted: "app.yield.harvestDistribution.harvestIncompleteRevertedDetails",
  unverifiable: "app.yield.harvestDistribution.harvestIncompleteUnverifiedDetails",
};

interface HarvestOutcomeAlertsProps {
  result: HarvestDistributionResult | undefined;
  destinationAddress: Address;
  isRetryPending: boolean;
  formatAmount: (amount: bigint) => string;
  /** Retries reopen the fresh destination-aware confirmation, never the mutation directly. */
  onRetry: (mode: "split_only" | "harvest_first") => void;
  onDismiss: () => void;
}

/** Terminal-outcome alerts for the harvest & distribute workflow. */
export function HarvestOutcomeAlerts({
  result,
  destinationAddress,
  isRetryPending,
  formatAmount,
  onRetry,
  onDismiss,
}: HarvestOutcomeAlertsProps) {
  const { formatMessage } = useIntl();
  if (!result) return null;

  return (
    <>
      {result.status === "harvest_submitted" && (
        <Alert variant="info" className="p-3" onDismiss={onDismiss}>
          {formatMessage({ id: "app.yield.harvestDistribution.harvestSubmittedDetails" })}
        </Alert>
      )}

      {result.status === "distribution_submitted" && (
        <Alert variant="info" className="p-3" onDismiss={onDismiss}>
          {formatMessage({ id: "app.yield.harvestDistribution.distributionSubmittedDetails" })}
        </Alert>
      )}

      {result.status === "harvest_incomplete" && (
        <Alert
          variant="warning"
          className="p-3"
          onDismiss={onDismiss}
          action={
            // Re-harvesting cannot recover a failed registration: the next
            // harvest snapshots the resolver balance including the stuck
            // shares, so only the resolver owner can register them.
            result.failure !== "registration_failed" ? (
              <AdminButton
                variant="outlined"
                size="sm"
                onClick={() => onRetry("harvest_first")}
                disabled={isRetryPending}
                loading={isRetryPending}
              >
                {formatMessage({ id: "app.yield.harvestDistribution.action.retryHarvest" })}
              </AdminButton>
            ) : undefined
          }
        >
          {formatMessage({ id: HARVEST_INCOMPLETE_MESSAGE_ID[result.failure] })}
        </Alert>
      )}

      {result.status === "waiting" && (
        <Alert variant="info" className="p-3" onDismiss={onDismiss}>
          {formatMessage(
            { id: "app.yield.harvestDistribution.waitingDetails" },
            {
              amount: formatAmount(result.availableAmount),
              threshold: formatAmount(result.threshold),
            }
          )}
        </Alert>
      )}

      {result.status === "distribution_pending" && (
        <Alert
          variant="warning"
          className="p-3"
          onDismiss={onDismiss}
          action={
            <AdminButton
              variant="outlined"
              size="sm"
              onClick={() => onRetry("split_only")}
              disabled={isRetryPending}
              loading={isRetryPending}
            >
              {formatMessage({ id: "app.yield.harvestDistribution.action.retry" })}
            </AdminButton>
          }
        >
          {formatMessage({ id: "app.yield.harvestDistribution.pendingDetails" })}
        </Alert>
      )}

      {result.status === "split_unverified" && (
        <Alert variant="info" className="p-3" onDismiss={onDismiss}>
          {formatMessage({ id: "app.yield.harvestDistribution.unverifiedDetails" })}
        </Alert>
      )}

      {result.status === "distributed" && (
        <Alert variant="success" className="p-3" onDismiss={onDismiss}>
          {formatMessage(
            { id: "app.yield.harvestDistribution.successDetails" },
            {
              cookieJarAmount: formatAmount(result.amounts.cookieJarAmount),
              destination: formatAddress(destinationAddress),
              fractionsAmount: formatAmount(result.amounts.fractionsAmount),
              treasuryAmount: formatAmount(result.amounts.treasuryAmount),
            }
          )}
        </Alert>
      )}
    </>
  );
}
