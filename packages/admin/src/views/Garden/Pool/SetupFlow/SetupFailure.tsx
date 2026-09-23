import { Alert } from "@green-goods/shared/components/Alert";
import {
  isRetriablePoolSetupFailure,
  type PoolSetupFailure as PoolSetupFailureReason,
} from "@green-goods/shared/modules/commitment-pooling/pool-setup";
import { RiShieldCheckLine } from "@remixicon/react";
import { useIntl } from "react-intl";
import { retryPromptCount } from "./setupWrites";

type FormatMessage = (
  descriptor: { id: string; defaultMessage: string },
  values?: Record<string, string | number>
) => string;

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
          "Commitment pooling isn't switched on in this app yet, so nothing was written.",
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
  /** How many more times the wallet will ask on a retry, over the rows still to send. */
  remainingPrompts: number;
}

/**
 * Why a run stopped, in one sentence, and whether trying again is safe and how
 * many more prompts it takes. What landed and what did not is on the checklist
 * above it, row by row.
 */
export function SetupFailure({ failure, isCampaign, remainingPrompts }: SetupFailureProps) {
  const { formatMessage } = useIntl();
  return (
    <div className="space-y-2" data-testid="pool-setup-failed">
      <Alert variant="error">{failureMessage(failure, isCampaign, formatMessage)}</Alert>
      {isRetriablePoolSetupFailure(failure) ? (
        <p className="flex items-center gap-1.5 text-xs text-text-soft">
          <RiShieldCheckLine className="h-3.5 w-3.5" aria-hidden />
          {retryPromptCount(remainingPrompts, formatMessage)}
        </p>
      ) : null}
    </div>
  );
}
