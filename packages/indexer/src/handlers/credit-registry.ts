import { indexer } from "envio";

import { cursorWins } from "./commitment-pool-projections";
import { registryConfiguration, updateRegistryAddress } from "./credit-registry-configuration";
import {
  actorUpdate,
  ensurePoolStats,
  executorId,
  lifecycleUpdate,
  loanRail,
  projection,
  putLoanEvent,
  reconcileProjection,
} from "./credit-registry-projections";
import { normalizeAddress } from "./shared";

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
    // The pool can arrive after this audit fact during reverse delivery. Keep the
    // audit row idempotent, but retry materialization once the dependency exists.
    await putLoanEvent(context, event, {
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
    });
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
