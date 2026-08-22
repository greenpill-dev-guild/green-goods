import {
  Alert,
  type PoolSetupAction,
  type PoolSetupFailure as PoolSetupFailureReason,
} from "@green-goods/shared";
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
      <Alert variant="error">
        {failure === "existing-cycle"
          ? formatMessage({
              id: "cockpit.garden.pool.setup.failure.existingCycle",
              defaultMessage:
                "This pool already holds a prepared cycle, so nothing more was written. Open that cycle from the pool tab instead.",
            })
          : failure === "pool-paused"
            ? formatMessage({
                id: "cockpit.garden.pool.setup.failure.poolPaused",
                defaultMessage: "The pool is paused. Resume it before opening a cycle.",
              })
            : failure === "unavailable"
              ? formatMessage({
                  id: "cockpit.garden.pool.setup.failure.unavailable",
                  defaultMessage:
                    "Commitment pooling is not available on this chain yet, so nothing was written.",
                })
              : failure === "no-sender"
                ? formatMessage({
                    id: "cockpit.garden.pool.setup.failure.noSender",
                    defaultMessage:
                      "No wallet is ready to sign. Connect one and try again; nothing was written.",
                  })
                : isCampaign
                  ? formatMessage({
                      id: "cockpit.garden.pool.setup.failure.campaign",
                      defaultMessage:
                        "The campaign did not open. What landed stays landed; the rest was not written.",
                    })
                  : formatMessage({
                      id: "cockpit.garden.pool.setup.failure.season",
                      defaultMessage:
                        "The season did not open. What landed stays landed; the rest was not written.",
                    })}
      </Alert>
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
      {failure === "send-failed" ||
      failure === "not-confirmed" ||
      failure === "cycle-id-unknown" ? (
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
