import {
  indexer,
  type CreditLoanProjection,
  type CreditPoolStats,
  type CreditRegistryConfiguration,
  type Loan,
} from "envio";

import { cursorWins, poolingEntityId } from "./commitment-pool-projections";
import { getTxHash, normalizeAddress } from "./shared";

type CreditContext = Parameters<Parameters<typeof indexer.onEvent>[1]>[0]["context"];
type CreditEvent = {
  chainId: number;
  srcAddress: string;
  block: { number: number; timestamp: number };
  transaction: unknown;
  logIndex: number;
};

function loanId(chainId: number, value: bigint): string {
  return `${chainId}-${value}`;
}

function poolStatsId(chainId: number, poolId: bigint): string {
  return `${chainId}-${poolId}`;
}

function registryConfigurationId(chainId: number, registry: string): string {
  return `${chainId}-${normalizeAddress(registry)}`;
}

function executorId(chainId: number, poolId: bigint, executor: string): string {
  return `${chainId}-${poolId}-${normalizeAddress(executor)}`;
}

function eventId(event: CreditEvent): string {
  return `${event.chainId}-${getTxHash(event.transaction)}-${event.logIndex}`;
}

function eventData(value: Record<string, unknown>): string {
  return JSON.stringify(value, (_key, item) => (typeof item === "bigint" ? item.toString() : item));
}

function loanRail(value: bigint): Loan["rail"] {
  const values = ["NONE", "JAR", "TREASURY", "GDOLLAR_SETTLEMENT"] as const;
  return values[Number(value)] ?? "NONE";
}

function emptyProjection(event: CreditEvent, value: bigint): CreditLoanProjection {
  return {
    id: loanId(event.chainId, value),
    chainId: event.chainId,
    loanId: value,
    creditRegistry: normalizeAddress(event.srcAddress),
    requestSeen: false,
    poolId: undefined,
    borrower: undefined,
    requestedBy: undefined,
    commitmentId: undefined,
    token: undefined,
    principal: 0n,
    feeAmount: 0n,
    dueDate: 0n,
    installmentsTotal: 0,
    termsCID: undefined,
    createdAt: undefined,
    state: undefined,
    lifecycleBlockNumber: undefined,
    lifecycleLogIndex: undefined,
    recordedBy: undefined,
    actorBlockNumber: undefined,
    actorLogIndex: undefined,
    rail: undefined,
    disbursementId: undefined,
    issuedAmount: 0n,
    attempts: undefined,
    executionRef: undefined,
    disbursementBlockNumber: undefined,
    disbursementLogIndex: undefined,
    repaidAmount: 0n,
    outstanding: 0n,
    installmentsPaid: 0,
    repaymentBlockNumber: undefined,
    repaymentLogIndex: undefined,
    reasonCID: undefined,
    defaultReasonCID: undefined,
    defaultedAt: undefined,
    defaultBlockNumber: undefined,
    defaultLogIndex: undefined,
    recoveredFromDefault: false,
    settlementRelationshipEntityId: undefined,
    appliedIssued: 0n,
    appliedRepaid: 0n,
    appliedDefaultCount: 0n,
    appliedLoanCount: 0n,
    updatedAt: event.block.timestamp,
  };
}

async function projection(
  context: CreditContext,
  event: CreditEvent,
  value: bigint
): Promise<CreditLoanProjection> {
  return (
    (await context.CreditLoanProjection.get(loanId(event.chainId, value))) ??
    emptyProjection(event, value)
  );
}

function actorUpdate(
  current: CreditLoanProjection,
  event: CreditEvent,
  actor: string
): CreditLoanProjection {
  if (
    !cursorWins(event.block.number, event.logIndex, current.actorBlockNumber, current.actorLogIndex)
  ) {
    return current;
  }
  return {
    ...current,
    recordedBy: normalizeAddress(actor),
    actorBlockNumber: BigInt(event.block.number),
    actorLogIndex: event.logIndex,
  };
}

function lifecycleUpdate(
  current: CreditLoanProjection,
  event: CreditEvent,
  state: Loan["state"]
): CreditLoanProjection {
  if (
    !cursorWins(
      event.block.number,
      event.logIndex,
      current.lifecycleBlockNumber,
      current.lifecycleLogIndex
    )
  ) {
    return current;
  }
  return {
    ...current,
    state,
    lifecycleBlockNumber: BigInt(event.block.number),
    lifecycleLogIndex: event.logIndex,
  };
}

