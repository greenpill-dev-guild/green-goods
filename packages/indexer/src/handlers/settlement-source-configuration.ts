import { indexer, type SettlementConfiguration } from "envio";

import {
  configurationId,
  optionalAddress,
  settlementAccountId,
  sourceConfiguration,
} from "./settlement-projections";
import { normalizeAddress, ZERO_ADDRESS } from "./shared";

export async function sourceConfig(
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
  return sourceConfiguration(
    chainId,
    localContract,
    existing?.gDollarToken ?? ZERO_ADDRESS,
    updatedAt,
    existing
  );
}

// The deployment's own identity, and the only source for these three fields. They are constructor
// immutables, so before the contract announced them the indexer had nothing to write here — and
// several projections gate on `remoteEvmChainId`, which meant settlement messages, executions, and
// garden routes were never created at all in production. The tests hid it by seeding config
// directly (pre-merge review 2026-08-09).
indexer.onEvent(
  { contract: "SettlementModule", event: "SettlementDeploymentPinned" },
  async ({ event, context }) => {
    const existing = await sourceConfig(
      context,
      event.chainId,
      event.srcAddress,
      event.block.timestamp
    );
    context.SettlementConfiguration.set({
      ...existing,
      localRouter: normalizeAddress(event.params.ccipRouter),
      localChainSelector: event.params.localChainSelector,
      remoteEvmChainId: Number(event.params.remoteEvmChainId),
      updatedAt: event.block.timestamp,
    });
  }
);

indexer.onEvent(
  { contract: "SettlementModule", event: "SettlementAccountRegistered" },
  async ({ event, context }) => {
    const garden = normalizeAddress(event.params.garden);
    context.SettlementAccount.set({
      id: settlementAccountId(event.chainId, garden),
      chainId: event.chainId,
      garden,
      gardenId: garden,
      accountChainId: event.params.chainId,
      account: normalizeAddress(event.params.account),
      active: true,
      recoveryOwners: event.params.recoveryOwners.map(normalizeAddress),
      rolesModifier: normalizeAddress(event.params.rolesModifier),
      roleKey: event.params.roleKey.toLowerCase(),
      allowanceKey: event.params.allowanceKey.toLowerCase(),
      permissionsConfigHash: event.params.permissionsConfigHash.toLowerCase(),
      recoveryConfigHash: event.params.recoveryConfigHash.toLowerCase(),
      recoveryThreshold: Number(event.params.recoveryThreshold),
      updatedAt: event.block.timestamp,
    });
  }
);

indexer.onEvent(
  { contract: "SettlementModule", event: "SettlementRecoveryUpdated" },
  async ({ event, context }) => {
    const entityId = settlementAccountId(event.chainId, event.params.garden);
    const existing = await context.SettlementAccount.get(entityId);
    if (!existing) return;
    context.SettlementAccount.set({
      ...existing,
      recoveryOwners: event.params.recoveryOwners.map(normalizeAddress),
      recoveryConfigHash: event.params.recoveryConfigHash.toLowerCase(),
      updatedAt: event.block.timestamp,
    });
  }
);

indexer.onEvent(
  { contract: "SettlementModule", event: "SettlementAccountStatusChanged" },
  async ({ event, context }) => {
    const entityId = settlementAccountId(event.chainId, event.params.garden);
    const existing = await context.SettlementAccount.get(entityId);
    if (!existing) return;
    context.SettlementAccount.set({
      ...existing,
      active: event.params.active,
      updatedAt: event.block.timestamp,
    });
  }
);

