import { Alert } from "@green-goods/shared/components/Alert";
import {
  isRetriablePoolSetupFailure,
  type PoolSetupAction,
  type PoolSetupFailure as PoolSetupFailureReason,
} from "@green-goods/shared/modules/commitment-pooling/pool-setup";
import { RiShieldCheckLine } from "@remixicon/react";
import { useIntl } from "react-intl";

type FormatMessage = (
  descriptor: { id: string; defaultMessage: string },
  values?: Record<string, string | number>
) => string;

/** What each write did, in the words the steward reads back after a failure. */
function actionLabel(
  action: PoolSetupAction,
  isCampaign: boolean,
  formatMessage: FormatMessage
): string {
  switch (action) {
    case "setPoolCharter":
      return formatMessage({
        id: "cockpit.garden.pool.setup.write.charter",
        defaultMessage: "Agreement written",
      });
    case "setProviderOpenCommitmentCap":
      return formatMessage({
        id: "cockpit.garden.pool.setup.write.cap",
        defaultMessage: "Commitment limit set",
      });
    case "markPoolReady":
      return formatMessage({
        id: "cockpit.garden.pool.setup.write.ready",
        defaultMessage: "Pool marked ready",
      });
    case "seedCycle":
      return isCampaign
        ? formatMessage({
            id: "cockpit.garden.pool.setup.write.seedCampaign",
            defaultMessage: "Campaign prepared",
          })
        : formatMessage({
            id: "cockpit.garden.pool.setup.write.seedSeason",
            defaultMessage: "Season prepared",
          });
    case "openPool":
      return formatMessage({
        id: "cockpit.garden.pool.setup.write.openPool",
        defaultMessage: "Pool opened",
      });
    case "openCycle":
      return isCampaign
        ? formatMessage({
            id: "cockpit.garden.pool.setup.write.openCampaign",
            defaultMessage: "Campaign opened with its split",
          })
        : formatMessage({
            id: "cockpit.garden.pool.setup.write.openSeason",
            defaultMessage: "Season opened with its split",
          });
  }
}

/** Why the run stopped, in the words the steward reads first. */
function failureMessage(
  failure: PoolSetupFailureReason | null,
  isCampaign: boolean,
  formatMessage: FormatMessage
): string {
  switch (failure) {
    case "existing-cycle":
      return formatMessage({
        id: "cockpit.garden.pool.setup.failure.existingCycle",
        defaultMessage:
          "This pool already holds a prepared cycle, so nothing more was written. Open that cycle from the pool tab instead.",
      });
    case "pool-paused":
      return formatMessage({
        id: "cockpit.garden.pool.setup.failure.poolPaused",
        defaultMessage: "The pool is paused. Resume it before opening a cycle.",
      });
    case "unavailable":
      return formatMessage({
        id: "cockpit.garden.pool.setup.failure.unavailable",
        defaultMessage:
          "Commitment pooling is not available on this chain yet, so nothing was written.",
      });
    case "no-sender":
      return formatMessage({
        id: "cockpit.garden.pool.setup.failure.noSender",
        defaultMessage:
          "No wallet is ready to sign. Connect one and try again; nothing was written.",
      });
    case "read-failed":
      return formatMessage({
        id: "cockpit.garden.pool.setup.failure.readFailed",
        defaultMessage:
          "The chain could not be read, so setup stopped where it was. What landed stays landed; try again when the connection is steady.",
      });
    case "cycle-terms-mismatch":
      return isCampaign
        ? formatMessage({
            id: "cockpit.garden.pool.setup.failure.termsMismatchCampaign",
            defaultMessage:
              "This campaign is already open, on a different split from the one written here. A split is fixed the moment a cycle opens, so it cannot be changed now. Close this and read the terms it carries on the pool tab.",
          })
        : formatMessage({
            id: "cockpit.garden.pool.setup.failure.termsMismatchSeason",
            defaultMessage:
              "This season is already open, on a different split from the one written here. A split is fixed the moment a cycle opens, so it cannot be changed now. Close this and read the terms it carries on the pool tab.",
          });
    case "seed-unconfirmed":
      return isCampaign
        ? formatMessage({
            id: "cockpit.garden.pool.setup.failure.seedUnconfirmedCampaign",
            defaultMessage:
              "The campaign may or may not have been prepared; the wallet never said which. Close this and check the pool tab: if the campaign is there, open it from the list; if it is not, start again.",
          })
        : formatMessage({
            id: "cockpit.garden.pool.setup.failure.seedUnconfirmedSeason",
            defaultMessage:
              "The season may or may not have been prepared; the wallet never said which. Close this and check the pool tab: if the season is there, open it from the list; if it is not, start again.",
          });
    default:
      return isCampaign
        ? formatMessage({
            id: "cockpit.garden.pool.setup.failure.campaign",
            defaultMessage:
              "The campaign did not open. What landed stays landed; the rest was not written.",
          })
        : formatMessage({
            id: "cockpit.garden.pool.setup.failure.season",
            defaultMessage:
              "The season did not open. What landed stays landed; the rest was not written.",
          });
  }
}

export interface SetupFailureProps {
  failure: PoolSetupFailureReason | null;
  isCampaign: boolean;
  landed: PoolSetupAction[];
  failedStep: PoolSetupAction | null;
}

/**
 * A stopped run, named: why it stopped, what already landed, and what did not.
 * The retry note only shows where repeating the unlanded call is safe.
 */
export function SetupFailure({ failure, isCampaign, landed, failedStep }: SetupFailureProps) {
  const { formatMessage } = useIntl();
  return (
    <div className="space-y-3" data-testid="pool-setup-failed">
      <Alert variant="error">{failureMessage(failure, isCampaign, formatMessage)}</Alert>
      <dl className="space-y-2 text-body-md">
        <div>
          <dt className="label-xs text-text-soft">
            {formatMessage({
              id: "cockpit.garden.pool.setup.landed",
              defaultMessage: "Landed",
            })}
          </dt>
          <dd className="text-text-strong" data-testid="pool-setup-landed">
            {landed.length > 0
              ? landed.map((action) => actionLabel(action, isCampaign, formatMessage)).join(" · ")
              : formatMessage({
                  id: "cockpit.garden.pool.setup.landedNothing",
                  defaultMessage: "Nothing yet",
                })}
          </dd>
        </div>
        <div>
          <dt className="label-xs text-text-soft">
            {formatMessage({
              id: "cockpit.garden.pool.setup.didNot",
              defaultMessage: "Did not",
            })}
          </dt>
          <dd className="text-text-strong" data-testid="pool-setup-failed-step">
            {failedStep
              ? actionLabel(failedStep, isCampaign, formatMessage)
              : formatMessage({
                  id: "cockpit.garden.pool.setup.didNotStart",
                  defaultMessage: "The first write",
                })}
          </dd>
        </div>
      </dl>
      {isRetriablePoolSetupFailure(failure) ? (
        <p className="flex items-center gap-1.5 text-xs text-text-soft">
          <RiShieldCheckLine className="h-3.5 w-3.5" aria-hidden />
          {formatMessage({
            id: "cockpit.garden.pool.setup.retryNote",
            defaultMessage:
              "Retrying repeats only the unlanded step. Nothing already recorded is written twice.",
          })}
        </p>
      ) : null}
    </div>
  );
}
