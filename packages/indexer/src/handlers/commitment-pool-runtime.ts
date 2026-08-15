import type {
  Commitment,
  CommitmentClaimRequest,
  CommitmentClaimRequestIndex,
  CommitmentClass,
  CommitmentContributor,
  CommitmentContributorIndex,
  CommitmentContributorRequirementAssignment,
  CommitmentContributorRequirementIndex,
  CommitmentCounterIndex,
  CommitmentCycle,
  CommitmentEvent,
  CommitmentEvidenceAttribution,
  CommitmentEvidenceAttributionIndex,
  CommitmentExchange,
  CommitmentPool,
  CommitmentPendingLifecycleProjection,
  CommitmentPendingLifecycleProjectionIndex,
  CommitmentProviderExposure,
  CommitmentRequirement,
  CommitmentSeries,
  CommitmentSeriesCycleSummary,
  CommitmentUnitSummary,
  CommitmentWorkAttribution,
  Hypercert,
  HypercertCommitmentContributorAllocation,
  NeedCommitmentIndex,
  PoolMemberHistory,
} from "envio";

import { createPool, eventAuditId, poolingEntityId } from "./commitment-pool-projections";
import { getTxHash, normalizeAddress } from "./shared";

type EntityStore<T extends { readonly id: string }> = {
  get(id: string): Promise<T | undefined>;
  set(entity: T): void;
};

export type PoolingContext = {
  Commitment: EntityStore<Commitment>;
  CommitmentClaimRequest: EntityStore<CommitmentClaimRequest>;
  CommitmentClaimRequestIndex: EntityStore<CommitmentClaimRequestIndex>;
  CommitmentClass: EntityStore<CommitmentClass>;
  CommitmentContributor: EntityStore<CommitmentContributor>;
  CommitmentContributorIndex: EntityStore<CommitmentContributorIndex>;
  CommitmentContributorRequirementAssignment: EntityStore<CommitmentContributorRequirementAssignment>;
  CommitmentContributorRequirementIndex: EntityStore<CommitmentContributorRequirementIndex>;
  CommitmentCounterIndex: EntityStore<CommitmentCounterIndex>;
  CommitmentCycle: EntityStore<CommitmentCycle>;
  CommitmentEvent: EntityStore<CommitmentEvent>;
  CommitmentEvidenceAttribution: EntityStore<CommitmentEvidenceAttribution>;
  CommitmentEvidenceAttributionIndex: EntityStore<CommitmentEvidenceAttributionIndex>;
  CommitmentExchange: EntityStore<CommitmentExchange>;
  CommitmentPool: EntityStore<CommitmentPool>;
  CommitmentPendingLifecycleProjection: EntityStore<CommitmentPendingLifecycleProjection>;
  CommitmentPendingLifecycleProjectionIndex: EntityStore<CommitmentPendingLifecycleProjectionIndex>;
  CommitmentProviderExposure: EntityStore<CommitmentProviderExposure>;
  CommitmentRequirement: EntityStore<CommitmentRequirement>;
  CommitmentSeries: EntityStore<CommitmentSeries>;
  CommitmentSeriesCycleSummary: EntityStore<CommitmentSeriesCycleSummary>;
  CommitmentUnitSummary: EntityStore<CommitmentUnitSummary>;
  CommitmentWorkAttribution: EntityStore<CommitmentWorkAttribution>;
  Hypercert: EntityStore<Hypercert>;
  HypercertCommitmentContributorAllocation: EntityStore<HypercertCommitmentContributorAllocation>;
  NeedCommitmentIndex: EntityStore<NeedCommitmentIndex>;
  PoolMemberHistory: EntityStore<PoolMemberHistory>;
};

export type RuntimeEvent = {
  readonly eventName: string;
  readonly contractName: string;
  readonly chainId: number;
  readonly params: Readonly<Record<string, unknown>>;
  readonly block: { readonly number: number; readonly timestamp: number };
  readonly transaction: unknown;
  readonly logIndex: number;
};

export function value<T>(event: RuntimeEvent, key: string): T {
  return event.params[key] as T;
}

export function optionalBigint(event: RuntimeEvent, key: string): bigint | undefined {
  const candidate = event.params[key];
  return typeof candidate === "bigint" && candidate !== 0n ? candidate : undefined;
}

export function optionalBytes32(event: RuntimeEvent, key: string): string | undefined {
  const candidate = event.params[key];
  if (typeof candidate !== "string" || /^0x0{64}$/i.test(candidate)) return undefined;
  return candidate.toLowerCase();
}

