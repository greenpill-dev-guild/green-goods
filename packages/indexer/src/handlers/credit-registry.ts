import { indexer } from "envio";

import { cursorWins } from "./commitment-pool-projections";
import { registryConfiguration, updateRegistryAddress } from "./credit-registry-configuration";
import { ensurePoolStats, executorId, putLoanEvent } from "./credit-registry-projections";
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
