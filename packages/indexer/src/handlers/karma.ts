import { indexer, type Enum, type Garden, type KarmaProjectAccess } from "envio";

import { addUniqueAddress, createDefaultGarden, normalizeAddress, removeAddress } from "./shared";
import { getTxHash } from "./event-access";
import { getKarmaProjectAccessId, getKarmaSyncRecordId } from "./ids";

type KarmaSyncOperation = Enum<"KarmaSyncOperation">;
type KarmaSyncOutcome = Enum<"KarmaSyncOutcome">;
type KarmaProjectionState = Enum<"KarmaProjectionState">;

const OPERATION_BY_ORDINAL: Readonly<Record<number, KarmaSyncOperation>> = {
  0: "PROJECT",
  1: "DETAILS",
  2: "MEMBERSHIP",
  3: "ACCESS",
  4: "PROJECT_UPDATE",
};

const OUTCOME_BY_ORDINAL: Readonly<Record<number, KarmaSyncOutcome>> = {
  0: "NOOP",
  1: "SUCCEEDED",
  2: "FAILED",
};

function mapOperation(value: bigint): KarmaSyncOperation {
  const operation = OPERATION_BY_ORDINAL[Number(value)];
  if (!operation) throw new Error(`Unknown Karma sync operation ordinal: ${value.toString()}`);
  return operation;
}

function mapOutcome(value: bigint): KarmaSyncOutcome {
  const outcome = OUTCOME_BY_ORDINAL[Number(value)];
  if (!outcome) throw new Error(`Unknown Karma sync outcome ordinal: ${value.toString()}`);
  return outcome;
}

function projectionState(outcome: KarmaSyncOutcome): KarmaProjectionState {
  return outcome === "FAILED" ? "FAILED" : "SYNCED";
}

function trackedAccounts(
  pending: readonly string[] | undefined,
  failed: readonly string[] | undefined,
  account: string,
  state: KarmaProjectionState
): { pending: string[]; failed: string[]; aggregate: KarmaProjectionState } {
  let nextPending = [...(pending ?? [])];
  let nextFailed = [...(failed ?? [])];

  if (state === "FAILED") {
    nextPending = removeAddress(nextPending, account);
    nextFailed = addUniqueAddress(nextFailed, account);
  } else {
    nextPending = removeAddress(nextPending, account);
    nextFailed = removeAddress(nextFailed, account);
  }

  return {
    pending: nextPending,
    failed: nextFailed,
    aggregate: nextFailed.length > 0 ? "FAILED" : nextPending.length > 0 ? "PENDING" : "SYNCED",
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

indexer.onEvent(
  { contract: "KarmaGAPModule", event: "GAPProjectCreated" },
  async ({ event, context }) => {
    const gardenId = event.params.garden;
    const existing =
      (await context.Garden.get(gardenId)) ??
      createDefaultGarden(gardenId, event.chainId, event.block.timestamp);

    context.Garden.set({
      ...existing,
      gapProjectUID: event.params.projectUID,
      karmaProjectState: "SYNCED",
      karmaProjectReason: undefined,
      karmaProjectUpdatedAt: event.block.timestamp,
      karmaLastSyncAt: event.block.timestamp,
    });
  }
);

indexer.onEvent(
  { contract: "KarmaGAPModule", event: "KarmaSyncRecorded" },
  async ({ event, context }) => {
    const gardenId = event.params.garden;
    const account = event.params.account;
    const projectUID = event.params.projectUID;
    const operation = mapOperation(event.params.operation);
    const outcome = mapOutcome(event.params.outcome);
    const state = projectionState(outcome);
    const reason = event.params.reason || undefined;
    const txHash = getTxHash(event.transaction);
    const existingGarden =
      (await context.Garden.get(gardenId)) ??
      createDefaultGarden(gardenId, event.chainId, event.block.timestamp);

    context.KarmaSyncRecord.set({
      id: getKarmaSyncRecordId(event.chainId, txHash, event.logIndex),
      chainId: event.chainId,
      garden: normalizeAddress(gardenId),
      projectUID,
      account: normalizeAddress(account),
      operation,
      outcome,
      sourceUID: event.params.sourceUID,
      resultUID: event.params.resultUID,
      reason: event.params.reason,
      txHash,
      logIndex: event.logIndex,
      blockNumber: event.block.number,
      createdAt: event.block.timestamp,
    });

    let updatedGarden: Garden = {
      ...existingGarden,
      karmaLastSyncAt: event.block.timestamp,
      ...(outcome === "FAILED" ? { karmaLastFailureReason: reason } : {}),
    };

    if (operation === "PROJECT") {
      updatedGarden = {
        ...updatedGarden,
        gapProjectUID: projectUID,
        karmaProjectState: state,
        karmaProjectReason: reason,
        karmaProjectUpdatedAt: event.block.timestamp,
      };
    } else if (operation === "DETAILS") {
      updatedGarden = {
        ...updatedGarden,
        karmaDetailsState: state,
        karmaDetailsReason: reason,
        karmaDetailsUpdatedAt: event.block.timestamp,
      };
    } else if (operation === "PROJECT_UPDATE") {
      updatedGarden = {
        ...updatedGarden,
        karmaProjectUpdateState: state,
        karmaProjectUpdateReason: reason,
        karmaProjectUpdateUpdatedAt: event.block.timestamp,
      };
    } else {
      const accessId = getKarmaProjectAccessId(event.chainId, gardenId, account);
      const existingAccess =
        (await context.KarmaProjectAccess.get(accessId)) ??
        defaultAccess(event.chainId, gardenId, account, projectUID);

      if (operation === "MEMBERSHIP") {
        const tracked = trackedAccounts(
          existingGarden.karmaMembershipPendingAccounts,
          existingGarden.karmaMembershipFailedAccounts,
          account,
          state
        );
        updatedGarden = {
          ...updatedGarden,
          karmaMembershipState: tracked.aggregate,
          karmaMembershipReason: reason,
          karmaMembershipUpdatedAt: event.block.timestamp,
          karmaMembershipPendingAccounts: tracked.pending,
          karmaMembershipFailedAccounts: tracked.failed,
        };
        context.KarmaProjectAccess.set({
          ...existingAccess,
          projectUID,
          membershipState: state,
          membershipOutcome: outcome,
          membershipReason: reason,
          membershipUpdatedAt: event.block.timestamp,
        });
      } else {
        const tracked = trackedAccounts(
          existingGarden.karmaAccessPendingAccounts,
          existingGarden.karmaAccessFailedAccounts,
          account,
          state
        );
        updatedGarden = {
          ...updatedGarden,
          karmaAccessState: tracked.aggregate,
          karmaAccessReason: reason,
          karmaAccessUpdatedAt: event.block.timestamp,
          karmaAccessPendingAccounts: tracked.pending,
          karmaAccessFailedAccounts: tracked.failed,
        };
        context.KarmaProjectAccess.set({
          ...existingAccess,
          projectUID,
          accessState: state,
          accessOutcome: outcome,
          accessReason: reason,
          accessUpdatedAt: event.block.timestamp,
        });
      }
    }

    context.Garden.set(updatedGarden);
  }
);