async function putLoanEvent(
  context: CreditContext,
  event: CreditEvent,
  input: {
    eventType: string;
    poolId?: bigint;
    loanId?: bigint;
    actor?: string;
    amount?: bigint;
    data?: Record<string, unknown>;
  }
): Promise<boolean> {
  const id = eventId(event);
  if (await context.LoanEvent.get(id)) return false;
  context.LoanEvent.set({
    id,
    chainId: event.chainId,
    poolId: input.poolId,
    loanId: input.loanId,
    eventType: input.eventType,
    actor: input.actor ? normalizeAddress(input.actor) : undefined,
    amount: input.amount,
    data: input.data ? eventData(input.data) : undefined,
    txHash: getTxHash(event.transaction),
    blockNumber: BigInt(event.block.number),
    logIndex: event.logIndex,
    timestamp: event.block.timestamp,
  });
  return true;
}

async function ensurePoolStats(
  context: CreditContext,
  chainId: number,
  poolId: bigint,
  timestamp: number
): Promise<CreditPoolStats | undefined> {
  const id = poolStatsId(chainId, poolId);
  const existing = await context.CreditPoolStats.get(id);
  if (existing) return existing;
  const pool = await context.CommitmentPool.get(poolingEntityId(chainId, poolId));
  if (!pool?.registrationSeen || !pool.garden || !pool.gardenId) return undefined;
  return {
    id,
    chainId,
    poolId,
    garden: pool.garden,
    gardenId: pool.gardenId,
    token: undefined,
    borrowerCap: 0n,
    enabled: false,
    creditIssued: 0n,
    creditRepaid: 0n,
    creditOutstanding: 0n,
    repaymentRateNumerator: 0n,
    repaymentRateDenominator: 0n,
    defaultRateNumerator: 0n,
    defaultRateDenominator: 0n,
    configurationBlockNumber: undefined,
    configurationLogIndex: undefined,
    updatedAt: timestamp,
  };
}

async function reconcileProjection(
  context: CreditContext,
  current: CreditLoanProjection
): Promise<void> {
  if (
    !current.requestSeen ||
    current.poolId === undefined ||
    !current.borrower ||
    !current.requestedBy ||
    !current.token ||
    !current.termsCID ||
    current.createdAt === undefined ||
    !current.state
  ) {
    context.CreditLoanProjection.set(current);
    return;
  }

  const pool = await context.CommitmentPool.get(poolingEntityId(current.chainId, current.poolId));
  if (!pool?.registrationSeen || !pool.garden || !pool.gardenId) {
    context.CreditLoanProjection.set(current);
    return;
  }

  let attempts = current.attempts;
  let relationshipEntityId = current.settlementRelationshipEntityId;
  if (current.disbursementId !== undefined && current.disbursementId !== 0n) {
    const relationshipId = `${current.chainId}-${current.disbursementId}`;
    const relationship = await context.LoanPrincipalRelationship.get(relationshipId);
    if (
      relationship?.loanId === current.loanId &&
      relationship.creditRegistry === current.creditRegistry
    ) {
      relationshipEntityId = relationshipId;
      const disbursement = await context.Disbursement.get(relationshipId);
      attempts = disbursement?.attempt ?? attempts;
    }
  }

  const stats = await ensurePoolStats(context, current.chainId, current.poolId, current.updatedAt);
  let nextProjection = {
    ...current,
    attempts,
    settlementRelationshipEntityId: relationshipEntityId,
  };
  if (stats) {
    const desiredIssued = current.disbursementBlockNumber ? current.issuedAmount : 0n;
    const desiredRepaid = current.repaidAmount;
    const desiredDefaultCount = current.defaultBlockNumber ? 1n : 0n;
    const desiredLoanCount = current.disbursementBlockNumber ? 1n : 0n;
    const issuedDelta = desiredIssued - current.appliedIssued;
    const repaidDelta = desiredRepaid - current.appliedRepaid;
    context.CreditPoolStats.set({
      ...stats,
      creditIssued: stats.creditIssued + issuedDelta,
      creditRepaid: stats.creditRepaid + repaidDelta,
      creditOutstanding: stats.creditOutstanding + issuedDelta - repaidDelta,
      repaymentRateNumerator: stats.repaymentRateNumerator + repaidDelta,
      repaymentRateDenominator: stats.repaymentRateDenominator + issuedDelta,
      defaultRateNumerator:
        stats.defaultRateNumerator + desiredDefaultCount - current.appliedDefaultCount,
      defaultRateDenominator:
        stats.defaultRateDenominator + desiredLoanCount - current.appliedLoanCount,
      updatedAt: Math.max(stats.updatedAt, current.updatedAt),
    });
    nextProjection = {
      ...nextProjection,
      appliedIssued: desiredIssued,
      appliedRepaid: desiredRepaid,
      appliedDefaultCount: desiredDefaultCount,
      appliedLoanCount: desiredLoanCount,
    };
  }

  const row: Loan = {
    id: current.id,
    chainId: current.chainId,
    loanId: current.loanId,
    creditRegistry: current.creditRegistry,
    poolId: current.poolId,
    garden: pool.garden,
    gardenId: pool.gardenId,
    borrower: current.borrower,
    requestedBy: current.requestedBy,
    recordedBy: current.recordedBy ?? current.requestedBy,
    commitmentId: current.commitmentId,
    token: current.token,
    principal: current.principal,
    repaidAmount: current.repaidAmount,
    outstanding: current.outstanding,
    feeAmount: current.feeAmount,
    rail: current.rail ?? "NONE",
    disbursementId: current.disbursementId,
    state: current.state,
    dueDate: current.dueDate,
    installmentsTotal: current.installmentsTotal,
    installmentsPaid: current.installmentsPaid,
    attempts,
    executionRef: current.executionRef,
    termsCID: current.termsCID,
    reasonCID: current.reasonCID,
    defaultReasonCID: current.defaultReasonCID,
    recoveredFromDefault: current.recoveredFromDefault,
    defaultedAt: current.defaultedAt,
    settlementRelationshipEntityId: relationshipEntityId,
    createdAt: current.createdAt,
    updatedAt: current.updatedAt,
  };
  context.Loan.set(row);
  context.CreditLoanProjection.set(nextProjection);
}

