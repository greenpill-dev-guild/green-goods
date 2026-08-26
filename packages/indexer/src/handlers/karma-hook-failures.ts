import { indexer, type Garden, type KarmaProjectAccess } from "envio";

import { addUniqueAddress, createDefaultGarden, normalizeAddress, removeAddress } from "./shared";
import { getKarmaProjectAccessId } from "./ids";

type EventContext = Parameters<Parameters<typeof indexer.onEvent>[1]>[0]["context"];
type HookFailureEvent = {
  chainId: number;
  block: { timestamp: number };
  params: { garden: string; account: string; operation: bigint; reason: string };
};

function markAccountFailed(
  pending: readonly string[] | undefined,
  failed: readonly string[] | undefined,
  account: string
): { pending: string[]; failed: string[] } {
  return {
    pending: removeAddress([...(pending ?? [])], account),
    failed: addUniqueAddress([...(failed ?? [])], account),
  };
}

function defaultAccess(
  chainId: number,
  garden: string,
  account: string,
  projectUID?: string
): KarmaProjectAccess {
  return {
    id: getKarmaProjectAccessId(chainId, garden, account),
    chainId,
    garden: normalizeAddress(garden),
    account: normalizeAddress(account),
    projectUID,
    membershipState: "UNKNOWN",
    membershipOutcome: undefined,
    membershipReason: undefined,
    membershipUpdatedAt: undefined,
    accessState: "UNKNOWN",
    accessOutcome: undefined,
    accessReason: undefined,
    accessUpdatedAt: undefined,
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
  } else if (operation === 2 || operation === 3) {
    const accessId = getKarmaProjectAccessId(event.chainId, gardenId, account);
    const existingAccess =
      (await context.KarmaProjectAccess.get(accessId)) ??
      defaultAccess(event.chainId, gardenId, account, existingGarden.gapProjectUID);
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

    let access: KarmaProjectAccess = {
      ...existingAccess,
      projectUID: existingAccess.projectUID ?? existingGarden.gapProjectUID,
      membershipState: "FAILED",
      membershipOutcome: "FAILED",
      membershipReason: reason,
      membershipUpdatedAt: timestamp,
    };

    if (operation === 3) {
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
      access = {
        ...access,
        accessState: "FAILED",
        accessOutcome: "FAILED",
        accessReason: reason,
        accessUpdatedAt: timestamp,
      };
    }

    context.KarmaProjectAccess.set(access);
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
