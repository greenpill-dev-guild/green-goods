import { indexer, type SettlementConfiguration } from "envio";

import {
  configurationId,
  executorConfiguration,
  optionalAddress,
  settlementGardenRouteId,
} from "./settlement-projections";
import { normalizeAddress } from "./shared";

export async function executorConfig(
  context: {
    SettlementConfiguration: {
      get: (id: string) => Promise<SettlementConfiguration | undefined>;
    };
  },
  chainId: number,
  localContract: string,
  updatedAt: number
): Promise<SettlementConfiguration> {
  const existing = await context.SettlementConfiguration.get(configurationId(chainId));
  return executorConfiguration(chainId, localContract, updatedAt, existing);
}

indexer.onEvent(
  { contract: "CeloSettlementExecutor", event: "SourcePeerUpdated" },
  async ({ event, context }) => {
    const existing = await executorConfig(
      context,
      event.chainId,
      event.srcAddress,
      event.block.timestamp
    );
    const activePeer = normalizeAddress(event.params.sourceSettlementModule);
    context.SettlementConfiguration.set({
      ...existing,
      remoteChainSelector: event.params.sourceChainSelector,
      activePeer,
      previousPeer: optionalAddress(event.params.previousSourceSettlementModule),
      previousPeerExpiresAt: event.params.previousPeerExpiresAt,
      protocolVersion: Number(event.params.protocolVersion),
      peerConfigured:
        existing.remoteEvmChainId !== undefined &&
        existing.localChainSelector !== 0n &&
        existing.localRouter !== "0x0000000000000000000000000000000000000000",
      updatedAt: event.block.timestamp,
    });
  }
);

indexer.onEvent(
  { contract: "CeloSettlementExecutor", event: "GardenRouteConfigured" },
  async ({ event, context }) => {
    const garden = normalizeAddress(event.params.garden);
    const existing = await context.SettlementGardenRoute.get(
      settlementGardenRouteId(event.chainId, garden)
    );
    const configuration = await context.SettlementConfiguration.get(configurationId(event.chainId));
    if (configuration?.remoteEvmChainId === undefined) return;
    context.SettlementGardenRoute.set({
      id: settlementGardenRouteId(event.chainId, garden),
      chainId: event.chainId,
      sourceChainId: configuration.remoteEvmChainId,
      garden,
      gardenId: garden,
      settlementAccountId: `${configuration.remoteEvmChainId}-${garden}`,
      safe: normalizeAddress(event.params.safe),
      rolesModifier: normalizeAddress(event.params.rolesModifier),
      roleKey: event.params.roleKey.toLowerCase(),
      allowanceKey: event.params.allowanceKey.toLowerCase(),
      permissionsConfigHash: event.params.permissionsConfigHash.toLowerCase(),
      active: existing?.active ?? true,
      configuredAt: existing?.configuredAt ?? event.block.timestamp,
      updatedAt: event.block.timestamp,
    });
  }
);

indexer.onEvent(
  { contract: "CeloSettlementExecutor", event: "GardenRouteStatusChanged" },
  async ({ event, context }) => {
    const entityId = settlementGardenRouteId(event.chainId, event.params.garden);
    const existing = await context.SettlementGardenRoute.get(entityId);
    if (!existing) return;
    context.SettlementGardenRoute.set({
      ...existing,
      active: event.params.active,
      updatedAt: event.block.timestamp,
    });
  }
);

indexer.onEvent(
  { contract: "CeloSettlementExecutor", event: "CapsUpdated" },
  async ({ event, context }) => {
    const existing = await executorConfig(
      context,
      event.chainId,
      event.srcAddress,
      event.block.timestamp
    );
    context.SettlementConfiguration.set({
      ...existing,
      batchSizeLimit: Number(event.params.maxBatchSize),
      maxTransferAmount: event.params.maxTransferAmount,
      maxBatchAmount: event.params.maxBatchAmount,
      updatedAt: event.block.timestamp,
    });
  }
);

indexer.onEvent(
  { contract: "CeloSettlementExecutor", event: "FeePolicyUpdated" },
  async ({ event, context }) => {
    const existing = await executorConfig(
      context,
      event.chainId,
      event.srcAddress,
      event.block.timestamp
    );
    context.SettlementConfiguration.set({
      ...existing,
      maxFeeBps: Number(event.params.maxFeeBps),
      maxFeeAmount: event.params.maxFeeAmount,
      updatedAt: event.block.timestamp,
    });
  }
);

indexer.onEvent(
  { contract: "CeloSettlementExecutor", event: "PeriodicCapUpdated" },
  async ({ event, context }) => {
    const existing = await executorConfig(
      context,
      event.chainId,
      event.srcAddress,
      event.block.timestamp
    );
    context.SettlementConfiguration.set({
      ...existing,
      periodDuration: Number(event.params.periodDuration),
      maxPeriodAmount: event.params.maxPeriodAmount,
      updatedAt: event.block.timestamp,
    });
  }
);

indexer.onEvent(
  { contract: "CeloSettlementExecutor", event: "AcknowledgmentFeeReserveMinimumUpdated" },
  async ({ event, context }) => {
    const existing = await executorConfig(
      context,
      event.chainId,
      event.srcAddress,
      event.block.timestamp
    );
    context.SettlementConfiguration.set({
      ...existing,
      feeReserveMinimum: event.params.minimum,
      feeReserveLow: existing.nativeFeeBalance < event.params.minimum,
      updatedAt: event.block.timestamp,
    });
  }
);

indexer.onEvent(
  { contract: "CeloSettlementExecutor", event: "AcknowledgmentFeeReserveFunded" },
  async ({ event, context }) => {
    const existing = await executorConfig(
      context,
      event.chainId,
      event.srcAddress,
      event.block.timestamp
    );
    const nativeFeeBalance = existing.nativeFeeBalance + event.params.amount;
    context.SettlementConfiguration.set({
      ...existing,
      nativeFeeBalance,
      feeReserveLow: nativeFeeBalance < existing.feeReserveMinimum,
      updatedAt: event.block.timestamp,
    });
  }
);

indexer.onEvent(
  { contract: "CeloSettlementExecutor", event: "ExcessAcknowledgmentFeesWithdrawn" },
  async ({ event, context }) => {
    const existing = await executorConfig(
      context,
      event.chainId,
      event.srcAddress,
      event.block.timestamp
    );
    const nativeFeeBalance =
      existing.nativeFeeBalance >= event.params.amount
        ? existing.nativeFeeBalance - event.params.amount
        : 0n;
    context.SettlementConfiguration.set({
      ...existing,
      nativeFeeBalance,
      feeReserveLow: nativeFeeBalance < existing.feeReserveMinimum,
      updatedAt: event.block.timestamp,
    });
  }
);

indexer.onEvent(
  { contract: "CeloSettlementExecutor", event: "PausedSet" },
  async ({ event, context }) => {
    const existing = await executorConfig(
      context,
      event.chainId,
      event.srcAddress,
      event.block.timestamp
    );
    context.SettlementConfiguration.set({
      ...existing,
      paused: event.params.paused,
      updatedAt: event.block.timestamp,
    });
  }
);