async function registryConfiguration(
  context: CreditContext,
  event: CreditEvent
): Promise<CreditRegistryConfiguration> {
  const id = registryConfigurationId(event.chainId, event.srcAddress);
  return (
    (await context.CreditRegistryConfiguration.get(id)) ?? {
      id,
      chainId: event.chainId,
      registry: normalizeAddress(event.srcAddress),
      owner: undefined,
      hatsModule: undefined,
      commitmentPoolingModule: undefined,
      settlementModule: undefined,
      paused: true,
      initializedAt: undefined,
      hatsUpdateBlockNumber: undefined,
      hatsUpdateLogIndex: undefined,
      poolingUpdateBlockNumber: undefined,
      poolingUpdateLogIndex: undefined,
      settlementUpdateBlockNumber: undefined,
      settlementUpdateLogIndex: undefined,
      pauseUpdateBlockNumber: undefined,
      pauseUpdateLogIndex: undefined,
      updatedAt: event.block.timestamp,
    }
  );
}

indexer.onEvent(
  { contract: "CreditRegistry", event: "CreditRegistryInitialized" },
  async ({ event, context }) => {
    if (
      !(await putLoanEvent(context, event, {
        eventType: "CREDIT_REGISTRY_INITIALIZED",
        actor: event.params.owner,
        data: {
          hatsModule: event.params.hatsModule,
          commitmentPoolingModule: event.params.commitmentPoolingModule,
          settlementModule: event.params.settlementModule,
        },
      }))
    )
      return;
    const current = await registryConfiguration(context, event);
    context.CreditRegistryConfiguration.set({
      ...current,
      owner: normalizeAddress(event.params.owner),
      hatsModule: cursorWins(
        event.block.number,
        event.logIndex,
        current.hatsUpdateBlockNumber,
        current.hatsUpdateLogIndex
      )
        ? normalizeAddress(event.params.hatsModule)
        : current.hatsModule,
      commitmentPoolingModule: cursorWins(
        event.block.number,
        event.logIndex,
        current.poolingUpdateBlockNumber,
        current.poolingUpdateLogIndex
      )
        ? normalizeAddress(event.params.commitmentPoolingModule)
        : current.commitmentPoolingModule,
      settlementModule: cursorWins(
        event.block.number,
        event.logIndex,
        current.settlementUpdateBlockNumber,
        current.settlementUpdateLogIndex
      )
        ? normalizeAddress(event.params.settlementModule)
        : current.settlementModule,
      initializedAt: current.initializedAt ?? event.block.timestamp,
      updatedAt: Math.max(current.updatedAt, event.block.timestamp),
    });
  }
);

