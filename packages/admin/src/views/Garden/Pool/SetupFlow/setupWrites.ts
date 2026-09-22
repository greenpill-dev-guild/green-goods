/**
 * The words for each pool write in the setup checklist: what it is called
 * before and after it lands, and the one line saying why the wallet asks for
 * it. One module, so the checklist, the failure notice, and the done screen
 * never describe the same write two ways.
 */
import type {
  PoolSetupStepState,
  PoolSetupStepStatus,
} from "@green-goods/shared/hooks/commitment-pooling/useCommitmentPoolSetupSequence";
import {
  type PoolSetupAction,
  walletPrompts,
} from "@green-goods/shared/modules/commitment-pooling/pool-setup";
import type { PoolSetupIntent } from "./setupFlowModel";

type FormatMessage = (
  descriptor: { id: string; defaultMessage: string },
  values?: Record<string, string | number>
) => string;

/**
 * The writes each flow sends, in order. Mirrors the planners in shared
 * `pool-setup` (`firstRunSetupSteps`, `newSeasonSteps`, `campaignSteps`,
 * `openSeasonSteps`); a test holds the two together.
 */
export function plannedActions(intent: PoolSetupIntent): PoolSetupAction[] {
  switch (intent) {
    case "first-run":
      return [
        "setPoolCharter",
        "setProviderOpenCommitmentCap",
        "markPoolReady",
        "seedCycle",
        "openPool",
        "openCycle",
      ];
    case "season":
      return ["seedCycle", "openPool", "openCycle"];
    case "campaign":
      return ["seedCycle", "openCycle"];
    case "open-season":
    case "open-campaign":
      return ["openPool", "openCycle"];
  }
}

/**
 * The checklist before anything is sent. Opening the pool is already done
 * when it is open, so it is shown that way rather than counted as a prompt.
 */
export function previewRows(intent: PoolSetupIntent, poolIsOpen: boolean): PoolSetupStepState[] {
  return plannedActions(intent).map((action) => ({
    action,
    status: action === "openPool" && poolIsOpen ? "already" : "pending",
    hash: null,
    batched: false,
  }));
}

/**
 * Which wallet prompt each row rides in (null for a row already done), and how
 * many prompts there are. Rows sharing a number are approved together.
 */
export function promptNumbers(
  rows: readonly PoolSetupStepState[],
  batching: boolean
): { numbers: Array<number | null>; total: number } {
  const toSend = rows.filter((row) => row.status !== "already").map((row) => row.action);
  const prompts = walletPrompts(toSend, batching);
  let cursor = 0;
  const numbers = rows.map((row) =>
    row.status === "already" ? null : (prompts[cursor++] ?? null)
  );
  return { numbers, total: prompts.at(-1) ?? 0 };
}

/** What the write is called while it is still to do. */
export function writeTitle(
  action: PoolSetupAction,
  isCampaign: boolean,
  formatMessage: FormatMessage
): string {
  switch (action) {
    case "setPoolCharter":
      return formatMessage({
        id: "cockpit.garden.pool.setup.todo.charter",
        defaultMessage: "Write the agreement",
      });
    case "setProviderOpenCommitmentCap":
      return formatMessage({
        id: "cockpit.garden.pool.setup.todo.cap",
        defaultMessage: "Set the commitment limit",
      });
    case "markPoolReady":
      return formatMessage({
        id: "cockpit.garden.pool.setup.todo.ready",
        defaultMessage: "Mark the pool ready",
      });
    case "seedCycle":
      return isCampaign
        ? formatMessage({
            id: "cockpit.garden.pool.setup.todo.seedCampaign",
            defaultMessage: "Prepare the campaign",
          })
        : formatMessage({
            id: "cockpit.garden.pool.setup.todo.seedSeason",
            defaultMessage: "Prepare the season",
          });
    case "openPool":
      return formatMessage({
        id: "cockpit.garden.pool.setup.todo.openPool",
        defaultMessage: "Open the pool",
      });
    case "openCycle":
      return isCampaign
        ? formatMessage({
            id: "cockpit.garden.pool.setup.todo.openCampaign",
            defaultMessage: "Open the campaign with its split",
          })
        : formatMessage({
            id: "cockpit.garden.pool.setup.todo.openSeason",
            defaultMessage: "Open the season with its split",
          });
  }
}

/** What the write is called once the chain shows it. */
export function writeDone(
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

/** Why the wallet asks for this write, in one line. */
export function writeWhy(action: PoolSetupAction, formatMessage: FormatMessage): string {
  switch (action) {
    case "setPoolCharter":
      return formatMessage({
        id: "cockpit.garden.pool.setup.why.charter",
        defaultMessage: "Stores what this pool is for, where everyone can read it.",
      });
    case "setProviderOpenCommitmentCap":
      return formatMessage({
        id: "cockpit.garden.pool.setup.why.cap",
        defaultMessage: "Caps how many open commitments one person can hold.",
      });
    case "markPoolReady":
      return formatMessage({
        id: "cockpit.garden.pool.setup.why.ready",
        defaultMessage: "The chain checks that the agreement and the limit are in place.",
      });
    case "seedCycle":
      return formatMessage({
        id: "cockpit.garden.pool.setup.why.seed",
        defaultMessage: "Records the name and dates. Nobody can commit yet.",
      });
    case "openPool":
      return formatMessage({
        id: "cockpit.garden.pool.setup.why.openPool",
        defaultMessage: "The garden can now see the pool.",
      });
    case "openCycle":
      return formatMessage({
        id: "cockpit.garden.pool.setup.why.openCycle",
        defaultMessage: "Fixes the split for good. Commitments can start.",
      });
  }
}

/** Where a row stands, in the words beside it. Pending rows say nothing. */
export function writeStatus(
  status: PoolSetupStepStatus,
  formatMessage: FormatMessage
): string | null {
  switch (status) {
    case "signing":
      return formatMessage({
        id: "cockpit.garden.pool.setup.status.signing",
        defaultMessage: "Confirm in your wallet",
      });
    case "confirming":
      return formatMessage({
        id: "cockpit.garden.pool.setup.status.confirming",
        defaultMessage: "Confirming…",
      });
    case "landed":
      return formatMessage({
        id: "cockpit.garden.pool.setup.status.landed",
        defaultMessage: "Done",
      });
    case "already":
      return formatMessage({
        id: "cockpit.garden.pool.setup.status.already",
        defaultMessage: "Already done",
      });
    case "failed":
      return formatMessage({
        id: "cockpit.garden.pool.setup.status.failed",
        defaultMessage: "Didn’t go through",
      });
    case "pending":
      return null;
  }
}
