import { indexer, type Garden } from "envio";
import type { Address } from "viem";

import {
  createDefaultGarden,
  createDefaultKarmaProjectAccess,
  type EventContext,
} from "./entity-defaults";
import { addUniqueAddress, removeAddress } from "./shared";
import { getKarmaProjectAccessId } from "./ids";

type HookFailureEvent = {
  chainId: number;
  block: { timestamp: number };
  params: { garden: Address; account: Address; operation: bigint; reason: string };
};

function markAccountFailed(
  pending: readonly string[] | undefined,
  failed: readonly string[] | undefined,
  account: Address
): { pending: string[]; failed: string[] } {
  return {
    pending: removeAddress([...(pending ?? [])], account),
    failed: addUniqueAddress([...(failed ?? [])], account),
  };
}

async function handleKarmaHookFailed(event: HookFailureEvent, context: EventContext) {
  const { garden: gardenId, account } = event.params;
  const reason = event.params.reason || "karma_hook_failed";
  const timestamp = event.block.timestamp;
  const operation = Number(event.params.operation);
  const existingGarden =
    (await context.Garden.get(gardenId)) ?? createDefaultGarden(gardenId, event.chainId, timestamp);
  let garden: Garden = {
    ...existingGarden,
    karmaLastFailureReason: reason,
    karmaLastSyncAt: timestamp,
  };

  if (operation === 0) {
    garden = {
      ...garden,
      karmaProjectState: "FAILED",
      karmaProjectReason: reason,
      karmaProjectUpdatedAt: timestamp,
    };
  } else if (operation === 1) {
    garden = {
      ...garden,
      karmaDetailsState: "FAILED",
      karmaDetailsReason: reason,
      karmaDetailsUpdatedAt: timestamp,
    };
  } else if (operation === 4) {
    garden = {
      ...garden,
      karmaProjectUpdateState: "FAILED",
      karmaProjectUpdateReason: reason,
      karmaProjectUpdateUpdatedAt: timestamp,
    };
  } else if (operation === 2) {
    const accessId = getKarmaProjectAccessId(event.chainId, gardenId, account);
    const existingAccess =
      (await context.KarmaProjectAccess.get(accessId)) ??
      createDefaultKarmaProjectAccess(
        event.chainId,
        gardenId,
        account,
        existingGarden.gapProjectUID
      );
    const membership = markAccountFailed(
      existingGarden.karmaMembershipPendingAccounts,
      existingGarden.karmaMembershipFailedAccounts,
      account
    );

    garden = {
      ...garden,
      karmaMembershipState: "FAILED",
      karmaMembershipReason: reason,
      karmaMembershipUpdatedAt: timestamp,
      karmaMembershipPendingAccounts: membership.pending,
      karmaMembershipFailedAccounts: membership.failed,
    };

    context.KarmaProjectAccess.set({
      ...existingAccess,
      projectUID: existingAccess.projectUID ?? existingGarden.gapProjectUID,
      membershipState: "FAILED",
      membershipOutcome: "FAILED",
      membershipReason: reason,
      membershipUpdatedAt: timestamp,
    });
  } else if (operation === 3) {
    const accessId = getKarmaProjectAccessId(event.chainId, gardenId, account);
    const existingAccess =
      (await context.KarmaProjectAccess.get(accessId)) ??
      createDefaultKarmaProjectAccess(
        event.chainId,
        gardenId,
        account,
        existingGarden.gapProjectUID
      );
    const projectAccess = markAccountFailed(
      existingGarden.karmaAccessPendingAccounts,
      existingGarden.karmaAccessFailedAccounts,
      account
    );

    garden = {
      ...garden,
      karmaAccessState: "FAILED",
      karmaAccessReason: reason,
      karmaAccessUpdatedAt: timestamp,
      karmaAccessPendingAccounts: projectAccess.pending,
      karmaAccessFailedAccounts: projectAccess.failed,
    };
    context.KarmaProjectAccess.set({
      ...existingAccess,
      projectUID: existingAccess.projectUID ?? existingGarden.gapProjectUID,
      accessState: "FAILED",
      accessOutcome: "FAILED",
      accessReason: reason,
      accessUpdatedAt: timestamp,
    });
  } else {
    throw new Error(`Unknown Karma hook operation ordinal: ${event.params.operation.toString()}`);
  }

  context.Garden.set(garden);
}

indexer.onEvent({ contract: "GardenToken", event: "KarmaHookFailed" }, async ({ event, context }) =>
  handleKarmaHookFailed(event, context)
);
indexer.onEvent(
  { contract: "GardenAccount", event: "KarmaHookFailed" },
  async ({ event, context }) => handleKarmaHookFailed(event, context)
);
indexer.onEvent({ contract: "HatsModule", event: "KarmaHookFailed" }, async ({ event, context }) =>
  handleKarmaHookFailed(event, context)
);
indexer.onEvent(
  { contract: "WorkApprovalResolver", event: "KarmaHookFailed" },
  async ({ event, context }) => handleKarmaHookFailed(event, context)
);
