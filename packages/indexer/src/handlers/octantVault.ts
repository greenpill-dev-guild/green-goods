import { OctantModule, OctantVault, VaultEventType } from "../../generated";

import type {
  contractRegistrations,
  GardenVault,
  GardenVaultIndex,
  HandlerTypes_contractRegisterArgs,
  OctantModule_DonationAddressUpdated_handlerArgs,
  OctantModule_EmergencyPaused_handlerArgs,
  OctantModule_HarvestTriggered_handlerArgs,
  OctantModule_VaultCreated_eventArgs,
  OctantModule_VaultCreated_handlerArgs,
  OctantVault_Deposit_handlerArgs,
  OctantVault_Withdraw_handlerArgs,
  VaultAddressIndex,
  VaultDeposit,
  VaultEvent,
} from "../../generated/src/Types.gen";

import {
  createDefaultGardenVault,
  getGardenVaultId,
  getGardenVaultIndexId,
  getTxHash,
  getVaultAddressIndexId,
  getVaultDepositId,
  getVaultEventId,
  normalizeAddress,
  ZERO_ADDRESS,
} from "./shared";

// ============================================================================
// OCTANT MODULE & VAULT EVENT HANDLERS
// ============================================================================

OctantModule.VaultCreated.contractRegister(
  ({
    event,
    context,
  }: HandlerTypes_contractRegisterArgs<OctantModule_VaultCreated_eventArgs> & {
    context: contractRegistrations;
  }) => {
    context.addOctantVault(event.params.vault);
    context.log.info(`Registered new OctantVault at ${event.params.vault}`);
  }
);

OctantModule.VaultCreated.handler(
  async ({ event, context }: OctantModule_VaultCreated_handlerArgs<void>) => {
    const garden = normalizeAddress(event.params.garden);
    const asset = normalizeAddress(event.params.asset);
    const vaultAddress = normalizeAddress(event.params.vault);
    const gardenVaultId = getGardenVaultId(event.chainId, garden, asset);

    const existingGardenVault = await context.GardenVault.get(gardenVaultId);
    const nextGardenVault: GardenVault = {
      ...(existingGardenVault ??
        createDefaultGardenVault(
          event.chainId,
          garden,
          asset,
          vaultAddress,
          event.block.timestamp
        )),
      id: gardenVaultId,
      chainId: event.chainId,
      garden,
      asset,
      vaultAddress,
    };

    context.GardenVault.set(nextGardenVault);

    const gardenIndexId = getGardenVaultIndexId(event.chainId, garden);
    const existingGardenIndex = await context.GardenVaultIndex.get(gardenIndexId);
    const assets = existingGardenIndex?.assets ?? [];
    const normalizedAssets = assets.map((item) => normalizeAddress(item));
    const nextAssets = normalizedAssets.includes(asset) ? assets : [...assets, asset];

    const nextGardenIndex: GardenVaultIndex = {
      id: gardenIndexId,
      chainId: event.chainId,
      garden,
      assets: nextAssets,
    };
    context.GardenVaultIndex.set(nextGardenIndex);

    const vaultAddressIndexId = getVaultAddressIndexId(event.chainId, vaultAddress);
    const vaultAddressIndex: VaultAddressIndex = {
      id: vaultAddressIndexId,
      chainId: event.chainId,
      vaultAddress,
      garden,
      asset,
    };
    context.VaultAddressIndex.set(vaultAddressIndex);
  }
);

