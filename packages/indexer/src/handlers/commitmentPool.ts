import {
  indexer,
  type Commitment,
  type CommitmentClaimRequest,
  type CommitmentClass,
  type CommitmentContributor,
  type CommitmentContributorIndex,
  type CommitmentContributorRequirementAssignment,
  type CommitmentContributorRequirementIndex,
  type CommitmentCounterIndex,
  type CommitmentCycle,
  type CommitmentEvent,
  type CommitmentEvidenceAttribution,
  type CommitmentEvidenceAttributionIndex,
  type CommitmentExchange,
  type CommitmentPool,
  type CommitmentPendingLifecycleProjection,
  type CommitmentPendingLifecycleProjectionIndex,
  type CommitmentProviderExposure,
  type CommitmentRequirement,
  type CommitmentSeries,
  type CommitmentSeriesCycleSummary,
  type CommitmentUnitSummary,
  type CommitmentWorkAttribution,
  type NeedCommitmentIndex,
  type PoolMemberHistory,
} from "envio";
import { keccak256, toBytes } from "viem";

import {
  commitmentClaimMode,
  commitmentClaimType,
  commitmentCycleType,
  commitmentDirection,
  commitmentKind,
  commitmentMemberId,
  commitmentPoolType,
  commitmentState,
  confirmationPath,
  considerationRail,
  contributorPolicy,
  createCommitment,
  createContributor,
  createCycle,
  createPool,
  createSeries,
  createWorkAttribution,
  cursorWins,
  eventAuditId,
  exactLabelHash,
  poolMemberId,
  poolingEntityId,
  sortedUnique,
  workAttributionId,
} from "./commitment-pool-projections";
import { getTxHash, normalizeAddress } from "./shared";

type EntityStore<T extends { readonly id: string }> = {
  get(id: string): Promise<T | undefined>;
  set(entity: T): void;
};

type PoolingContext = {
  Commitment: EntityStore<Commitment>;
  CommitmentClaimRequest: EntityStore<CommitmentClaimRequest>;
  CommitmentClaimRequestIndex: EntityStore<{
    readonly id: string;
    readonly chainId: number;
    readonly commitmentId: bigint;
    readonly commitmentEntityId: string;
    readonly requestIds: readonly string[];
    readonly updatedAt: number;
  }>;
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
  NeedCommitmentIndex: EntityStore<NeedCommitmentIndex>;
  PoolMemberHistory: EntityStore<PoolMemberHistory>;
};

type RuntimeEvent = {
  readonly eventName: string;
  readonly contractName: string;
  readonly chainId: number;
  readonly params: Readonly<Record<string, unknown>>;
  readonly block: { readonly number: number; readonly timestamp: number };
  readonly transaction: unknown;
  readonly logIndex: number;
};

function value<T>(event: RuntimeEvent, key: string): T {
  return event.params[key] as T;
}

function optionalBigint(event: RuntimeEvent, key: string): bigint | undefined {
  const candidate = event.params[key];
  return typeof candidate === "bigint" && candidate !== 0n ? candidate : undefined;
}

function optionalBytes32(event: RuntimeEvent, key: string): string | undefined {
  const candidate = event.params[key];
  if (typeof candidate !== "string" || /^0x0{64}$/i.test(candidate)) return undefined;
  return candidate.toLowerCase();
}

function firstExplicitActor(event: RuntimeEvent): string | undefined {
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
  FundingPledged: "FUNDING_PLEDGED",
  FundingDepositRecorded: "FUNDING_DEPOSIT_RECORDED",
  FundingConsumed: "FUNDING_CONSUMED",
  FundingWithdrawn: "FUNDING_WITHDRAWN",
};

function eventType(eventName: string): CommitmentEvent["eventType"] {
  const mapped = EVENT_TYPES[eventName];
  if (mapped) return mapped;
  return eventName
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toUpperCase() as CommitmentEvent["eventType"];
}