export function firstExplicitActor(event: RuntimeEvent): string | undefined {
  if (event.eventName === "CommitmentCreated") {
    const recordedBy = event.params.recordedBy;
    if (typeof recordedBy === "string") return normalizeAddress(recordedBy);
  }
  for (const key of [
    "actor",
    "creator",
    "recordedBy",
    "requestedBy",
    "claimant",
    "addedBy",
    "removedBy",
    "linker",
    "unlinker",
    "attacher",
    "confirmer",
    "canceller",
    "caller",
    "raiser",
    "funder",
    "consumedBy",
    "withdrawnBy",
  ]) {
    const candidate = event.params[key];
    if (typeof candidate === "string") return normalizeAddress(candidate);
  }
  return undefined;
}

const EVENT_TYPES: Readonly<Record<string, CommitmentEvent["eventType"]>> = {
  CommitmentCreated: "CREATED",
  CommitmentAccepted: "ACCEPTED",
  CommitmentReadyForConfirmation: "READY_FOR_CONFIRMATION",
  CommitmentFulfilled: "FULFILLED",
  CommitmentCancelled: "CANCELLED",
  CommitmentExpired: "EXPIRED",
  CommitmentDisputed: "DISPUTED",
  ModuleSchemaUIDUpdated: "MODULE_SCHEMA_UID_UPDATED",
  FundingPledged: "FUNDING_PLEDGED",
  FundingDepositRecorded: "FUNDING_DEPOSIT_RECORDED",
  FundingConsumed: "FUNDING_CONSUMED",
  FundingWithdrawn: "FUNDING_WITHDRAWN",
};

export function eventType(eventName: string): CommitmentEvent["eventType"] {
  const mapped = EVENT_TYPES[eventName];
  if (mapped) return mapped;
  return eventName
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toUpperCase() as CommitmentEvent["eventType"];
}

export async function putAudit(event: RuntimeEvent, context: PoolingContext): Promise<boolean> {
  const id = eventAuditId(event.chainId, getTxHash(event.transaction), event.logIndex);
  if (await context.CommitmentEvent.get(id)) return false;
  const poolId = optionalBigint(event, "poolId");
  const cycleId = optionalBigint(event, "cycleId");
  const commitmentId = optionalBigint(event, "commitmentId");
  const data = ["reasonCID", "reason", "cid", "metadataCID", "payoutRef"]
    .map((key) => event.params[key])
    .find((candidate): candidate is string => typeof candidate === "string");
  context.CommitmentEvent.set({
    id,
    chainId: event.chainId,
    poolId,
    poolEntityId: poolId === undefined ? undefined : poolingEntityId(event.chainId, poolId),
    cycleId,
    cycleEntityId: cycleId === undefined ? undefined : poolingEntityId(event.chainId, cycleId),
    commitmentId,
    commitmentEntityId:
      commitmentId === undefined ? undefined : poolingEntityId(event.chainId, commitmentId),
    eventType: eventType(event.eventName),
    actor: firstExplicitActor(event),
    configurationKey:
      typeof event.params.dependency === "bigint"
        ? Number(event.params.dependency)
        : typeof event.params.schemaKind === "bigint"
          ? Number(event.params.schemaKind)
          : undefined,
    previousValue:
      typeof event.params.previousAddress === "string"
        ? normalizeAddress(event.params.previousAddress)
        : typeof event.params.oldModule === "string"
          ? normalizeAddress(event.params.oldModule)
          : typeof event.params.previousUID === "string"
            ? event.params.previousUID.toLowerCase()
            : typeof event.params.previousPaused === "boolean"
              ? String(event.params.previousPaused)
              : undefined,
    newValue:
      typeof event.params.newAddress === "string"
        ? normalizeAddress(event.params.newAddress)
        : typeof event.params.newModule === "string"
          ? normalizeAddress(event.params.newModule)
          : typeof event.params.newUID === "string"
            ? event.params.newUID.toLowerCase()
            : typeof event.params.paused === "boolean"
              ? String(event.params.paused)
              : undefined,
    units: typeof event.params.units === "bigint" ? event.params.units : undefined,
    data,
    txHash: getTxHash(event.transaction).toLowerCase(),
    timestamp: event.block.timestamp,
  });
  return true;
}

export async function getPool(
  event: RuntimeEvent,
  context: PoolingContext,
  poolId: bigint
): Promise<CommitmentPool> {
  return (
    (await context.CommitmentPool.get(poolingEntityId(event.chainId, poolId))) ??
    createPool(event.chainId, poolId, event.block.timestamp)
  );
}