OctantModule.HarvestTriggered.handler(
  async ({ event, context }: OctantModule_HarvestTriggered_handlerArgs<void>) => {
    const garden = normalizeAddress(event.params.garden);
    const asset = normalizeAddress(event.params.asset);
    const gardenVaultId = getGardenVaultId(event.chainId, garden, asset);
    const existingGardenVault = await context.GardenVault.get(gardenVaultId);

    const nextGardenVault: GardenVault = {
      ...(existingGardenVault ??
        createDefaultGardenVault(
          event.chainId,
          garden,
          asset,
          ZERO_ADDRESS,
          event.block.timestamp
        )),
      totalHarvestCount: (existingGardenVault?.totalHarvestCount ?? 0) + 1,
    };
    context.GardenVault.set(nextGardenVault);

    const txHash = getTxHash(event.transaction);
    const vaultEventId = getVaultEventId(event.chainId, txHash, event.logIndex);
    const vaultEvent: VaultEvent = {
      id: vaultEventId,
      chainId: event.chainId,
      garden,
      asset,
      vaultAddress: nextGardenVault.vaultAddress,
      eventType: "HARVEST" as VaultEventType,
      actor: normalizeAddress(event.params.caller),
      amount: undefined,
      shares: undefined,
      txHash,
      timestamp: event.block.timestamp,
    };
    context.VaultEvent.set(vaultEvent);
  }
);

OctantModule.EmergencyPaused.handler(
  async ({ event, context }: OctantModule_EmergencyPaused_handlerArgs<void>) => {
    const garden = normalizeAddress(event.params.garden);
    const asset = normalizeAddress(event.params.asset);
    const gardenVaultId = getGardenVaultId(event.chainId, garden, asset);
    const existingGardenVault = await context.GardenVault.get(gardenVaultId);

    const nextGardenVault: GardenVault = {
      ...(existingGardenVault ??
        createDefaultGardenVault(
          event.chainId,
          garden,
          asset,
          ZERO_ADDRESS,
          event.block.timestamp
        )),
      paused: true,
    };
    context.GardenVault.set(nextGardenVault);

    const txHash = getTxHash(event.transaction);
    const vaultEventId = getVaultEventId(event.chainId, txHash, event.logIndex);
    const vaultEvent: VaultEvent = {
      id: vaultEventId,
      chainId: event.chainId,
      garden,
      asset,
      vaultAddress: nextGardenVault.vaultAddress,
      eventType: "EMERGENCY_PAUSED" as VaultEventType,
      actor: normalizeAddress(event.params.caller),
      amount: undefined,
      shares: undefined,
      txHash,
      timestamp: event.block.timestamp,
    };
    context.VaultEvent.set(vaultEvent);
  }
);

OctantModule.DonationAddressUpdated.handler(
  async ({ event, context }: OctantModule_DonationAddressUpdated_handlerArgs<void>) => {
    const garden = normalizeAddress(event.params.garden);
    const donationAddress = normalizeAddress(event.params.newAddress);
    const gardenIndexId = getGardenVaultIndexId(event.chainId, garden);
    const gardenVaultIndex = await context.GardenVaultIndex.get(gardenIndexId);

    if (!gardenVaultIndex) return;

    for (const asset of gardenVaultIndex.assets) {
      const gardenVaultId = getGardenVaultId(event.chainId, garden, asset);
      const existingGardenVault = await context.GardenVault.get(gardenVaultId);
      if (!existingGardenVault) continue;

      context.GardenVault.set({
        ...existingGardenVault,
        donationAddress,
      });
    }
  }
);