indexer.onEvent(
  { contract: "CreditRegistry", event: "PoolCreditConfigured" },
  async ({ event, context }) => {
    if (
      !(await putLoanEvent(context, event, {
        eventType: "POOL_CREDIT_CONFIGURED",
        poolId: event.params.poolId,
        actor: event.params.configuredBy,
        data: {
          token: event.params.token,
          previousBorrowerCap: event.params.previousBorrowerCap,
          borrowerCap: event.params.borrowerCap,
          previouslyEnabled: event.params.previouslyEnabled,
          enabled: event.params.enabled,
        },
      }))
    )
      return;
    const stats = await ensurePoolStats(
      context,
      event.chainId,
      event.params.poolId,
      event.block.timestamp
    );
    if (!stats) return;
    if (
      !cursorWins(
        event.block.number,
        event.logIndex,
        stats.configurationBlockNumber,
        stats.configurationLogIndex
      )
    )
      return;
    context.CreditPoolStats.set({
      ...stats,
      token: normalizeAddress(event.params.token),
      borrowerCap: event.params.borrowerCap,
      enabled: event.params.enabled,
      configurationBlockNumber: BigInt(event.block.number),
      configurationLogIndex: event.logIndex,
      updatedAt: Math.max(stats.updatedAt, event.block.timestamp),
    });
  }
);

indexer.onEvent(
  { contract: "CreditRegistry", event: "ExecutorUpdated" },
  async ({ event, context }) => {
    if (
      !(await putLoanEvent(context, event, {
        eventType: "EXECUTOR_UPDATED",
        poolId: event.params.poolId,
        actor: event.params.updatedBy,
        data: { executor: event.params.executor, enabled: event.params.enabled },
      }))
    )
      return;
    const id = executorId(event.chainId, event.params.poolId, event.params.executor);
    const current = await context.CreditPoolExecutor.get(id);
    if (
      current &&
      !cursorWins(
        event.block.number,
        event.logIndex,
        current.updateBlockNumber,
        current.updateLogIndex
      )
    )
      return;
    context.CreditPoolExecutor.set({
      id,
      chainId: event.chainId,
      poolId: event.params.poolId,
      executor: normalizeAddress(event.params.executor),
      enabled: event.params.enabled,
      updatedBy: normalizeAddress(event.params.updatedBy),
      updateBlockNumber: BigInt(event.block.number),
      updateLogIndex: event.logIndex,
      updatedAt: event.block.timestamp,
    });
  }
);

indexer.onEvent(
  { contract: "CreditRegistry", event: "LoanRequested" },
  async ({ event, context }) => {
    if (
      !(await putLoanEvent(context, event, {
        eventType: "LOAN_REQUESTED",
        poolId: event.params.poolId,
        loanId: event.params.loanId,
        actor: event.params.requestedBy,
        amount: event.params.principal,
        data: {
          borrower: event.params.borrower,
          commitmentId: event.params.commitmentId,
          token: event.params.token,
          dueDate: event.params.dueDate,
          installmentsTotal: event.params.installmentsTotal,
          termsCID: event.params.termsCID,
        },
      }))
    )
      return;
    let current = await projection(context, event, event.params.loanId);
    current = actorUpdate(current, event, event.params.requestedBy);
    current = lifecycleUpdate(current, event, "REQUESTED");
    current = {
      ...current,
      requestSeen: true,
      poolId: event.params.poolId,
      borrower: normalizeAddress(event.params.borrower),
      requestedBy: normalizeAddress(event.params.requestedBy),
      commitmentId: event.params.commitmentId === 0n ? undefined : event.params.commitmentId,
      token: normalizeAddress(event.params.token),
      principal: event.params.principal,
      dueDate: event.params.dueDate,
      installmentsTotal: Number(event.params.installmentsTotal),
      termsCID: event.params.termsCID,
      createdAt: event.block.timestamp,
      updatedAt: Math.max(current.updatedAt, event.block.timestamp),
    };
    await reconcileProjection(context, current);
  }
);

indexer.onEvent(
  { contract: "CreditRegistry", event: "LoanApproved" },
  async ({ event, context }) => {
    if (
      !(await putLoanEvent(context, event, {
        eventType: "LOAN_APPROVED",
        loanId: event.params.loanId,
        actor: event.params.approvedBy,
      }))
    )
      return;
    let current = await projection(context, event, event.params.loanId);
    current = lifecycleUpdate(
      actorUpdate(current, event, event.params.approvedBy),
      event,
      "APPROVED"
    );
    await reconcileProjection(context, {
      ...current,
      updatedAt: Math.max(current.updatedAt, event.block.timestamp),
    });
  }
);