indexer.onEvent(
  { contract: "SettlementModule", event: "CcipRouteUpdated" },
  async ({ event, context }) => {
    const existing = await sourceConfig(
      context,
      event.chainId,
      event.srcAddress,
      event.block.timestamp
    );
    const activePeer = normalizeAddress(event.params.destinationExecutor);
    context.SettlementConfiguration.set({
      ...existing,
      remoteChainSelector: event.params.destinationChainSelector,
      activePeer,
      previousPeer: optionalAddress(event.params.previousDestinationExecutor),
      previousPeerExpiresAt: event.params.previousPeerExpiresAt,
      protocolVersion: Number(event.params.protocolVersion),
      destinationGasLimit: Number(event.params.destinationGasLimit),
      peerConfigured:
        existing.remoteEvmChainId !== undefined &&
        existing.localChainSelector !== 0n &&
        existing.localRouter !== ZERO_ADDRESS &&
        event.params.destinationChainSelector !== 0n &&
        activePeer !== ZERO_ADDRESS,
      updatedAt: event.block.timestamp,
    });
  }
);

indexer.onEvent(
  { contract: "SettlementModule", event: "GardenerDeliveryStatusChanged" },
  async ({ event, context }) => {
    const existing = await sourceConfig(
      context,
      event.chainId,
      event.srcAddress,
      event.block.timestamp
    );
    context.SettlementConfiguration.set({
      ...existing,
      gardenerDeliveryEnabled: event.params.enabled,
      updatedAt: event.block.timestamp,
    });
  }
);

indexer.onEvent(
  { contract: "SettlementModule", event: "BatchSizeLimitUpdated" },
  async ({ event, context }) => {
    const existing = await sourceConfig(
      context,
      event.chainId,
      event.srcAddress,
      event.block.timestamp
    );
    context.SettlementConfiguration.set({
      ...existing,
      batchSizeLimit: Number(event.params.limit),
      updatedAt: event.block.timestamp,
    });
  }
);

indexer.onEvent(
  { contract: "SettlementModule", event: "DispatcherUpdated" },
  async ({ event, context }) => {
    const existing = await sourceConfig(
      context,
      event.chainId,
      event.srcAddress,
      event.block.timestamp
    );
    context.SettlementConfiguration.set({
      ...existing,
      dispatcher: optionalAddress(event.params.dispatcher),
      updatedAt: event.block.timestamp,
    });
  }
);

indexer.onEvent(
  { contract: "SettlementModule", event: "FeeReserveMinimumUpdated" },
  async ({ event, context }) => {
    const existing = await sourceConfig(
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
  { contract: "SettlementModule", event: "HatsModuleUpdated" },
  async ({ event, context }) => {
    const existing = await sourceConfig(
      context,
      event.chainId,
      event.srcAddress,
      event.block.timestamp
    );
    context.SettlementConfiguration.set({
      ...existing,
      hatsModule: normalizeAddress(event.params.newModule),
      updatedAt: event.block.timestamp,
    });
  }
);

indexer.onEvent(
  { contract: "SettlementModule", event: "CommitmentPoolingModuleUpdated" },
  async ({ event, context }) => {
    const existing = await sourceConfig(
      context,
      event.chainId,
      event.srcAddress,
      event.block.timestamp
    );
    context.SettlementConfiguration.set({
      ...existing,
      commitmentPoolingModule: normalizeAddress(event.params.newModule),
      updatedAt: event.block.timestamp,
    });
  }
);

indexer.onEvent(
  { contract: "SettlementModule", event: "CreditRegistryUpdated" },
  async ({ event, context }) => {
    const existing = await sourceConfig(
      context,
      event.chainId,
      event.srcAddress,
      event.block.timestamp
    );
    context.SettlementConfiguration.set({
      ...existing,
      creditRegistry: normalizeAddress(event.params.newRegistry),
      updatedAt: event.block.timestamp,
    });
  }
);

indexer.onEvent(
  { contract: "SettlementModule", event: "PausedSet" },
  async ({ event, context }) => {
    const existing = await sourceConfig(
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

indexer.onEvent(
  { contract: "SettlementModule", event: "FeeReserveFunded" },
  async ({ event, context }) => {
    const existing = await sourceConfig(
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
  { contract: "SettlementModule", event: "ExcessFeesWithdrawn" },
  async ({ event, context }) => {
    const existing = await sourceConfig(
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