OctantVault.Deposit.handler(async ({ event, context }: OctantVault_Deposit_handlerArgs<void>) => {
  const vaultAddress = normalizeAddress(event.srcAddress);
  const vaultAddressIndexId = getVaultAddressIndexId(event.chainId, vaultAddress);
  const vaultAddressIndex = await context.VaultAddressIndex.get(vaultAddressIndexId);
  if (!vaultAddressIndex) return;

  const garden = normalizeAddress(vaultAddressIndex.garden);
  const asset = normalizeAddress(vaultAddressIndex.asset);
  const depositor = normalizeAddress(event.params.owner);
  const gardenVaultId = getGardenVaultId(event.chainId, garden, asset);
  const existingGardenVault = await context.GardenVault.get(gardenVaultId);
  if (!existingGardenVault) return;

  const depositId = getVaultDepositId(event.chainId, vaultAddress, depositor);
  const existingDeposit = await context.VaultDeposit.get(depositId);

  const nextDeposit: VaultDeposit = {
    id: depositId,
    chainId: event.chainId,
    garden,
    asset,
    vaultAddress,
    depositor,
    shares: (existingDeposit?.shares ?? 0n) + event.params.shares,
    totalDeposited: (existingDeposit?.totalDeposited ?? 0n) + event.params.assets,
    totalWithdrawn: existingDeposit?.totalWithdrawn ?? 0n,
  };
  context.VaultDeposit.set(nextDeposit);

  const existingDepositorCount = existingGardenVault.depositorCount ?? 0;
  const nextDepositorCount =
    existingDeposit || event.params.shares === 0n
      ? existingDepositorCount
      : existingDepositorCount + 1;

  context.GardenVault.set({
    ...existingGardenVault,
    totalDeposited: existingGardenVault.totalDeposited + event.params.assets,
    depositorCount: nextDepositorCount,
  });

  const txHash = getTxHash(event.transaction);
  const vaultEventId = getVaultEventId(event.chainId, txHash, event.logIndex);
  const vaultEvent: VaultEvent = {
    id: vaultEventId,
    chainId: event.chainId,
    garden,
    asset,
    vaultAddress,
    eventType: "DEPOSIT" as VaultEventType,
    actor: normalizeAddress(event.params.sender),
    amount: event.params.assets,
    shares: event.params.shares,
    txHash,
    timestamp: event.block.timestamp,
  };
  context.VaultEvent.set(vaultEvent);
});

OctantVault.Withdraw.handler(async ({ event, context }: OctantVault_Withdraw_handlerArgs<void>) => {
  const vaultAddress = normalizeAddress(event.srcAddress);
  const vaultAddressIndexId = getVaultAddressIndexId(event.chainId, vaultAddress);
  const vaultAddressIndex = await context.VaultAddressIndex.get(vaultAddressIndexId);
  if (!vaultAddressIndex) return;

  const garden = normalizeAddress(vaultAddressIndex.garden);
  const asset = normalizeAddress(vaultAddressIndex.asset);
  const depositor = normalizeAddress(event.params.owner);
  const gardenVaultId = getGardenVaultId(event.chainId, garden, asset);
  const existingGardenVault = await context.GardenVault.get(gardenVaultId);
  if (!existingGardenVault) return;

  const depositId = getVaultDepositId(event.chainId, vaultAddress, depositor);
  const existingDeposit = await context.VaultDeposit.get(depositId);
  const nextShares = (existingDeposit?.shares ?? 0n) - event.params.shares;

  const nextDeposit: VaultDeposit = {
    id: depositId,
    chainId: event.chainId,
    garden,
    asset,
    vaultAddress,
    depositor,
    shares: nextShares > 0n ? nextShares : 0n,
    totalDeposited: existingDeposit?.totalDeposited ?? 0n,
    totalWithdrawn: (existingDeposit?.totalWithdrawn ?? 0n) + event.params.assets,
  };
  context.VaultDeposit.set(nextDeposit);

  context.GardenVault.set({
    ...existingGardenVault,
    totalWithdrawn: existingGardenVault.totalWithdrawn + event.params.assets,
  });

  const txHash = getTxHash(event.transaction);
  const vaultEventId = getVaultEventId(event.chainId, txHash, event.logIndex);
  const vaultEvent: VaultEvent = {
    id: vaultEventId,
    chainId: event.chainId,
    garden,
    asset,
    vaultAddress,
    eventType: "WITHDRAW" as VaultEventType,
    actor: normalizeAddress(event.params.sender),
    amount: event.params.assets,
    shares: event.params.shares,
    txHash,
    timestamp: event.block.timestamp,
  };
  context.VaultEvent.set(vaultEvent);
});