indexer.onEvent(
  { contract: "CreditRegistry", event: "LoanDisbursed" },
  async ({ event, context }) => {
    if (
      !(await putLoanEvent(context, event, {
        eventType: "LOAN_DISBURSED",
        loanId: event.params.loanId,
        actor: event.params.recordedBy,
        amount: event.params.amount,
        data: {
          rail: event.params.rail,
          token: event.params.token,
          disbursementId: event.params.disbursementId,
          executionRef: event.params.executionRef,
        },
      }))
    )
      return;
    let current = await projection(context, event, event.params.loanId);
    current = actorUpdate(current, event, event.params.recordedBy);
    current = lifecycleUpdate(current, event, "DISBURSED");
    if (
      cursorWins(
        event.block.number,
        event.logIndex,
        current.disbursementBlockNumber,
        current.disbursementLogIndex
      )
    ) {
      current = {
        ...current,
        rail: loanRail(event.params.rail),
        disbursementId:
          event.params.disbursementId === 0n ? undefined : event.params.disbursementId,
        issuedAmount: event.params.amount,
        outstanding: current.repaymentBlockNumber ? current.outstanding : event.params.amount,
        executionRef: event.params.executionRef,
        disbursementBlockNumber: BigInt(event.block.number),
        disbursementLogIndex: event.logIndex,
      };
    }
    await reconcileProjection(context, {
      ...current,
      updatedAt: Math.max(current.updatedAt, event.block.timestamp),
    });
  }
);

indexer.onEvent(
  { contract: "CreditRegistry", event: "RepaymentRecorded" },
  async ({ event, context }) => {
    if (
      !(await putLoanEvent(context, event, {
        eventType: "REPAYMENT_RECORDED",
        loanId: event.params.loanId,
        actor: event.params.recordedBy,
        amount: event.params.amount,
        data: {
          repaidAmount: event.params.repaidAmount,
          newOutstanding: event.params.newOutstanding,
          installmentsPaid: event.params.installmentsPaid,
          executionRef: event.params.executionRef,
        },
      }))
    )
      return;
    let current = actorUpdate(
      await projection(context, event, event.params.loanId),
      event,
      event.params.recordedBy
    );
    if (
      cursorWins(
        event.block.number,
        event.logIndex,
        current.repaymentBlockNumber,
        current.repaymentLogIndex
      )
    ) {
      current = {
        ...current,
        repaidAmount: event.params.repaidAmount,
        outstanding: event.params.newOutstanding,
        installmentsPaid: Number(event.params.installmentsPaid),
        executionRef: event.params.executionRef,
        repaymentBlockNumber: BigInt(event.block.number),
        repaymentLogIndex: event.logIndex,
      };
    }
    await reconcileProjection(context, {
      ...current,
      updatedAt: Math.max(current.updatedAt, event.block.timestamp),
    });
  }
);

indexer.onEvent({ contract: "CreditRegistry", event: "LoanRepaid" }, async ({ event, context }) => {
  if (
    !(await putLoanEvent(context, event, {
      eventType: "LOAN_REPAID",
      loanId: event.params.loanId,
      actor: event.params.recordedBy,
      data: { recoveredFromDefault: event.params.recoveredFromDefault },
    }))
  )
    return;
  let current = await projection(context, event, event.params.loanId);
  current = lifecycleUpdate(actorUpdate(current, event, event.params.recordedBy), event, "REPAID");
  await reconcileProjection(context, {
    ...current,
    recoveredFromDefault: event.params.recoveredFromDefault,
    updatedAt: Math.max(current.updatedAt, event.block.timestamp),
  });
});

indexer.onEvent(
  { contract: "CreditRegistry", event: "LoanDefaulted" },
  async ({ event, context }) => {
    if (
      !(await putLoanEvent(context, event, {
        eventType: "LOAN_DEFAULTED",
        loanId: event.params.loanId,
        actor: event.params.markedBy,
        data: { reasonCID: event.params.reasonCID },
      }))
    )
      return;
    let current = await projection(context, event, event.params.loanId);
    current = lifecycleUpdate(
      actorUpdate(current, event, event.params.markedBy),
      event,
      "DEFAULTED"
    );
    if (
      cursorWins(
        event.block.number,
        event.logIndex,
        current.defaultBlockNumber,
        current.defaultLogIndex
      )
    ) {
      current = {
        ...current,
        reasonCID: event.params.reasonCID,
        defaultReasonCID: event.params.reasonCID,
        defaultedAt: event.block.timestamp,
        defaultBlockNumber: BigInt(event.block.number),
        defaultLogIndex: event.logIndex,
      };
    }
    await reconcileProjection(context, {
      ...current,
      updatedAt: Math.max(current.updatedAt, event.block.timestamp),
    });
  }
);