async function putAudit(event: RuntimeEvent, context: PoolingContext): Promise<boolean> {
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

async function getPool(
  event: RuntimeEvent,
  context: PoolingContext,
  poolId: bigint
): Promise<CommitmentPool> {
  return (
    (await context.CommitmentPool.get(poolingEntityId(event.chainId, poolId))) ??
    createPool(event.chainId, poolId, event.block.timestamp)
  );
}

async function handlePoolEvent(event: RuntimeEvent, context: PoolingContext): Promise<void> {
  const poolId = value<bigint>(event, "poolId");
  const pool = await getPool(event, context, poolId);
  if (event.eventName === "PoolRegistered") {
    const garden = normalizeAddress(value<string>(event, "garden"));
    context.CommitmentPool.set({
      ...pool,
      registrationSeen: true,
      garden,
      gardenId: garden,
      poolType: commitmentPoolType(value<bigint>(event, "poolType")),
      state: pool.lifecycleBlockNumber === undefined ? "NOT_READY" : pool.state,
      createdAt: pool.createdAt ?? event.block.timestamp,
      updatedAt: Math.max(pool.updatedAt, event.block.timestamp),
    });
    return;
  }
  if (event.eventName === "PoolCharterUpdated") {
    if (
      !cursorWins(
        event.block.number,
        event.logIndex,
        pool.charterUpdateBlockNumber,
        pool.charterUpdateLogIndex
      )
    )
      return;
    context.CommitmentPool.set({
      ...pool,
      charterCID: value<string>(event, "charterCID"),
      charterUpdateBlockNumber: BigInt(event.block.number),
      charterUpdateLogIndex: event.logIndex,
      updatedAt: Math.max(pool.updatedAt, event.block.timestamp),
    });
    return;
  }
  if (
    !cursorWins(
      event.block.number,
      event.logIndex,
      pool.lifecycleBlockNumber,
      pool.lifecycleLogIndex
    )
  )
    return;
  const stateByEvent: Readonly<Record<string, CommitmentPool["state"]>> = {
    PoolReady: "READY",
    PoolOpened: "OPEN",
    PoolPaused: "PAUSED",
    PoolResumed: "OPEN",
    PoolClosed: "CLOSED",
    PoolComposted: "COMPOSTED",
  };
  const nextState =
    event.eventName === "PoolReopened"
      ? value<boolean>(event, "toOpen")
        ? "OPEN"
        : "READY"
      : stateByEvent[event.eventName];
  if (
    event.eventName === "PoolClosed" &&
    (pool.liveCommitmentCount !== 0n || pool.nonTerminalCycleCount !== 0n)
  )
    return;
  context.CommitmentPool.set({
    ...pool,
    state: nextState,
    pauseReasonCID:
      event.eventName === "PoolPaused"
        ? value<string>(event, "reasonCID")
        : event.eventName === "PoolResumed"
          ? undefined
          : pool.pauseReasonCID,
    lifecycleBlockNumber: BigInt(event.block.number),
    lifecycleLogIndex: event.logIndex,
    updatedAt: Math.max(pool.updatedAt, event.block.timestamp),
  });
}

async function handleCycleEvent(event: RuntimeEvent, context: PoolingContext): Promise<void> {
  const cycleId = value<bigint>(event, "cycleId");
  const poolId = value<bigint>(event, "poolId");
  const entityId = poolingEntityId(event.chainId, cycleId);
  const pool = await getPool(event, context, poolId);
  const cycle =
    (await context.CommitmentCycle.get(entityId)) ??
    createCycle(event.chainId, cycleId, poolId, event.block.timestamp);
  if (event.eventName === "CycleSeeded") {
    const seeded = {
      ...cycle,
      seedSeen: true,
      poolId,
      poolEntityId: pool.id,
      garden: pool.registrationSeen ? pool.garden : cycle.garden,
      gardenId: pool.registrationSeen ? pool.gardenId : cycle.gardenId,
      cycleType: commitmentCycleType(value<bigint>(event, "cycleType")),
      state: cycle.lifecycleBlockNumber === undefined ? "SEEDED" : cycle.state,
      startTime: value<bigint>(event, "startTime"),
      endTime: value<bigint>(event, "endTime"),
      metadataCID: value<string>(event, "metadataCID"),
      createdAt: cycle.createdAt ?? event.block.timestamp,
      updatedAt: Math.max(cycle.updatedAt, event.block.timestamp),
    } satisfies CommitmentCycle;
    context.CommitmentCycle.set(seeded);
    if (!cycle.seedSeen && seeded.state !== "COMPOSTED" && seeded.state !== "CANCELLED") {
      context.CommitmentPool.set({
        ...pool,
        nonTerminalCycleCount: pool.nonTerminalCycleCount + 1n,
        openSeasonCycleId:
          seeded.state === "OPEN" && seeded.cycleType === "SEASON"
            ? cycleId
            : pool.openSeasonCycleId,
        openSeasonCycleEntityId:
          seeded.state === "OPEN" && seeded.cycleType === "SEASON"
            ? seeded.id
            : pool.openSeasonCycleEntityId,
        openCampaignIds:
          seeded.state === "OPEN" && seeded.cycleType === "CAMPAIGN"
            ? sortedUnique([...pool.openCampaignIds, cycleId])
            : pool.openCampaignIds,
        openCampaignEntityIds:
          seeded.state === "OPEN" && seeded.cycleType === "CAMPAIGN"
            ? sortedUnique([...pool.openCampaignEntityIds, seeded.id])
            : pool.openCampaignEntityIds,
        updatedAt: Math.max(pool.updatedAt, event.block.timestamp),
      });
    }
    return;
  }
  const lifecycleWins = cursorWins(
    event.block.number,
    event.logIndex,
    cycle.lifecycleBlockNumber,
    cycle.lifecycleLogIndex
  );
  const stateByEvent: Readonly<Record<string, CommitmentCycle["state"]>> = {
    CycleOpened: "OPEN",
    CycleClosed: "RECONCILED",
    CycleComposted: "COMPOSTED",
    CycleCancelled: "CANCELLED",
  };
  const isOpen = event.eventName === "CycleOpened";
  const allocationUnset =
    cycle.gardenersBps +
      cycle.treasuryBps +
      cycle.operatorBps +
      cycle.evaluatorBps +
      cycle.communityBps +
      cycle.funderBps ===
    0;
  if (!lifecycleWins && !(isOpen && allocationUnset)) return;
  const nextState = lifecycleWins ? stateByEvent[event.eventName] : cycle.state;
  const nextCycle = {
    ...cycle,
    state: nextState,
    gardenersBps:
      isOpen && allocationUnset ? Number(value<bigint>(event, "gardenersBps")) : cycle.gardenersBps,
    treasuryBps:
      isOpen && allocationUnset ? Number(value<bigint>(event, "treasuryBps")) : cycle.treasuryBps,
    operatorBps:
      isOpen && allocationUnset ? Number(value<bigint>(event, "operatorBps")) : cycle.operatorBps,
    evaluatorBps:
      isOpen && allocationUnset ? Number(value<bigint>(event, "evaluatorBps")) : cycle.evaluatorBps,
    communityBps:
      isOpen && allocationUnset ? Number(value<bigint>(event, "communityBps")) : cycle.communityBps,
    funderBps:
      isOpen && allocationUnset ? Number(value<bigint>(event, "funderBps")) : cycle.funderBps,
    equalParticipationBps:
      isOpen && allocationUnset
        ? Number(value<bigint>(event, "equalParticipationBps"))
        : cycle.equalParticipationBps,
    verifiedContributionBps:
      isOpen && allocationUnset
        ? Number(value<bigint>(event, "verifiedContributionBps"))
        : cycle.verifiedContributionBps,
    lifecycleBlockNumber: lifecycleWins ? BigInt(event.block.number) : cycle.lifecycleBlockNumber,
    lifecycleLogIndex: lifecycleWins ? event.logIndex : cycle.lifecycleLogIndex,
    updatedAt: Math.max(cycle.updatedAt, event.block.timestamp),
  } satisfies CommitmentCycle;
  context.CommitmentCycle.set(nextCycle);
  if (!lifecycleWins || !cycle.seedSeen) return;
  const wasTerminal = cycle.state === "COMPOSTED" || cycle.state === "CANCELLED";
  const isTerminalCycle = nextState === "COMPOSTED" || nextState === "CANCELLED";
  context.CommitmentPool.set({
    ...pool,
    nonTerminalCycleCount:
      wasTerminal === isTerminalCycle
        ? pool.nonTerminalCycleCount
        : isTerminalCycle
          ? pool.nonTerminalCycleCount > 0n
            ? pool.nonTerminalCycleCount - 1n
            : 0n
          : pool.nonTerminalCycleCount + 1n,
    openSeasonCycleId:
      nextState === "OPEN" && cycle.cycleType === "SEASON"
        ? cycleId
        : pool.openSeasonCycleId === cycleId && nextState !== "OPEN"
          ? undefined
          : pool.openSeasonCycleId,
    openSeasonCycleEntityId:
      nextState === "OPEN" && cycle.cycleType === "SEASON"
        ? entityId
        : pool.openSeasonCycleId === cycleId && nextState !== "OPEN"
          ? undefined
          : pool.openSeasonCycleEntityId,
    openCampaignIds:
      cycle.cycleType === "CAMPAIGN"
        ? nextState === "OPEN"
          ? sortedUnique([...pool.openCampaignIds, cycleId])
          : pool.openCampaignIds.filter((candidate) => candidate !== cycleId)
        : pool.openCampaignIds,
    openCampaignEntityIds:
      cycle.cycleType === "CAMPAIGN"
        ? nextState === "OPEN"
          ? sortedUnique([...pool.openCampaignEntityIds, entityId])
          : pool.openCampaignEntityIds.filter((candidate) => candidate !== entityId)
        : pool.openCampaignEntityIds,
    updatedAt: Math.max(pool.updatedAt, event.block.timestamp),
  });
}

async function handleSeriesEvent(event: RuntimeEvent, context: PoolingContext): Promise<void> {
  const seriesId = value<bigint>(event, "seriesId");
  const entityId = poolingEntityId(event.chainId, seriesId);
  const series =
    (await context.CommitmentSeries.get(entityId)) ??
    createSeries(event.chainId, seriesId, event.block.timestamp);
  if (event.eventName === "CommitmentSeriesCreated") {
    const holder = normalizeAddress(value<string>(event, "holder"));
    const poolId = value<bigint>(event, "poolId");
    context.CommitmentSeries.set({
      ...series,
      creationSeen: true,
      poolId,
      poolEntityId: poolingEntityId(event.chainId, poolId),
      createdBy: holder,
      currentHolder: holder,
      state: series.latestLifecycleBlock === undefined ? "ACTIVE" : series.state,
      metadataCID:
        series.latestMetadataBlock === undefined
          ? value<string>(event, "metadataCID")
          : series.metadataCID,
      createdAt: series.createdAt ?? event.block.timestamp,
      updatedAt: Math.max(series.updatedAt, event.block.timestamp),
    });
    return;
  }
  if (event.eventName === "CommitmentSeriesMetadataUpdated") {
    if (
      !cursorWins(
        event.block.number,
        event.logIndex,
        series.latestMetadataBlock,
        series.latestMetadataLogIndex
      )
    )
      return;
    context.CommitmentSeries.set({
      ...series,
      metadataCID: value<string>(event, "metadataCID"),
      latestMetadataBlock: BigInt(event.block.number),
      latestMetadataLogIndex: event.logIndex,
      updatedAt: Math.max(series.updatedAt, event.block.timestamp),
    });
    return;
  }
  if (
    !cursorWins(
      event.block.number,
      event.logIndex,
      series.latestLifecycleBlock,
      series.latestLifecycleLogIndex
    )
  )
    return;
  const states: Readonly<Record<string, CommitmentSeries["state"]>> = {
    CommitmentSeriesRested: "RESTING",
    CommitmentSeriesResumed: "ACTIVE",
    CommitmentSeriesRetired: "RETIRED",
  };
  context.CommitmentSeries.set({
    ...series,
    state: states[event.eventName],
    latestLifecycleBlock: BigInt(event.block.number),
    latestLifecycleLogIndex: event.logIndex,
    updatedAt: Math.max(series.updatedAt, event.block.timestamp),
  });
}

async function getCommitment(
  event: RuntimeEvent,
  context: PoolingContext,
  commitmentId: bigint
): Promise<Commitment> {
  return (
    (await context.Commitment.get(poolingEntityId(event.chainId, commitmentId))) ??
    createCommitment(event.chainId, commitmentId, event.block.timestamp)
  );
}

function createMemberHistory(
  chainId: number,
  poolId: bigint,
  account: string,
  timestamp: number
): PoolMemberHistory {
  const normalized = normalizeAddress(account);
  return {
    id: poolMemberId(chainId, poolId, normalized),
    chainId,
    poolId,
    poolEntityId: poolingEntityId(chainId, poolId),
    account: normalized,
    leadAccepted: 0,
    leadFulfilled: 0,
    leadCancelled: 0,
    leadExpired: 0,
    contributorFulfilled: 0,
    receivedFulfilled: 0,
    confirmationsGiven: 0,
    disputesRaised: 0,
    updatedAt: timestamp,
  };
}

type MemberHistoryCounter =
  | "leadAccepted"
  | "leadFulfilled"
  | "leadCancelled"
  | "leadExpired"
  | "contributorFulfilled"
  | "receivedFulfilled"
  | "confirmationsGiven"
  | "disputesRaised";

async function applyMemberHistoryDelta(
  context: PoolingContext,
  chainId: number,
  poolId: bigint,
  account: string | undefined,
  counter: MemberHistoryCounter,
  delta: 1 | -1,
  timestamp: number
): Promise<void> {
  if (!account) return;
  const id = poolMemberId(chainId, poolId, account);
  const existing =
    (await context.PoolMemberHistory.get(id)) ??
    createMemberHistory(chainId, poolId, account, timestamp);
  context.PoolMemberHistory.set({
    ...existing,
    [counter]: Math.max(0, existing[counter] + delta),
    updatedAt: Math.max(existing.updatedAt, timestamp),
  });
}

function terminalHistoryCounter(
  state: Commitment["state"]
): "leadFulfilled" | "leadCancelled" | "leadExpired" | undefined {
  if (state === "FULFILLED") return "leadFulfilled";
  if (state === "CANCELLED") return "leadCancelled";
  if (state === "EXPIRED") return "leadExpired";
  return undefined;
}

async function reconcileMemberHistory(
  context: PoolingContext,
  commitment: Commitment,
  timestamp: number
): Promise<Commitment> {
  const poolId = commitment.poolId;
  if (poolId === undefined) return commitment;
  const desiredOutcome =
    commitment.acceptanceSeen && isTerminal(commitment.state) ? commitment.state : undefined;
  let updated = commitment;
  if (commitment.memberHistoryOutcome !== desiredOutcome && commitment.leadProvider) {
    const previousCounter = terminalHistoryCounter(commitment.memberHistoryOutcome);
    const nextCounter = terminalHistoryCounter(desiredOutcome);
    if (previousCounter) {
      await applyMemberHistoryDelta(
        context,
        commitment.chainId,
        poolId,
        commitment.leadProvider,
        previousCounter,
        -1,
        timestamp
      );
    }
    if (nextCounter) {
      await applyMemberHistoryDelta(
        context,
        commitment.chainId,
        poolId,
        commitment.leadProvider,
        nextCounter,
        1,
        timestamp
      );
    }
    updated = {
      ...updated,
      memberHistoryOutcome: desiredOutcome,
      updatedAt: Math.max(updated.updatedAt, timestamp),
    };
    context.Commitment.set(updated);
  }

  if (
    updated.state !== "FULFILLED" ||
    updated.fulfilledParticipantHistoryApplied ||
    !updated.acceptanceSeen ||
    updated.frozenContributorCount === undefined
  )
    return updated;

  const contributorIndex = await context.CommitmentContributorIndex.get(updated.id);
  const contributors = (
    await Promise.all(
      (contributorIndex?.contributorEntityIds ?? []).map((id) =>
        context.CommitmentContributor.get(id)
      )
    )
  ).filter((row): row is CommitmentContributor => Boolean(row?.active));
  if (contributors.length !== updated.frozenContributorCount) return updated;

  for (const contributor of contributors) {
    if (contributor.contributor === updated.leadProvider) continue;
    await applyMemberHistoryDelta(
      context,
      updated.chainId,
      poolId,
      contributor.contributor,
      "contributorFulfilled",
      1,
      timestamp
    );
  }
  const receiver = updated.direction === "REQUEST" ? updated.creator : updated.counterparty;
  await applyMemberHistoryDelta(
    context,
    updated.chainId,
    poolId,
    receiver,
    "receivedFulfilled",
    1,
    timestamp
  );
  updated = {
    ...updated,
    fulfilledParticipantHistoryApplied: true,
    updatedAt: Math.max(updated.updatedAt, timestamp),
  };
  context.Commitment.set(updated);
  return updated;
}

async function reconcileRecognitionWeights(
  context: PoolingContext,
  commitment: Commitment,
  timestamp: number
): Promise<void> {
  if (!commitment.contributorsFrozen || commitment.frozenContributorCount === undefined) return;
  const index = await context.CommitmentContributorIndex.get(commitment.id);
  const active = (
    await Promise.all(
      (index?.contributorEntityIds ?? []).map((id) => context.CommitmentContributor.get(id))
    )
  )
    .filter((row): row is CommitmentContributor => Boolean(row?.active))
    .sort((left, right) => left.contributor.localeCompare(right.contributor));
  if (active.length !== commitment.frozenContributorCount) return;
  const eligible = active.filter((row) => row.approvedWorkCredits + row.evidenceCredits > 0);
  if (eligible.length === 0) return;
  let equalBps = 2_000;
  let verifiedBps = 8_000;
  if (commitment.cycleId !== undefined) {
    const cycle = await context.CommitmentCycle.get(
      poolingEntityId(commitment.chainId, commitment.cycleId)
    );
    if (cycle && cycle.equalParticipationBps + cycle.verifiedContributionBps === 10_000) {
      equalBps = cycle.equalParticipationBps;
      verifiedBps = cycle.verifiedContributionBps;
    }
  }

  const equalBase = Math.floor(equalBps / eligible.length);
  const equalRemainder = equalBps % eligible.length;
  const totalCredits = eligible.reduce(
    (total, row) => total + row.approvedWorkCredits + row.evidenceCredits,
    0
  );
  const verified = eligible.map((row) => {
    const numerator = verifiedBps * (row.approvedWorkCredits + row.evidenceCredits);
    return {
      id: row.id,
      floor: Math.floor(numerator / totalCredits),
      remainder: numerator % totalCredits,
      account: row.contributor,
    };
  });
  const verifiedRemainder = verifiedBps - verified.reduce((total, row) => total + row.floor, 0);
  const verifiedRemainderIds = new Set(
    [...verified]
      .sort(
        (left, right) =>
          right.remainder - left.remainder || left.account.localeCompare(right.account)
      )
      .slice(0, verifiedRemainder)
      .map((row) => row.id)
  );
  const equalRemainderIds = new Set(eligible.slice(0, equalRemainder).map((row) => row.id));
  for (const row of eligible) {
    const verifiedRow = verified.find((candidate) => candidate.id === row.id);
    const weight =
      equalBase +
      (equalRemainderIds.has(row.id) ? 1 : 0) +
      (verifiedRow?.floor ?? 0) +
      (verifiedRemainderIds.has(row.id) ? 1 : 0);
    context.CommitmentContributor.set({
      ...row,
      recognitionWeightBps: weight,
      updatedAt: Math.max(row.updatedAt, timestamp),
    });
  }
}

function isTerminal(state: Commitment["state"]): boolean {
  return state === "FULFILLED" || state === "CANCELLED" || state === "EXPIRED";
}

function stateCounterKey(
  state: Commitment["state"]
):
  | "offeredCount"
  | "acceptedCount"
  | "readyCount"
  | "fulfilledCount"
  | "cancelledCount"
  | "expiredCount"
  | "disputedCount"
  | undefined {
  switch (state) {
    case "OFFERED":
      return "offeredCount";
    case "ACCEPTED":
      return "acceptedCount";
    case "READY_FOR_CONFIRMATION":
      return "readyCount";
    case "FULFILLED":
      return "fulfilledCount";
    case "CANCELLED":
      return "cancelledCount";
    case "EXPIRED":
      return "expiredCount";
    case "DISPUTED":
      return "disputedCount";
    default:
      return undefined;
  }
}

function aggregateStateCounterKey(
  state: Commitment["state"]
):
  | "commitmentsAccepted"
  | "commitmentsReadyForConfirmation"
  | "commitmentsFulfilled"
  | "commitmentsCancelled"
  | "commitmentsExpired"
  | "commitmentsDisputed"
  | undefined {
  if (state === "ACCEPTED") return "commitmentsAccepted";
  if (state === "READY_FOR_CONFIRMATION") return "commitmentsReadyForConfirmation";
  if (state === "FULFILLED") return "commitmentsFulfilled";
  if (state === "CANCELLED") return "commitmentsCancelled";
  if (state === "EXPIRED") return "commitmentsExpired";
  if (state === "DISPUTED") return "commitmentsDisputed";
  return undefined;
}

function applyAggregateStateTransition<T extends CommitmentPool | CommitmentCycle>(
  aggregate: T,
  previousState: Commitment["state"],
  nextState: Commitment["state"]
): T {
  const previousKey = aggregateStateCounterKey(previousState);
  const nextKey = aggregateStateCounterKey(nextState);
  let updated = aggregate;
  if (previousKey && previousKey !== nextKey) {
    updated = {
      ...updated,
      [previousKey]: updated[previousKey] > 0n ? updated[previousKey] - 1n : 0n,
    };
  }
  if (nextKey && previousKey !== nextKey) {
    updated = { ...updated, [nextKey]: updated[nextKey] + 1n };
  }
  return updated;
}

function createSeriesCycleSummary(
  chainId: number,
  seriesId: bigint,
  cycleId: bigint,
  poolId: bigint,
  timestamp: number
): CommitmentSeriesCycleSummary {
  return {
    id: `${chainId}-${seriesId}-${cycleId}`,
    chainId,
    seriesId,
    seriesEntityId: poolingEntityId(chainId, seriesId),
    cycleId,
    cycleEntityId: poolingEntityId(chainId, cycleId),
    poolId,
    poolEntityId: poolingEntityId(chainId, poolId),
    instanceCount: 0n,
    offeredCount: 0n,
    acceptedCount: 0n,
    readyCount: 0n,
    fulfilledCount: 0n,
    cancelledCount: 0n,
    expiredCount: 0n,
    disputedCount: 0n,
    updatedAt: timestamp,
  };
}

async function applySeriesTransition(
  context: PoolingContext,
  commitment: Commitment,
  previousState: Commitment["state"],
  nextState: Commitment["state"],
  timestamp: number
): Promise<void> {
  const seriesId = commitment.commitmentSeriesId;
  const poolId = commitment.poolId;
  if (seriesId === undefined || poolId === undefined) return;
  const id = poolingEntityId(commitment.chainId, seriesId);
  const series =
    (await context.CommitmentSeries.get(id)) ??
    createSeries(commitment.chainId, seriesId, timestamp);
  const previousKey = stateCounterKey(previousState);
  const nextKey = stateCounterKey(nextState);
  let updatedSeries: CommitmentSeries = {
    ...series,
    updatedAt: Math.max(series.updatedAt, timestamp),
  };
  if (previousKey && previousKey !== nextKey) {
    updatedSeries = {
      ...updatedSeries,
      [previousKey]: updatedSeries[previousKey] > 0n ? updatedSeries[previousKey] - 1n : 0n,
    };
  }
  if (nextKey && previousKey !== nextKey) {
    updatedSeries = { ...updatedSeries, [nextKey]: updatedSeries[nextKey] + 1n };
  }
  if (nextState === "FULFILLED" && commitment.cycleEntityId) {
    updatedSeries = {
      ...updatedSeries,
      fulfilledCycleIds: sortedUnique([
        ...updatedSeries.fulfilledCycleIds,
        commitment.cycleEntityId,
      ]),
    };
  }
  context.CommitmentSeries.set(updatedSeries);

  if (commitment.cycleId === undefined) return;
  const summaryId = `${commitment.chainId}-${seriesId}-${commitment.cycleId}`;
  const summary =
    (await context.CommitmentSeriesCycleSummary.get(summaryId)) ??
    createSeriesCycleSummary(commitment.chainId, seriesId, commitment.cycleId, poolId, timestamp);
  let updatedSummary: CommitmentSeriesCycleSummary = {
    ...summary,
    updatedAt: Math.max(summary.updatedAt, timestamp),
  };
  if (previousKey && previousKey !== nextKey) {
    updatedSummary = {
      ...updatedSummary,
      [previousKey]: updatedSummary[previousKey] > 0n ? updatedSummary[previousKey] - 1n : 0n,
    };
  }
  if (nextKey && previousKey !== nextKey) {
    updatedSummary = { ...updatedSummary, [nextKey]: updatedSummary[nextKey] + 1n };
  }
  context.CommitmentSeriesCycleSummary.set(updatedSummary);
}

async function applyFulfillmentSideEffects(
  context: PoolingContext,
  commitment: Commitment,
  timestamp: number
): Promise<void> {
  const index = await context.CommitmentEvidenceAttributionIndex.get(commitment.id);
  for (const attributionId of index?.attributionEntityIds ?? []) {
    const attribution = await context.CommitmentEvidenceAttribution.get(attributionId);
    if (attribution && !attribution.confirmed) {
      context.CommitmentEvidenceAttribution.set({
        ...attribution,
        confirmed: true,
        updatedAt: Math.max(attribution.updatedAt, timestamp),
      });
    }
  }
  if (!commitment.needUID) return;
  const needId = `${commitment.chainId}-${commitment.needUID.toLowerCase()}`;
  const need = await context.NeedCommitmentIndex.get(needId);
  if (!need) return;
  context.NeedCommitmentIndex.set({
    ...need,
    fulfilledCommitmentEntityIds: sortedUnique([
      ...need.fulfilledCommitmentEntityIds,
      commitment.id,
    ]),
    updatedAt: Math.max(need.updatedAt, timestamp),
  });
}

async function applyLifecycleState(
  context: PoolingContext,
  commitment: Commitment,
  nextState: Commitment["state"],
  blockNumber: bigint,
  logIndex: number,
  timestamp: number,
  patch: Partial<Commitment> = {}
): Promise<Commitment> {
  if (
    !cursorWins(
      Number(blockNumber),
      logIndex,
      commitment.lifecycleBlockNumber,
      commitment.lifecycleLogIndex
    )
  )
    return commitment;
  const previousState = commitment.state;
  const previousTerminal = isTerminal(previousState);
  const nextTerminal = isTerminal(nextState);
  const updated: Commitment = {
    ...commitment,
    ...patch,
    state: nextState,
    lifecycleBlockNumber: blockNumber,
    lifecycleLogIndex: logIndex,
    updatedAt: Math.max(commitment.updatedAt, timestamp),
  };
  context.Commitment.set(updated);

  if (commitment.poolId !== undefined) {
    const pool = await context.CommitmentPool.get(
      poolingEntityId(commitment.chainId, commitment.poolId)
    );
    if (pool) {
      const transitioned = applyAggregateStateTransition(pool, previousState, nextState);
      context.CommitmentPool.set({
        ...transitioned,
        liveCommitmentCount:
          previousTerminal === nextTerminal
            ? pool.liveCommitmentCount
            : nextTerminal
              ? pool.liveCommitmentCount > 0n
                ? pool.liveCommitmentCount - 1n
                : 0n
              : pool.liveCommitmentCount + 1n,
        commitmentsDue:
          commitment.acceptanceSeen && previousState !== nextState
            ? previousState === "CANCELLED"
              ? pool.commitmentsDue + 1n
              : nextState === "CANCELLED"
                ? pool.commitmentsDue > 0n
                  ? pool.commitmentsDue - 1n
                  : 0n
                : pool.commitmentsDue
            : pool.commitmentsDue,
        updatedAt: Math.max(pool.updatedAt, timestamp),
      });
    }
  }

  if (commitment.cycleId !== undefined) {
    const cycle = await context.CommitmentCycle.get(
      poolingEntityId(commitment.chainId, commitment.cycleId)
    );
    if (cycle) {
      const transitioned = applyAggregateStateTransition(cycle, previousState, nextState);
      context.CommitmentCycle.set({
        ...transitioned,
        liveCommitmentCount:
          previousTerminal === nextTerminal
            ? cycle.liveCommitmentCount
            : nextTerminal
              ? cycle.liveCommitmentCount > 0n
                ? cycle.liveCommitmentCount - 1n
                : 0n
              : cycle.liveCommitmentCount + 1n,
        commitmentsDue:
          commitment.acceptanceSeen && previousState !== nextState
            ? previousState === "CANCELLED"
              ? cycle.commitmentsDue + 1n
              : nextState === "CANCELLED"
                ? cycle.commitmentsDue > 0n
                  ? cycle.commitmentsDue - 1n
                  : 0n
                : cycle.commitmentsDue
            : cycle.commitmentsDue,
        updatedAt: Math.max(cycle.updatedAt, timestamp),
      });
    }
  }
  await applySeriesTransition(context, commitment, previousState, nextState, timestamp);
  if (nextState === "FULFILLED" && previousState !== "FULFILLED") {
    await applyFulfillmentSideEffects(context, updated, timestamp);
  }
  return reconcileMemberHistory(context, updated, timestamp);
}

const BUFFERED_LIFECYCLE_EVENTS = new Set([
  "CommitmentAccepted",
  "CommitmentReadyForConfirmation",
  "ConfirmationRecorded",
  "CommitmentFulfilled",
  "CommitmentCancelled",
  "CommitmentExpired",
  "CommitmentDisputed",
  "DisputeResolved",
]);

async function enqueuePendingLifecycle(
  event: RuntimeEvent,
  context: PoolingContext
): Promise<boolean> {
  if (!BUFFERED_LIFECYCLE_EVENTS.has(event.eventName)) return false;
  const commitmentId = value<bigint>(event, "commitmentId");
  const commitment = await getCommitment(event, context, commitmentId);
  if (commitment.creationSeen) return false;
  context.Commitment.set(commitment);
  const id = eventAuditId(event.chainId, getTxHash(event.transaction), event.logIndex);
  const existing = await context.CommitmentPendingLifecycleProjection.get(id);
  if (!existing) {
    const eventTypeValue = eventType(event.eventName);
    const claimant =
      typeof event.params.claimant === "string"
        ? normalizeAddress(event.params.claimant)
        : undefined;
    const projection: CommitmentPendingLifecycleProjection = {
      id,
      chainId: event.chainId,
      commitmentId,
      commitmentEntityId: commitment.id,
      eventType: eventTypeValue,
      blockNumber: BigInt(event.block.number),
      logIndex: event.logIndex,
      nextState:
        event.eventName === "CommitmentAccepted"
          ? "ACCEPTED"
          : event.eventName === "CommitmentReadyForConfirmation"
            ? "READY_FOR_CONFIRMATION"
            : event.eventName === "CommitmentFulfilled"
              ? "FULFILLED"
              : event.eventName === "CommitmentCancelled"
                ? "CANCELLED"
                : event.eventName === "CommitmentExpired"
                  ? "EXPIRED"
                  : event.eventName === "CommitmentDisputed"
                    ? "DISPUTED"
                    : event.eventName === "DisputeResolved"
                      ? commitmentState(value<bigint>(event, "finalState"))
                      : undefined,
      actor: firstExplicitActor(event),
      claimType:
        typeof event.params.kind === "bigint" ? commitmentClaimType(event.params.kind) : undefined,
      gardenContext:
        typeof event.params.gardenContext === "string"
          ? normalizeAddress(event.params.gardenContext)
          : undefined,
      claimant,
      counterparty:
        typeof event.params.counterparty === "string"
          ? normalizeAddress(event.params.counterparty)
          : undefined,
      leadProvider:
        typeof event.params.leadProvider === "string"
          ? normalizeAddress(event.params.leadProvider)
          : undefined,
      providerGarden:
        typeof event.params.providerGarden === "string"
          ? normalizeAddress(event.params.providerGarden)
          : undefined,
      payerGarden:
        typeof event.params.payerGarden === "string"
          ? normalizeAddress(event.params.payerGarden)
          : undefined,
      confirmationCount:
        typeof event.params.confirmationCount === "bigint"
          ? Number(event.params.confirmationCount)
          : undefined,
      confirmationThreshold:
        typeof event.params.threshold === "bigint" ? Number(event.params.threshold) : undefined,
      overridden:
        typeof event.params.overridden === "boolean" ? event.params.overridden : undefined,
      confirmationPath:
        typeof event.params.confirmationPath === "bigint"
          ? confirmationPath(event.params.confirmationPath)
          : undefined,
      previousState:
        typeof event.params.previousState === "bigint"
          ? commitmentState(event.params.previousState)
          : undefined,
      disputeResolution:
        typeof event.params.resolution === "bigint" ? Number(event.params.resolution) : undefined,
      data:
        typeof event.params.reasonCID === "string"
          ? event.params.reasonCID
          : typeof event.params.reason === "string"
            ? event.params.reason
            : undefined,
      applied: false,
      createdAt: event.block.timestamp,
      updatedAt: event.block.timestamp,
    };
    context.CommitmentPendingLifecycleProjection.set(projection);
  }
  const index = await context.CommitmentPendingLifecycleProjectionIndex.get(commitment.id);
  context.CommitmentPendingLifecycleProjectionIndex.set({
    id: commitment.id,
    chainId: event.chainId,
    commitmentId,
    commitmentEntityId: commitment.id,
    projectionIds: sortedUnique([...(index?.projectionIds ?? []), id]),
    updatedAt: Math.max(index?.updatedAt ?? 0, event.block.timestamp),
  });
  return true;
}

async function applyPendingProjection(
  context: PoolingContext,
  commitment: Commitment,
  projection: CommitmentPendingLifecycleProjection
): Promise<Commitment> {
  let patch: Partial<Commitment> = {};
  if (projection.eventType === "ACCEPTED") {
    patch = {
      acceptanceSeen: true,
      counterparty: projection.counterparty,
      leadProvider: projection.leadProvider,
      providerGarden: projection.providerGarden,
      providerGardenId: projection.providerGarden,
      payerGarden: projection.payerGarden,
      payerGardenId: projection.payerGarden,
      counterpartyKind: projection.claimType,
      acceptanceBlockNumber: projection.blockNumber,
      acceptanceLogIndex: projection.logIndex,
    };
  } else if (projection.eventType === "READY_FOR_CONFIRMATION") {
    patch = { readyOverridden: projection.overridden ?? false };
  } else if (projection.eventType === "CONFIRMATION_RECORDED") {
    const updated = {
      ...commitment,
      confirmationCount: Math.max(commitment.confirmationCount, projection.confirmationCount ?? 0),
      confirmationThreshold: projection.confirmationThreshold ?? commitment.confirmationThreshold,
      confirmers: projection.actor
        ? sortedUnique([...commitment.confirmers, projection.actor])
        : commitment.confirmers,
      updatedAt: Math.max(commitment.updatedAt, projection.updatedAt),
    };
    context.Commitment.set(updated);
    if (projection.actor) {
      await recordMemberEvent(
        context,
        updated,
        projection.actor,
        "confirmationsGiven",
        projection.updatedAt
      );
    }
    return updated;
  } else if (projection.eventType === "FULFILLED") {
    patch = {
      fulfilledBy: projection.actor,
      confirmationPath: projection.confirmationPath,
      fallbackReason: projection.data || undefined,
      fulfilledByFallback:
        projection.confirmationPath === "POOL_FALLBACK" ||
        projection.confirmationPath === "PROTOCOL_FALLBACK",
    };
  } else if (projection.eventType === "CANCELLED") {
    patch = { cancelReasonCID: projection.data };
  } else if (projection.eventType === "DISPUTED") {
    patch = {
      preDisputeState: projection.previousState,
      disputeReasonCID: projection.data,
    };
  } else if (projection.eventType === "DISPUTE_RESOLVED") {
    patch = {
      fulfilledBy: undefined,
      confirmationPath: undefined,
      fallbackReason: undefined,
      fulfilledByFallback: false,
    };
  }
  if (!projection.nextState) return commitment;
  const updated = await applyLifecycleState(
    context,
    commitment,
    projection.nextState,
    projection.blockNumber,
    projection.logIndex,
    projection.updatedAt,
    patch
  );
  if (projection.eventType === "ACCEPTED") {
    const accepted = await applyAcceptanceSideEffects(
      context,
      commitment,
      updated,
      projection.claimant,
      projection.updatedAt
    );
    await sweepClaimRequests(
      context,
      accepted,
      projection.claimant,
      "COMMITMENT_ACCEPTED",
      projection.updatedAt
    );
    return accepted;
  }
  if (
    projection.eventType === "CANCELLED" ||
    projection.eventType === "EXPIRED" ||
    (projection.eventType === "DISPUTE_RESOLVED" &&
      (updated.state === "CANCELLED" || updated.state === "EXPIRED"))
  ) {
    await sweepClaimRequests(
      context,
      updated,
      undefined,
      updated.state === "CANCELLED" ? "COMMITMENT_CANCELLED" : "COMMITMENT_EXPIRED",
      projection.updatedAt
    );
  }
  if (projection.eventType === "DISPUTED" && projection.actor) {
    await recordMemberEvent(
      context,
      updated,
      projection.actor,
      "disputesRaised",
      projection.updatedAt
    );
  }
  return updated;
}

async function drainPendingLifecycle(
  context: PoolingContext,
  commitment: Commitment
): Promise<Commitment> {
  const index = await context.CommitmentPendingLifecycleProjectionIndex.get(commitment.id);
  if (!index || index.projectionIds.length === 0) return commitment;
  const projections = (
    await Promise.all(
      index.projectionIds.map((id) => context.CommitmentPendingLifecycleProjection.get(id))
    )
  )
    .filter((projection): projection is CommitmentPendingLifecycleProjection => Boolean(projection))
    .sort((left, right) => {
      if (left.blockNumber !== right.blockNumber)
        return left.blockNumber < right.blockNumber ? -1 : 1;
      if (left.logIndex !== right.logIndex) return left.logIndex - right.logIndex;
      return left.id.localeCompare(right.id);
    });
  let updated = commitment;
  for (const projection of projections) {
    if (!projection.applied) {
      updated = await applyPendingProjection(context, updated, projection);
      context.CommitmentPendingLifecycleProjection.set({
        ...projection,
        applied: true,
        updatedAt: Math.max(projection.updatedAt, updated.updatedAt),
      });
    }
  }
  context.CommitmentPendingLifecycleProjectionIndex.set({
    ...index,
    projectionIds: [],
    updatedAt: Math.max(index.updatedAt, updated.updatedAt),
  });
  return updated;
}

async function createRequirementRows(
  event: RuntimeEvent,
  context: PoolingContext,
  commitmentId: bigint
): Promise<void> {
  const actionUIDs = value<readonly bigint[]>(event, "requirementActionUIDs");
  const domains = value<readonly bigint[]>(event, "requirementDomains");
  const requiredCounts = value<readonly bigint[]>(event, "requirementRequiredCounts");
  for (let index = 0; index < actionUIDs.length; index += 1) {
    const entityId = `${event.chainId}-${commitmentId}-${index}`;
    if (await context.CommitmentRequirement.get(entityId)) continue;
    context.CommitmentRequirement.set({
      id: entityId,
      chainId: event.chainId,
      commitmentId,
      commitmentEntityId: poolingEntityId(event.chainId, commitmentId),
      requirementIndex: index,
      domain: Number(domains[index] ?? 0n),
      actionUID: actionUIDs[index] ?? 0n,
      requiredCount: Number(requiredCounts[index] ?? 0n),
      approvedCount: 0,
      createdAt: event.block.timestamp,
      updatedAt: event.block.timestamp,
    });
  }
}

async function handleCommitmentCreated(
  event: RuntimeEvent,
  context: PoolingContext
): Promise<void> {
  const commitmentId = value<bigint>(event, "commitmentId");
  const poolId = value<bigint>(event, "poolId");
  const pool = await getPool(event, context, poolId);
  const existing = await getCommitment(event, context, commitmentId);
  const direction = commitmentDirection(value<bigint>(event, "direction"));
  const cycleId = optionalBigint(event, "cycleId");
  const seriesId = optionalBigint(event, "commitmentSeriesId");
  const needUID = optionalBytes32(event, "needUID");
  const counterCommitmentId = optionalBigint(event, "counterCommitmentId");
  const payerGarden = normalizeAddress(value<string>(event, "payerGarden"));
  const initialState = direction === "OFFER" ? "OFFERED" : "REQUESTED";
  const created: Commitment = {
    ...existing,
    creationSeen: true,
    creationRequestKey: value<string>(event, "creationRequestKey").toLowerCase(),
    creationPayloadHash: value<string>(event, "creationPayloadHash").toLowerCase(),
    poolId,
    poolEntityId: pool.id,
    cycleId,
    cycleEntityId: cycleId === undefined ? undefined : poolingEntityId(event.chainId, cycleId),
    commitmentSeriesId: seriesId,
    commitmentSeriesEntityId:
      seriesId === undefined ? undefined : poolingEntityId(event.chainId, seriesId),
    garden: pool.registrationSeen ? pool.garden : existing.garden,
    gardenId: pool.registrationSeen ? pool.gardenId : existing.gardenId,
    creator: normalizeAddress(value<string>(event, "creator")),
    recordedBy: normalizeAddress(value<string>(event, "recordedBy")),
    payerGarden,
    payerGardenId: payerGarden,
    direction,
    commitmentType: commitmentKind(value<bigint>(event, "commitmentType")),
    state: existing.lifecycleBlockNumber === undefined ? initialState : existing.state,
    claimType: commitmentClaimType(value<bigint>(event, "claimType")),
    claimMode: commitmentClaimMode(value<bigint>(event, "claimMode")),
    contributorPolicy: contributorPolicy(value<bigint>(event, "contributorPolicy")),
    domains: sortedUnique(value<readonly bigint[]>(event, "domains").map(Number)),
    requirementCount: value<readonly bigint[]>(event, "requirementActionUIDs").length,
    unitLabel: value<string>(event, "unitLabel"),
    targetUnits: value<bigint>(event, "targetUnits"),
    requiresAssessment: value<boolean>(event, "requiresAssessment"),
    dueDate: optionalBigint(event, "dueDate"),
    metadataCID: value<string>(event, "metadataCID"),
    needUID,
    counterCommitmentId,
    counterCommitmentEntityId:
      counterCommitmentId === undefined
        ? undefined
        : poolingEntityId(event.chainId, counterCommitmentId),
    declaredUnitValue: optionalBigint(event, "declaredUnitValue"),
    declaredValueBasis: value<string>(event, "declaredValueBasis") || existing.declaredValueBasis,
    lifecycleBlockNumber: existing.lifecycleBlockNumber ?? BigInt(event.block.number),
    lifecycleLogIndex: existing.lifecycleLogIndex ?? event.logIndex,
    createdAt: existing.createdAt ?? event.block.timestamp,
    updatedAt: Math.max(existing.updatedAt, event.block.timestamp),
  };
  context.Commitment.set(created);
  await createRequirementRows(event, context, commitmentId);

  if (!pool.registrationSeen) context.CommitmentPool.set(pool);
  const countKey = direction === "OFFER" ? "commitmentsOffered" : "commitmentsRequested";
  context.CommitmentPool.set({
    ...pool,
    [countKey]: pool[countKey] + 1n,
    liveCommitmentCount: pool.liveCommitmentCount + 1n,
    updatedAt: Math.max(pool.updatedAt, event.block.timestamp),
  });

  if (cycleId !== undefined) {
    const cycle =
      (await context.CommitmentCycle.get(poolingEntityId(event.chainId, cycleId))) ??
      createCycle(event.chainId, cycleId, poolId, event.block.timestamp);
    context.CommitmentCycle.set({
      ...cycle,
      liveCommitmentCount: cycle.liveCommitmentCount + 1n,
      updatedAt: Math.max(cycle.updatedAt, event.block.timestamp),
    });
  }

  if (seriesId !== undefined) {
    const series =
      (await context.CommitmentSeries.get(poolingEntityId(event.chainId, seriesId))) ??
      createSeries(event.chainId, seriesId, event.block.timestamp);
    context.CommitmentSeries.set({
      ...series,
      instanceCount: series.instanceCount + 1n,
      offeredCount: series.offeredCount + (direction === "OFFER" ? 1n : 0n),
      updatedAt: Math.max(series.updatedAt, event.block.timestamp),
    });
    if (cycleId !== undefined) {
      const summaryId = `${event.chainId}-${seriesId}-${cycleId}`;
      const summary =
        (await context.CommitmentSeriesCycleSummary.get(summaryId)) ??
        createSeriesCycleSummary(event.chainId, seriesId, cycleId, poolId, event.block.timestamp);
      context.CommitmentSeriesCycleSummary.set({
        ...summary,
        instanceCount: summary.instanceCount + 1n,
        offeredCount: summary.offeredCount + (direction === "OFFER" ? 1n : 0n),
        updatedAt: Math.max(summary.updatedAt, event.block.timestamp),
      });
    }
  }

  if (needUID !== undefined) {
    const indexId = `${event.chainId}-${needUID.toLowerCase()}`;
    const needIndex = await context.NeedCommitmentIndex.get(indexId);
    context.NeedCommitmentIndex.set({
      id: indexId,
      chainId: event.chainId,
      needUID: needUID.toLowerCase(),
      commitmentEntityIds: sortedUnique([
        ...(needIndex?.commitmentEntityIds ?? []),
        poolingEntityId(event.chainId, commitmentId),
      ]),
      fulfilledCommitmentEntityIds: needIndex?.fulfilledCommitmentEntityIds ?? [],
      cycleEntityIds: needIndex?.cycleEntityIds ?? [],
      hypercertEntityIds: needIndex?.hypercertEntityIds ?? [],
      updatedAt: Math.max(needIndex?.updatedAt ?? 0, event.block.timestamp),
    });
  }

  if (counterCommitmentId !== undefined) {
    const indexId = poolingEntityId(event.chainId, counterCommitmentId);
    const counterIndex = await context.CommitmentCounterIndex.get(indexId);
    context.CommitmentCounterIndex.set({
      id: indexId,
      chainId: event.chainId,
      commitmentId: counterCommitmentId,
      commitmentEntityId: indexId,
      referencingCommitmentEntityIds: sortedUnique([
        ...(counterIndex?.referencingCommitmentEntityIds ?? []),
        poolingEntityId(event.chainId, commitmentId),
      ]),
      updatedAt: Math.max(counterIndex?.updatedAt ?? 0, event.block.timestamp),
    });
  }
  await drainPendingLifecycle(context, created);
}

async function handleCommitmentTerms(event: RuntimeEvent, context: PoolingContext): Promise<void> {
  const commitmentId = value<bigint>(event, "commitmentId");
  const commitment = await getCommitment(event, context, commitmentId);
  if (event.eventName === "ConsiderationDeclared") {
    if (
      !cursorWins(
        event.block.number,
        event.logIndex,
        commitment.considerationUpdateBlockNumber,
        commitment.considerationUpdateLogIndex
      )
    )
      return;
    context.Commitment.set({
      ...commitment,
      considerationRail: considerationRail(value<bigint>(event, "rail")),
      considerationSource: normalizeAddress(value<string>(event, "source")),
      considerationToken: normalizeAddress(value<string>(event, "token")),
      considerationAmount: value<bigint>(event, "amount"),
      considerationUpdateBlockNumber: BigInt(event.block.number),
      considerationUpdateLogIndex: event.logIndex,
      updatedAt: Math.max(commitment.updatedAt, event.block.timestamp),
    });
    return;
  }
  if (event.eventName === "ValueDeclared") {
    if (
      !cursorWins(
        event.block.number,
        event.logIndex,
        commitment.declaredValueUpdateBlockNumber,
        commitment.declaredValueUpdateLogIndex
      )
    )
      return;
    context.Commitment.set({
      ...commitment,
      declaredUnitValue: value<bigint>(event, "declaredUnitValue"),
      declaredValueBasis: value<string>(event, "declaredValueBasis"),
      declaredValueUpdateBlockNumber: BigInt(event.block.number),
      declaredValueUpdateLogIndex: event.logIndex,
      updatedAt: Math.max(commitment.updatedAt, event.block.timestamp),
    });
    return;
  }
  if (
    !cursorWins(
      event.block.number,
      event.logIndex,
      commitment.confirmerRuleUpdateBlockNumber,
      commitment.confirmerRuleUpdateLogIndex
    )
  )
    return;
  context.Commitment.set({
    ...commitment,
    confirmers: sortedUnique(value<readonly string[]>(event, "confirmers").map(normalizeAddress)),
    confirmationThreshold: Number(value<bigint>(event, "threshold")),
    protocolFallbackEnabled: value<boolean>(event, "protocolFallbackEnabled"),
    confirmerRuleUpdateBlockNumber: BigInt(event.block.number),
    confirmerRuleUpdateLogIndex: event.logIndex,
    updatedAt: Math.max(commitment.updatedAt, event.block.timestamp),
  });
}

async function handleClaimEvent(event: RuntimeEvent, context: PoolingContext): Promise<void> {
  const commitmentId = value<bigint>(event, "commitmentId");
  const claimant = normalizeAddress(value<string>(event, "claimant"));
  const id = commitmentMemberId(event.chainId, commitmentId, claimant);
  const existing = await context.CommitmentClaimRequest.get(id);
  const rowWins =
    !existing ||
    cursorWins(
      event.block.number,
      event.logIndex,
      existing.lifecycleBlockNumber,
      existing.lifecycleLogIndex
    );
  const commitment = await getCommitment(event, context, commitmentId);
  const acceptanceIsNewer =
    commitment.acceptanceBlockNumber !== undefined &&
    !cursorWins(
      event.block.number,
      event.logIndex,
      commitment.acceptanceBlockNumber,
      commitment.acceptanceLogIndex
    );
  const terminalIsNewer =
    isTerminal(commitment.state) &&
    commitment.lifecycleBlockNumber !== undefined &&
    !cursorWins(
      event.block.number,
      event.logIndex,
      commitment.lifecycleBlockNumber,
      commitment.lifecycleLogIndex
    );
  const gardenContext =
    event.eventName === "ClaimRequested"
      ? normalizeAddress(value<string>(event, "gardenContext"))
      : existing?.gardenContext;
  const requested = event.eventName === "ClaimRequested";
  const nextState: CommitmentClaimRequest["state"] = requested
    ? acceptanceIsNewer
      ? commitment.counterparty === claimant
        ? "ACCEPTED"
        : "SUPERSEDED"
      : terminalIsNewer
        ? "SUPERSEDED"
        : rowWins
          ? "PENDING"
          : (existing?.state ?? "PENDING")
    : rowWins
      ? "DECLINED"
      : (existing?.state ?? "DECLINED");
  const request: CommitmentClaimRequest = {
    id,
    chainId: event.chainId,
    commitmentId,
    commitmentEntityId: poolingEntityId(event.chainId, commitmentId),
    claimant,
    requestSeen: requested || (existing?.requestSeen ?? false),
    requestedBy: requested
      ? normalizeAddress(value<string>(event, "requestedBy"))
      : existing?.requestedBy,
    claimType: requested ? commitmentClaimType(value<bigint>(event, "kind")) : existing?.claimType,
    gardenContext,
    gardenContextId: gardenContext,
    state: nextState,
    reasonCID:
      event.eventName === "ClaimDeclined" && rowWins
        ? value<string>(event, "reasonCID")
        : nextState === "PENDING"
          ? undefined
          : existing?.reasonCID,
    resolutionCode:
      nextState === "DECLINED"
        ? "CLAIM_DECLINED"
        : nextState === "ACCEPTED"
          ? "COMMITMENT_ACCEPTED"
          : nextState === "SUPERSEDED"
            ? terminalIsNewer
              ? commitment.state === "CANCELLED"
                ? "COMMITMENT_CANCELLED"
                : "COMMITMENT_EXPIRED"
              : "COMMITMENT_ACCEPTED"
            : undefined,
    lifecycleBlockNumber: rowWins ? BigInt(event.block.number) : existing?.lifecycleBlockNumber,
    lifecycleLogIndex: rowWins ? event.logIndex : existing?.lifecycleLogIndex,
    requestedAt: requested ? Number(value<bigint>(event, "requestedAt")) : existing?.requestedAt,
    resolvedAt:
      nextState === "PENDING" ? undefined : (existing?.resolvedAt ?? event.block.timestamp),
    updatedAt: Math.max(existing?.updatedAt ?? 0, event.block.timestamp),
  };
  context.CommitmentClaimRequest.set(request);
  const indexId = poolingEntityId(event.chainId, commitmentId);
  const requestIndex = await context.CommitmentClaimRequestIndex.get(indexId);
  context.CommitmentClaimRequestIndex.set({
    id: indexId,
    chainId: event.chainId,
    commitmentId,
    commitmentEntityId: indexId,
    requestIds: sortedUnique([...(requestIndex?.requestIds ?? []), id]),
    updatedAt: Math.max(requestIndex?.updatedAt ?? 0, event.block.timestamp),
  });
}

type ClaimResolutionCode = "COMMITMENT_ACCEPTED" | "COMMITMENT_CANCELLED" | "COMMITMENT_EXPIRED";

async function sweepClaimRequests(
  context: PoolingContext,
  commitment: Commitment,
  acceptedClaimant: string | undefined,
  resolutionCode: ClaimResolutionCode,
  timestamp: number
): Promise<void> {
  const requestIndex = await context.CommitmentClaimRequestIndex.get(commitment.id);
  for (const requestId of requestIndex?.requestIds ?? []) {
    const request = await context.CommitmentClaimRequest.get(requestId);
    if (!request || request.state !== "PENDING") continue;
    const accepted =
      resolutionCode === "COMMITMENT_ACCEPTED" &&
      acceptedClaimant !== undefined &&
      request.claimant === normalizeAddress(acceptedClaimant);
    context.CommitmentClaimRequest.set({
      ...request,
      state: accepted ? "ACCEPTED" : "SUPERSEDED",
      resolutionCode,
      resolvedAt: timestamp,
      updatedAt: Math.max(request.updatedAt, timestamp),
    });
  }
}

async function recordMemberEvent(
  context: PoolingContext,
  commitment: Commitment,
  account: string | undefined,
  counter: MemberHistoryCounter,
  timestamp: number
): Promise<void> {
  if (commitment.poolId === undefined || account === undefined) return;
  await applyMemberHistoryDelta(
    context,
    commitment.chainId,
    commitment.poolId,
    account,
    counter,
    1,
    timestamp
  );
}

async function applyAcceptanceSideEffects(
  context: PoolingContext,
  previous: Commitment,
  accepted: Commitment,
  claimant: string | undefined,
  timestamp: number
): Promise<Commitment> {
  if (previous.acceptanceSeen || accepted.poolId === undefined) {
    return reconcileMemberHistory(context, accepted, timestamp);
  }
  const pool = await context.CommitmentPool.get(poolingEntityId(accepted.chainId, accepted.poolId));
  if (pool) {
    context.CommitmentPool.set({
      ...pool,
      commitmentsDue:
        accepted.state === "CANCELLED" ? pool.commitmentsDue : pool.commitmentsDue + 1n,
      updatedAt: Math.max(pool.updatedAt, timestamp),
    });
  }
  if (accepted.cycleId !== undefined) {
    const cycle = await context.CommitmentCycle.get(
      poolingEntityId(accepted.chainId, accepted.cycleId)
    );
    if (cycle) {
      context.CommitmentCycle.set({
        ...cycle,
        commitmentsDue:
          accepted.state === "CANCELLED" ? cycle.commitmentsDue : cycle.commitmentsDue + 1n,
        updatedAt: Math.max(cycle.updatedAt, timestamp),
      });
    }
  }
  if (accepted.leadProvider) {
    const leadId = commitmentMemberId(
      accepted.chainId,
      accepted.commitmentId,
      accepted.leadProvider
    );
    const lead = await context.CommitmentContributor.get(leadId);
    if (lead && !lead.isLead) {
      context.CommitmentContributor.set({
        ...lead,
        isLead: true,
        updatedAt: Math.max(lead.updatedAt, timestamp),
      });
    }
  }
  await recordMemberEvent(
    context,
    accepted,
    accepted.leadProvider ?? claimant,
    "leadAccepted",
    timestamp
  );
  return reconcileMemberHistory(context, accepted, timestamp);
}

async function handleAccepted(event: RuntimeEvent, context: PoolingContext): Promise<void> {
  const commitmentId = value<bigint>(event, "commitmentId");
  const commitment = await getCommitment(event, context, commitmentId);
  const claimant = normalizeAddress(value<string>(event, "claimant"));
  const providerGarden = normalizeAddress(value<string>(event, "providerGarden"));
  const payerGarden = normalizeAddress(value<string>(event, "payerGarden"));
  let accepted = await applyLifecycleState(
    context,
    commitment,
    "ACCEPTED",
    BigInt(event.block.number),
    event.logIndex,
    event.block.timestamp,
    {
      acceptanceSeen: true,
      counterparty: normalizeAddress(value<string>(event, "counterparty")),
      leadProvider: normalizeAddress(value<string>(event, "leadProvider")),
      providerGarden,
      providerGardenId: providerGarden,
      payerGarden,
      payerGardenId: payerGarden,
      counterpartyKind: commitmentClaimType(value<bigint>(event, "kind")),
      acceptanceBlockNumber: BigInt(event.block.number),
      acceptanceLogIndex: event.logIndex,
    }
  );
  if (!accepted.acceptanceSeen) {
    accepted = {
      ...accepted,
      acceptanceSeen: true,
      counterparty: normalizeAddress(value<string>(event, "counterparty")),
      leadProvider: normalizeAddress(value<string>(event, "leadProvider")),
      providerGarden,
      providerGardenId: providerGarden,
      payerGarden,
      payerGardenId: payerGarden,
      counterpartyKind: commitmentClaimType(value<bigint>(event, "kind")),
      acceptanceBlockNumber: BigInt(event.block.number),
      acceptanceLogIndex: event.logIndex,
      updatedAt: Math.max(accepted.updatedAt, event.block.timestamp),
    };
    context.Commitment.set(accepted);
  }
  accepted = await applyAcceptanceSideEffects(
    context,
    commitment,
    accepted,
    claimant,
    event.block.timestamp
  );
  await sweepClaimRequests(
    context,
    accepted,
    claimant,
    "COMMITMENT_ACCEPTED",
    event.block.timestamp
  );
}

async function handleExchange(event: RuntimeEvent, context: PoolingContext): Promise<void> {
  const poolId = value<bigint>(event, "poolId");
  const commitmentIdA = value<bigint>(event, "commitmentIdA");
  const commitmentIdB = value<bigint>(event, "commitmentIdB");
  const id = `${event.chainId}-EXCHANGE-${poolId}-${commitmentIdA}-${commitmentIdB}`;
  if (await context.CommitmentExchange.get(id)) return;
  context.CommitmentExchange.set({
    id,
    chainId: event.chainId,
    poolId,
    poolEntityId: poolingEntityId(event.chainId, poolId),
    commitmentIdA,
    commitmentEntityIdA: poolingEntityId(event.chainId, commitmentIdA),
    commitmentIdB,
    commitmentEntityIdB: poolingEntityId(event.chainId, commitmentIdB),
    acceptorA: normalizeAddress(value<string>(event, "acceptorA")),
    acceptorB: normalizeAddress(value<string>(event, "acceptorB")),
    txHash: getTxHash(event.transaction).toLowerCase(),
    acceptedAt: event.block.timestamp,
  });
}

async function addContributorToIndex(
  event: RuntimeEvent,
  context: PoolingContext,
  commitmentId: bigint,
  contributorEntityId: string
): Promise<void> {
  const indexId = poolingEntityId(event.chainId, commitmentId);
  const contributorIndex = await context.CommitmentContributorIndex.get(indexId);
  context.CommitmentContributorIndex.set({
    id: indexId,
    chainId: event.chainId,
    commitmentId,
    commitmentEntityId: indexId,
    contributorEntityIds: sortedUnique([
      ...(contributorIndex?.contributorEntityIds ?? []),
      contributorEntityId,
    ]),
    updatedAt: Math.max(contributorIndex?.updatedAt ?? 0, event.block.timestamp),
  });
}

async function handleContributorEvent(event: RuntimeEvent, context: PoolingContext): Promise<void> {
  const commitmentId = value<bigint>(event, "commitmentId");
  const contributor = normalizeAddress(value<string>(event, "contributor"));
  const id = commitmentMemberId(event.chainId, commitmentId, contributor);
  const existing =
    (await context.CommitmentContributor.get(id)) ??
    createContributor(event.chainId, commitmentId, contributor, event.block.timestamp);
  if (event.eventName === "ContributorRequirementAssigned") {
    const requirementIndex = Number(value<bigint>(event, "requirementIndex"));
    const assignmentId = `${id}-${requirementIndex}`;
    const assignment = await context.CommitmentContributorRequirementAssignment.get(assignmentId);
    if (
      assignment &&
      !cursorWins(
        event.block.number,
        event.logIndex,
        assignment.lifecycleBlockNumber,
        assignment.lifecycleLogIndex
      )
    )
      return;
    const assigned = value<boolean>(event, "assigned");
    context.CommitmentContributorRequirementAssignment.set({
      id: assignmentId,
      chainId: event.chainId,
      commitmentId,
      commitmentEntityId: poolingEntityId(event.chainId, commitmentId),
      contributor,
      contributorEntityId: id,
      requirementIndex,
      assigned,
      lifecycleBlockNumber: BigInt(event.block.number),
      lifecycleLogIndex: event.logIndex,
      updatedAt: event.block.timestamp,
    });
    context.CommitmentContributor.set({
      ...existing,
      requirementIndexes: assigned
        ? sortedUnique([...existing.requirementIndexes, requirementIndex])
        : existing.requirementIndexes.filter((candidate) => candidate !== requirementIndex),
      updatedAt: Math.max(existing.updatedAt, event.block.timestamp),
    });
    const indexId = poolingEntityId(event.chainId, commitmentId);
    const assignmentIndex = await context.CommitmentContributorRequirementIndex.get(indexId);
    context.CommitmentContributorRequirementIndex.set({
      id: indexId,
      chainId: event.chainId,
      commitmentId,
      commitmentEntityId: indexId,
      assignmentEntityIds: sortedUnique([
        ...(assignmentIndex?.assignmentEntityIds ?? []),
        assignmentId,
      ]),
      updatedAt: Math.max(assignmentIndex?.updatedAt ?? 0, event.block.timestamp),
    });
    return;
  }
  if (
    !cursorWins(
      event.block.number,
      event.logIndex,
      existing.membershipBlockNumber,
      existing.membershipLogIndex
    )
  )
    return;
  const adding = event.eventName === "ContributorAdded";
  const commitment = await getCommitment(event, context, commitmentId);
  const updatedContributor = {
    ...existing,
    additionSeen: adding || existing.additionSeen,
    active: adding,
    isLead: existing.isLead || commitment.leadProvider === contributor,
    membershipBlockNumber: BigInt(event.block.number),
    membershipLogIndex: event.logIndex,
    addedBy: adding ? normalizeAddress(value<string>(event, "addedBy")) : existing.addedBy,
    addedAt: adding ? (existing.addedAt ?? event.block.timestamp) : existing.addedAt,
    removedBy: adding ? existing.removedBy : normalizeAddress(value<string>(event, "removedBy")),
    removedAt: adding ? existing.removedAt : event.block.timestamp,
    updatedAt: Math.max(existing.updatedAt, event.block.timestamp),
  } satisfies CommitmentContributor;
  context.CommitmentContributor.set(updatedContributor);
  await addContributorToIndex(event, context, commitmentId, id);
  const activeDelta = existing.active === adding ? 0 : adding ? 1 : -1;
  const updatedCommitment = {
    ...commitment,
    contributorCount: Math.max(0, commitment.contributorCount + activeDelta),
    contributorEntityIds: sortedUnique([...commitment.contributorEntityIds, id]),
    updatedAt: Math.max(commitment.updatedAt, event.block.timestamp),
  } satisfies Commitment;
  context.Commitment.set(updatedCommitment);
  await reconcileMemberHistory(context, updatedCommitment, event.block.timestamp);
  await reconcileRecognitionWeights(context, updatedCommitment, event.block.timestamp);
}

async function handleWorkEvent(event: RuntimeEvent, context: PoolingContext): Promise<void> {
  const commitmentId = value<bigint>(event, "commitmentId");
  const workUID = value<string>(event, "workUID").toLowerCase();
  const id = workAttributionId(event.chainId, workUID);
  const existing =
    (await context.CommitmentWorkAttribution.get(id)) ??
    createWorkAttribution(event.chainId, commitmentId, workUID, event.block.timestamp);
  if (event.eventName === "WorkLinked" || event.eventName === "WorkUnlinked") {
    if (
      !cursorWins(
        event.block.number,
        event.logIndex,
        existing.linkLifecycleBlockNumber,
        existing.linkLifecycleLogIndex
      )
    )
      return;
    const linking = event.eventName === "WorkLinked";
    const contributor = linking
      ? normalizeAddress(value<string>(event, "contributor"))
      : existing.contributor;
    const updatedAttribution = {
      ...existing,
      linkSeen: linking || existing.linkSeen,
      contributor,
      contributorEntityId:
        contributor === undefined
          ? undefined
          : commitmentMemberId(event.chainId, commitmentId, contributor),
      requirementIndex: linking
        ? Number(value<bigint>(event, "requirementIndex"))
        : existing.requirementIndex,
      operationKey: linking
        ? value<string>(event, "operationKey").toLowerCase()
        : existing.operationKey,
      linked: linking,
      linkLifecycleBlockNumber: BigInt(event.block.number),
      linkLifecycleLogIndex: event.logIndex,
      linkedBy: linking ? normalizeAddress(value<string>(event, "linker")) : existing.linkedBy,
      linkedAt: linking ? (existing.linkedAt ?? event.block.timestamp) : existing.linkedAt,
      unlinkedBy: linking
        ? existing.unlinkedBy
        : normalizeAddress(value<string>(event, "unlinker")),
      unlinkedAt: linking ? existing.unlinkedAt : event.block.timestamp,
      updatedAt: Math.max(existing.updatedAt, event.block.timestamp),
    } satisfies CommitmentWorkAttribution;
    context.CommitmentWorkAttribution.set(updatedAttribution);
    const linkDelta = existing.linked === linking ? 0 : linking ? 1 : -1;
    const commitment = await getCommitment(event, context, commitmentId);
    const updatedCommitment = {
      ...commitment,
      workUIDs: linking
        ? sortedUnique([...commitment.workUIDs, workUID])
        : commitment.workUIDs.filter((candidate) => candidate !== workUID),
      updatedAt: Math.max(commitment.updatedAt, event.block.timestamp),
    } satisfies Commitment;
    context.Commitment.set(updatedCommitment);
    if (commitment.poolId !== undefined && linkDelta !== 0) {
      const pool = await context.CommitmentPool.get(
        poolingEntityId(event.chainId, commitment.poolId)
      );
      if (pool) {
        const nextWorkLinkedCount = pool.workLinkedCount + BigInt(linkDelta);
        context.CommitmentPool.set({
          ...pool,
          workLinkedCount: nextWorkLinkedCount < 0n ? 0n : nextWorkLinkedCount,
          updatedAt: Math.max(pool.updatedAt, event.block.timestamp),
        });
      }
    }
    if (contributor && linkDelta !== 0) {
      const contributorId = commitmentMemberId(event.chainId, commitmentId, contributor);
      const contributorRow =
        (await context.CommitmentContributor.get(contributorId)) ??
        createContributor(event.chainId, commitmentId, contributor, event.block.timestamp);
      const uncountedDelta = updatedAttribution.creditActive ? 0 : linkDelta;
      context.CommitmentContributor.set({
        ...contributorRow,
        uncountedLinkedWorkCount: Math.max(
          0,
          contributorRow.uncountedLinkedWorkCount + uncountedDelta
        ),
        updatedAt: Math.max(contributorRow.updatedAt, event.block.timestamp),
      });
      await addContributorToIndex(event, context, commitmentId, contributorId);
    }
    return;
  }
  const sequence = value<bigint>(event, "decisionSequence");
  if (existing.latestDecisionSequence !== undefined && sequence <= existing.latestDecisionSequence)
    return;
  const counted = event.eventName === "ApprovedWorkCounted";
  const contributor = normalizeAddress(value<string>(event, "contributor"));
  const creditDelta = existing.creditActive === counted ? 0 : counted ? 1 : -1;
  context.CommitmentWorkAttribution.set({
    ...existing,
    contributor,
    contributorEntityId: commitmentMemberId(
      event.chainId,
      commitmentId,
      value<string>(event, "contributor")
    ),
    requirementIndex: Number(value<bigint>(event, "requirementIndex")),
    creditActive: counted,
    latestDecisionSequence: sequence,
    latestDecisionUID: value<string>(event, counted ? "approvalUID" : "decisionUID").toLowerCase(),
    updatedAt: Math.max(existing.updatedAt, event.block.timestamp),
  });
  const commitment = await getCommitment(event, context, commitmentId);
  context.Commitment.set({
    ...commitment,
    approvedUnits: value<bigint>(event, "approvedUnits"),
    updatedAt: Math.max(commitment.updatedAt, event.block.timestamp),
  });
  const requirementIndex = Number(value<bigint>(event, "requirementIndex"));
  const requirementId = `${event.chainId}-${commitmentId}-${requirementIndex}`;
  const requirement = await context.CommitmentRequirement.get(requirementId);
  if (requirement) {
    context.CommitmentRequirement.set({
      ...requirement,
      approvedCount: Number(value<bigint>(event, "approvedWorkCount")),
      updatedAt: Math.max(requirement.updatedAt, event.block.timestamp),
    });
  }
  const contributorId = commitmentMemberId(event.chainId, commitmentId, contributor);
  const contributorRow =
    (await context.CommitmentContributor.get(contributorId)) ??
    createContributor(event.chainId, commitmentId, contributor, event.block.timestamp);
  context.CommitmentContributor.set({
    ...contributorRow,
    approvedWorkCredits: Math.max(0, contributorRow.approvedWorkCredits + creditDelta),
    uncountedLinkedWorkCount:
      existing.linked && creditDelta !== 0
        ? Math.max(0, contributorRow.uncountedLinkedWorkCount - creditDelta)
        : contributorRow.uncountedLinkedWorkCount,
    updatedAt: Math.max(contributorRow.updatedAt, event.block.timestamp),
  });
  await addContributorToIndex(event, context, commitmentId, contributorId);
  if (commitment.poolId !== undefined && creditDelta !== 0) {
    const pool = await context.CommitmentPool.get(
      poolingEntityId(event.chainId, commitment.poolId)
    );
    if (pool) {
      const nextWorkApprovedCount = pool.workApprovedCount + BigInt(creditDelta);
      context.CommitmentPool.set({
        ...pool,
        workApprovedCount: nextWorkApprovedCount < 0n ? 0n : nextWorkApprovedCount,
        updatedAt: Math.max(pool.updatedAt, event.block.timestamp),
      });
    }
  }
  if (commitment.poolId !== undefined && commitment.unitLabel) {
    const approvedDelta = counted
      ? value<bigint>(event, "newlyApprovedUnits")
      : -value<bigint>(event, "removedApprovedUnits");
    await applyUnitSummaryDeltas(
      context,
      event.chainId,
      commitment.poolId,
      commitment.cycleId,
      commitment.unitLabel,
      event.block.timestamp,
      { approved: approvedDelta }
    );
  }
  await reconcileMemberHistory(context, commitment, event.block.timestamp);
  await reconcileRecognitionWeights(context, commitment, event.block.timestamp);
}

async function handleEvidence(event: RuntimeEvent, context: PoolingContext): Promise<void> {
  const commitmentId = value<bigint>(event, "commitmentId");
  const cid = value<string>(event, "cid");
  const attacher = normalizeAddress(value<string>(event, "attacher"));
  const indexId = poolingEntityId(event.chainId, commitmentId);
  const evidenceIndex = await context.CommitmentEvidenceAttributionIndex.get(indexId);
  const commitment = await getCommitment(event, context, commitmentId);
  const attributionIds = [...(evidenceIndex?.attributionEntityIds ?? [])];
  for (const rawContributor of value<readonly string[]>(event, "creditedContributors")) {
    const contributor = normalizeAddress(rawContributor);
    const id = `${event.chainId}-${commitmentId}-${keccak256(toBytes(cid))}-${contributor}`;
    if (!(await context.CommitmentEvidenceAttribution.get(id))) {
      context.CommitmentEvidenceAttribution.set({
        id,
        chainId: event.chainId,
        commitmentId,
        commitmentEntityId: indexId,
        cid,
        contributor,
        contributorEntityId: commitmentMemberId(event.chainId, commitmentId, contributor),
        attacher,
        confirmed: commitment.state === "FULFILLED",
        createdAt: event.block.timestamp,
        updatedAt: event.block.timestamp,
      });
      const contributorId = commitmentMemberId(event.chainId, commitmentId, contributor);
      const contributorRow =
        (await context.CommitmentContributor.get(contributorId)) ??
        createContributor(event.chainId, commitmentId, contributor, event.block.timestamp);
      if (contributorRow.evidenceCredits === 0) {
        context.CommitmentContributor.set({
          ...contributorRow,
          evidenceCredits: 1,
          updatedAt: Math.max(contributorRow.updatedAt, event.block.timestamp),
        });
      }
      await addContributorToIndex(event, context, commitmentId, contributorId);
    }
    attributionIds.push(id);
  }
  context.CommitmentEvidenceAttributionIndex.set({
    id: indexId,
    chainId: event.chainId,
    commitmentId,
    commitmentEntityId: indexId,
    attributionEntityIds: sortedUnique(attributionIds),
    updatedAt: Math.max(evidenceIndex?.updatedAt ?? 0, event.block.timestamp),
  });
  const updated = {
    ...commitment,
    evidenceCIDs: sortedUnique([...commitment.evidenceCIDs, cid]),
    evidenceCount: commitment.evidenceCIDs.includes(cid)
      ? commitment.evidenceCount
      : commitment.evidenceCount + 1,
    updatedAt: Math.max(commitment.updatedAt, event.block.timestamp),
  } satisfies Commitment;
  context.Commitment.set(updated);
  await reconcileMemberHistory(context, updated, event.block.timestamp);
  await reconcileRecognitionWeights(context, updated, event.block.timestamp);
}

async function handleLifecycle(event: RuntimeEvent, context: PoolingContext): Promise<void> {
  const commitmentId = value<bigint>(event, "commitmentId");
  const commitment = await getCommitment(event, context, commitmentId);
  let state = commitment.state;
  let fulfilledBy = commitment.fulfilledBy;
  let path = commitment.confirmationPath;
  let fallbackReason = commitment.fallbackReason;
  let preDisputeState = commitment.preDisputeState;
  let disputeReasonCID = commitment.disputeReasonCID;
  let cancelReasonCID = commitment.cancelReasonCID;
  if (event.eventName === "CommitmentReadyForConfirmation") state = "READY_FOR_CONFIRMATION";
  if (event.eventName === "CommitmentFulfilled") {
    state = "FULFILLED";
    fulfilledBy = normalizeAddress(value<string>(event, "confirmer"));
    path = confirmationPath(value<bigint>(event, "confirmationPath"));
    fallbackReason = value<string>(event, "reason") || undefined;
  }
  if (event.eventName === "CommitmentCancelled") {
    state = "CANCELLED";
    cancelReasonCID = value<string>(event, "reasonCID");
  }
  if (event.eventName === "CommitmentExpired") state = "EXPIRED";
  if (event.eventName === "CommitmentDisputed") {
    state = "DISPUTED";
    preDisputeState = commitmentState(value<bigint>(event, "previousState"));
    disputeReasonCID = value<string>(event, "reasonCID");
  }
  if (event.eventName === "DisputeResolved") {
    state = commitmentState(value<bigint>(event, "finalState"));
    if (state === "FULFILLED") {
      fulfilledBy = undefined;
      path = undefined;
      fallbackReason = undefined;
    }
  }
  if (!state) return;
  const updated = await applyLifecycleState(
    context,
    commitment,
    state,
    BigInt(event.block.number),
    event.logIndex,
    event.block.timestamp,
    {
      readyOverridden:
        event.eventName === "CommitmentReadyForConfirmation"
          ? value<boolean>(event, "overridden")
          : commitment.readyOverridden,
      fulfilledBy,
      confirmationPath: path,
      fallbackReason,
      fulfilledByFallback: path === "POOL_FALLBACK" || path === "PROTOCOL_FALLBACK",
      preDisputeState,
      disputeReasonCID,
      cancelReasonCID,
    }
  );

  if (event.eventName === "CommitmentCancelled" || event.eventName === "CommitmentExpired") {
    await sweepClaimRequests(
      context,
      updated,
      undefined,
      event.eventName === "CommitmentCancelled" ? "COMMITMENT_CANCELLED" : "COMMITMENT_EXPIRED",
      event.block.timestamp
    );
  }
  if (
    event.eventName === "DisputeResolved" &&
    (updated.state === "CANCELLED" || updated.state === "EXPIRED")
  ) {
    await sweepClaimRequests(
      context,
      updated,
      undefined,
      updated.state === "CANCELLED" ? "COMMITMENT_CANCELLED" : "COMMITMENT_EXPIRED",
      event.block.timestamp
    );
  }
  if (event.eventName === "CommitmentDisputed") {
    await recordMemberEvent(
      context,
      updated,
      normalizeAddress(value<string>(event, "raiser")),
      "disputesRaised",
      event.block.timestamp
    );
  }
}

async function handleMiscCommitment(event: RuntimeEvent, context: PoolingContext): Promise<void> {
  const commitmentId = value<bigint>(event, "commitmentId");
  const commitment = await getCommitment(event, context, commitmentId);
  if (event.eventName === "ContributorRosterFrozen") {
    const updated = {
      ...commitment,
      contributorsFrozen: true,
      frozenContributorCount: Number(value<bigint>(event, "contributorCount")),
      updatedAt: Math.max(commitment.updatedAt, event.block.timestamp),
    } satisfies Commitment;
    context.Commitment.set(updated);
    await reconcileMemberHistory(context, updated, event.block.timestamp);
    await reconcileRecognitionWeights(context, updated, event.block.timestamp);
    return;
  }
  if (event.eventName === "AssessmentAttached") {
    context.Commitment.set({
      ...commitment,
      assessmentUID: value<string>(event, "assessmentUID").toLowerCase(),
      updatedAt: Math.max(commitment.updatedAt, event.block.timestamp),
    });
    return;
  }
  if (event.eventName === "ConfirmationRecorded") {
    const confirmer = normalizeAddress(value<string>(event, "confirmer"));
    const updated = {
      ...commitment,
      confirmationCount: Number(value<bigint>(event, "confirmationCount")),
      confirmationThreshold: Number(value<bigint>(event, "threshold")),
      confirmers: sortedUnique([...commitment.confirmers, confirmer]),
      updatedAt: Math.max(commitment.updatedAt, event.block.timestamp),
    } satisfies Commitment;
    context.Commitment.set(updated);
    await recordMemberEvent(
      context,
      updated,
      confirmer,
      "confirmationsGiven",
      event.block.timestamp
    );
    return;
  }
  if (event.eventName === "ConsiderationPaid") {
    if (
      !cursorWins(
        event.block.number,
        event.logIndex,
        commitment.considerationUpdateBlockNumber,
        commitment.considerationUpdateLogIndex
      )
    )
      return;
    context.Commitment.set({
      ...commitment,
      considerationPaid: true,
      considerationSource: normalizeAddress(value<string>(event, "source")),
      considerationRecipient: normalizeAddress(value<string>(event, "recipient")),
      considerationToken: normalizeAddress(value<string>(event, "token")),
      considerationAmount: value<bigint>(event, "amount"),
      considerationPayoutRef: value<string>(event, "payoutRef").toLowerCase(),
      considerationRecordedBy: normalizeAddress(value<string>(event, "recordedBy")),
      considerationUpdateBlockNumber: BigInt(event.block.number),
      considerationUpdateLogIndex: event.logIndex,
      updatedAt: Math.max(commitment.updatedAt, event.block.timestamp),
    });
  }
}

type UnitSummaryDeltas = {
  readonly expected?: bigint;
  readonly approved?: bigint;
  readonly fulfilled?: bigint;
  readonly open?: bigint;
};

async function applyUnitSummaryDeltas(
  context: PoolingContext,
  chainId: number,
  poolId: bigint,
  cycleId: bigint | undefined,
  unitLabel: string,
  timestamp: number,
  deltas: UnitSummaryDeltas
): Promise<void> {
  const labelHash = exactLabelHash(unitLabel);
  const scopes: ReadonlyArray<{
    scope: CommitmentUnitSummary["scope"];
    scopeId: bigint;
    cycleId: bigint | undefined;
  }> = [
    { scope: "POOL", scopeId: poolId, cycleId: undefined },
    ...(cycleId === undefined ? [] : [{ scope: "CYCLE" as const, scopeId: cycleId, cycleId }]),
  ];
  for (const scope of scopes) {
    const id = `${chainId}-${scope.scope}-${scope.scopeId}-${labelHash}`;
    const existing = await context.CommitmentUnitSummary.get(id);
    context.CommitmentUnitSummary.set({
      id,
      chainId,
      scope: scope.scope,
      scopeId: scope.scopeId,
      poolId,
      poolEntityId: poolingEntityId(chainId, poolId),
      cycleId: scope.cycleId,
      cycleEntityId:
        scope.cycleId === undefined ? undefined : poolingEntityId(chainId, scope.cycleId),
      unitLabel,
      unitLabelHash: labelHash,
      expectedUnits: (existing?.expectedUnits ?? 0n) + (deltas.expected ?? 0n),
      approvedUnits: (existing?.approvedUnits ?? 0n) + (deltas.approved ?? 0n),
      fulfilledUnits: (existing?.fulfilledUnits ?? 0n) + (deltas.fulfilled ?? 0n),
      openUnits: (existing?.openUnits ?? 0n) + (deltas.open ?? 0n),
      updatedAt: Math.max(existing?.updatedAt ?? 0, timestamp),
    });
  }
}

async function handleRegistryEvent(event: RuntimeEvent, context: PoolingContext): Promise<void> {
  if (event.eventName === "ProviderOpenCommitmentCapUpdated") {
    const poolId = value<bigint>(event, "poolId");
    const pool = await getPool(event, context, poolId);
    if (
      !cursorWins(
        event.block.number,
        event.logIndex,
        pool.providerCapUpdateBlockNumber,
        pool.providerCapUpdateLogIndex
      )
    )
      return;
    context.CommitmentPool.set({
      ...pool,
      providerOpenCommitmentCap: value<bigint>(event, "cap"),
      providerCapUpdateBlockNumber: BigInt(event.block.number),
      providerCapUpdateLogIndex: event.logIndex,
      updatedAt: Math.max(pool.updatedAt, event.block.timestamp),
    });
    return;
  }
  if (event.eventName === "ClassRegistered") {
    const classId = value<bigint>(event, "classId");
    const id = poolingEntityId(event.chainId, classId);
    if (await context.CommitmentClass.get(id)) return;
    const poolId = value<bigint>(event, "poolId");
    const cycleId = optionalBigint(event, "cycleId");
    const unitLabel = value<string>(event, "unitLabel");
    context.CommitmentClass.set({
      id,
      chainId: event.chainId,
      classId,
      poolId,
      poolEntityId: poolingEntityId(event.chainId, poolId),
      cycleId,
      cycleEntityId: cycleId === undefined ? undefined : poolingEntityId(event.chainId, cycleId),
      unitLabel,
      unitLabelHash: exactLabelHash(unitLabel),
      quota: value<bigint>(event, "quota"),
      createdAt: event.block.timestamp,
      updatedAt: event.block.timestamp,
    });
    return;
  }
  if (!event.eventName.startsWith("Units")) return;
  const poolId = value<bigint>(event, "poolId");
  const cycleId = optionalBigint(event, "cycleId");
  const unitLabel = value<string>(event, "unitLabel");
  const units = value<bigint>(event, "units");
  const countDelta = event.eventName === "UnitsCommitted" ? 1n : -1n;
  await applyUnitSummaryDeltas(
    context,
    event.chainId,
    poolId,
    cycleId,
    unitLabel,
    event.block.timestamp,
    {
      expected:
        event.eventName === "UnitsCommitted"
          ? units
          : event.eventName === "UnitsReleased"
            ? -units
            : 0n,
      fulfilled: event.eventName === "UnitsFulfilled" ? units : 0n,
      open: event.eventName === "UnitsCommitted" ? units : -units,
    }
  );

  const pool = await getPool(event, context, poolId);
  context.CommitmentPool.set({
    ...pool,
    openCommitmentCount: pool.openCommitmentCount + countDelta,
    updatedAt: Math.max(pool.updatedAt, event.block.timestamp),
  });
  if (cycleId !== undefined) {
    const cycleIdValue = poolingEntityId(event.chainId, cycleId);
    const cycle =
      (await context.CommitmentCycle.get(cycleIdValue)) ??
      createCycle(event.chainId, cycleId, poolId, event.block.timestamp);
    context.CommitmentCycle.set({
      ...cycle,
      openCommitmentCount: cycle.openCommitmentCount + countDelta,
      updatedAt: Math.max(cycle.updatedAt, event.block.timestamp),
    });
  }
  const account = normalizeAddress(value<string>(event, "account"));
  const exposureId = `${event.chainId}-${poolId}-${account}`;
  const exposure = await context.CommitmentProviderExposure.get(exposureId);
  context.CommitmentProviderExposure.set({
    id: exposureId,
    chainId: event.chainId,
    poolId,
    poolEntityId: poolingEntityId(event.chainId, poolId),
    provider: account,
    openCommitmentCount: (exposure?.openCommitmentCount ?? 0n) + countDelta,
    updatedAt: Math.max(exposure?.updatedAt ?? 0, event.block.timestamp),
  });
}

async function routeEvent(event: RuntimeEvent, context: PoolingContext): Promise<void> {
  if (!(await putAudit(event, context))) return;
  if (event.contractName === "CommitmentRegistry") {
    await handleRegistryEvent(event, context);
    return;
  }
  if (event.eventName.startsWith("Pool")) {
    await handlePoolEvent(event, context);
    return;
  }
  if (event.eventName.startsWith("Cycle")) {
    await handleCycleEvent(event, context);
    return;
  }
  if (event.eventName.startsWith("CommitmentSeries")) {
    await handleSeriesEvent(event, context);
    return;
  }
  if (await enqueuePendingLifecycle(event, context)) return;
  if (event.eventName === "CommitmentCreated") {
    await handleCommitmentCreated(event, context);
    return;
  }
  if (["ConsiderationDeclared", "ValueDeclared", "ConfirmerRuleSet"].includes(event.eventName)) {
    await handleCommitmentTerms(event, context);
    return;
  }
  if (["ClaimRequested", "ClaimDeclined"].includes(event.eventName)) {
    await handleClaimEvent(event, context);
    return;
  }
  if (event.eventName === "CommitmentAccepted") {
    await handleAccepted(event, context);
    return;
  }
  if (event.eventName === "ExchangeAccepted") {
    await handleExchange(event, context);
    return;
  }
  if (event.eventName.startsWith("Contributor") && event.eventName !== "ContributorRosterFrozen") {
    await handleContributorEvent(event, context);
    return;
  }
  if (
    ["WorkLinked", "WorkUnlinked", "ApprovedWorkCounted", "ApprovedWorkReversed"].includes(
      event.eventName
    )
  ) {
    await handleWorkEvent(event, context);
    return;
  }
  if (event.eventName === "EvidenceAttached") {
    await handleEvidence(event, context);
    return;
  }
  if (
    [
      "CommitmentReadyForConfirmation",
      "CommitmentFulfilled",
      "CommitmentCancelled",
      "CommitmentExpired",
      "CommitmentDisputed",
      "DisputeResolved",
    ].includes(event.eventName)
  ) {
    await handleLifecycle(event, context);
    return;
  }
  if (
    [
      "ContributorRosterFrozen",
      "AssessmentAttached",
      "ConfirmationRecorded",
      "ConsiderationPaid",
    ].includes(event.eventName)
  ) {
    await handleMiscCommitment(event, context);
  }
}

const POOLING_EVENTS = [
  "PoolRegistered",
  "PoolCharterUpdated",
  "PoolReady",
  "PoolOpened",
  "PoolPaused",
  "PoolResumed",
  "PoolClosed",
  "PoolComposted",
  "PoolReopened",
  "CycleSeeded",
  "CycleOpened",
  "CycleClosed",
  "CycleComposted",
  "CycleCancelled",
  "CommitmentSeriesCreated",
  "CommitmentSeriesMetadataUpdated",
  "CommitmentSeriesRested",
  "CommitmentSeriesResumed",
  "CommitmentSeriesRetired",
  "CommitmentCreated",
  "ConsiderationDeclared",
  "ValueDeclared",
  "ConfirmerRuleSet",
  "ClaimRequested",
  "ClaimDeclined",
  "CommitmentAccepted",
  "ExchangeAccepted",
  "ContributorAdded",
  "ContributorRemoved",
  "ContributorRequirementAssigned",
  "ContributorRosterFrozen",
  "WorkLinked",
  "WorkUnlinked",
  "ApprovedWorkCounted",
  "ApprovedWorkReversed",
  "EvidenceAttached",
  "AssessmentAttached",
  "CommitmentReadyForConfirmation",
  "ConfirmationRecorded",
  "CommitmentFulfilled",
  "CommitmentCancelled",
  "CommitmentExpired",
  "CommitmentDisputed",
  "DisputeResolved",
  "ConsiderationPaid",
  "ModuleDependencyUpdated",
  "ModuleSchemaUIDUpdated",
  "ModulePauseStatusChanged",
] as const;

const REGISTRY_EVENTS = [
  "ModuleUpdated",
  "ClassRegistered",
  "ProviderOpenCommitmentCapUpdated",
  "UnitsCommitted",
  "UnitsReleased",
  "UnitsFulfilled",
] as const;

for (const eventName of POOLING_EVENTS) {
  indexer.onEvent(
    { contract: "CommitmentPoolingModule", event: eventName },
    async ({ event, context }) => {
      await routeEvent(event as unknown as RuntimeEvent, context as unknown as PoolingContext);
    }
  );
}

for (const eventName of REGISTRY_EVENTS) {
  indexer.onEvent(
    { contract: "CommitmentRegistry", event: eventName },
    async ({ event, context }) => {
      await routeEvent(event as unknown as RuntimeEvent, context as unknown as PoolingContext);
    }
  );
}