indexer.onEvent(
  { contract: "CreditRegistry", event: "LoanCancelled" },
  async ({ event, context }) => {
    if (
      !(await putLoanEvent(context, event, {
        eventType: "LOAN_CANCELLED",
        loanId: event.params.loanId,
        actor: event.params.cancelledBy,
        data: { reasonCID: event.params.reasonCID },
      }))
    )
      return;
    let current = await projection(context, event, event.params.loanId);
    current = lifecycleUpdate(
      actorUpdate(current, event, event.params.cancelledBy),
      event,
      "CANCELLED"
    );
    await reconcileProjection(context, {
      ...current,
      reasonCID: event.params.reasonCID,
      updatedAt: Math.max(current.updatedAt, event.block.timestamp),
    });
  }
);

async function updateRegistryAddress(
  context: CreditContext,
  event: CreditEvent,
  input: {
    eventType: string;
    field: "hatsModule" | "commitmentPoolingModule" | "settlementModule";
    blockField:
      | "hatsUpdateBlockNumber"
      | "poolingUpdateBlockNumber"
      | "settlementUpdateBlockNumber";
    logField: "hatsUpdateLogIndex" | "poolingUpdateLogIndex" | "settlementUpdateLogIndex";
    previousModule: string;
    newModule: string;
  }
): Promise<void> {
  if (
    !(await putLoanEvent(context, event, {
      eventType: input.eventType,
      data: { previousModule: input.previousModule, newModule: input.newModule },
    }))
  )
    return;
  const current = await registryConfiguration(context, event);
  if (
    !cursorWins(
      event.block.number,
      event.logIndex,
      current[input.blockField],
      current[input.logField]
    )
  )
    return;
  context.CreditRegistryConfiguration.set({
    ...current,
    [input.field]: normalizeAddress(input.newModule),
    [input.blockField]: BigInt(event.block.number),
    [input.logField]: event.logIndex,
    updatedAt: Math.max(current.updatedAt, event.block.timestamp),
  });
}

indexer.onEvent(
  { contract: "CreditRegistry", event: "HatsModuleUpdated" },
  async ({ event, context }) =>
    updateRegistryAddress(context, event, {
      eventType: "HATS_MODULE_UPDATED",
      field: "hatsModule",
      blockField: "hatsUpdateBlockNumber",
      logField: "hatsUpdateLogIndex",
      previousModule: event.params.previousModule,
      newModule: event.params.newModule,
    })
);

indexer.onEvent(
  { contract: "CreditRegistry", event: "CommitmentPoolingModuleUpdated" },
  async ({ event, context }) =>
    updateRegistryAddress(context, event, {
      eventType: "COMMITMENT_POOLING_MODULE_UPDATED",
      field: "commitmentPoolingModule",
      blockField: "poolingUpdateBlockNumber",
      logField: "poolingUpdateLogIndex",
      previousModule: event.params.previousModule,
      newModule: event.params.newModule,
    })
);

indexer.onEvent(
  { contract: "CreditRegistry", event: "SettlementModuleUpdated" },
  async ({ event, context }) =>
    updateRegistryAddress(context, event, {
      eventType: "SETTLEMENT_MODULE_UPDATED",
      field: "settlementModule",
      blockField: "settlementUpdateBlockNumber",
      logField: "settlementUpdateLogIndex",
      previousModule: event.params.previousModule,
      newModule: event.params.newModule,
    })
);

indexer.onEvent({ contract: "CreditRegistry", event: "PausedSet" }, async ({ event, context }) => {
  if (
    !(await putLoanEvent(context, event, {
      eventType: "PAUSED_SET",
      data: { paused: event.params.paused },
    }))
  )
    return;
  const current = await registryConfiguration(context, event);
  if (
    !cursorWins(
      event.block.number,
      event.logIndex,
      current.pauseUpdateBlockNumber,
      current.pauseUpdateLogIndex
    )
  )
    return;
  context.CreditRegistryConfiguration.set({
    ...current,
    paused: event.params.paused,
    pauseUpdateBlockNumber: BigInt(event.block.number),
    pauseUpdateLogIndex: event.logIndex,
    updatedAt: Math.max(current.updatedAt, event.block.timestamp),
  });
});
