/**
 * Settlement operations reads
 *
 * The module's operations flags, read from the chain: who owns it, who may
 * dispatch, whether gardener delivery is on and whether the source is paused.
 * The operations card never shows an optimistic or indexed value.
 *
 * @module modules/commitment-pooling/data-settlement-operations
 */

import { readContract } from "@wagmi/core";

import { getWagmiConfig } from "../../config/appkit";
import type { Address } from "../../types/domain";
import { getNetworkContracts, SettlementModuleABI } from "../../utils/blockchain/contracts";
import { readSettlementFunction } from "./data-settlement-chain";
import { addressOrNull } from "./data-settlement-chain-mappers";

const OWNER_ABI = [
  {
    type: "function",
    name: "owner",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
] as const;

export interface SettlementOperationsChainState {
  owner: Address | null;
  dispatcher: Address | null;
  gardenerDeliveryEnabled: boolean;
  sourcePaused: boolean;
  readAt: number;
}

/**
 * The module's operations flags: who owns it, who may dispatch, whether
 * gardener delivery is on and whether the source is paused. Read from the
 * chain so the operations card never shows an optimistic or indexed value.
 */
export async function readSettlementOperationsState(
  chainId: number
): Promise<SettlementOperationsChainState> {
  const settlement = getNetworkContracts(chainId).settlementModule;
  const config = getWagmiConfig();
  const [owner, dispatcher, delivery, paused] = await Promise.all([
    readContract(config, { address: settlement, abi: OWNER_ABI, functionName: "owner", chainId }),
    readSettlementFunction({
      chainId,
      address: settlement,
      abi: SettlementModuleABI,
      functionName: "dispatcher",
    }),
    readSettlementFunction({
      chainId,
      address: settlement,
      abi: SettlementModuleABI,
      functionName: "gardenerDeliveryEnabled",
    }),
    readSettlementFunction({
      chainId,
      address: settlement,
      abi: SettlementModuleABI,
      functionName: "paused",
    }),
  ]);
  return {
    owner: addressOrNull(owner),
    dispatcher: addressOrNull(dispatcher),
    gardenerDeliveryEnabled: delivery === true,
    sourcePaused: paused === true,
    readAt: Math.floor(Date.now() / 1000),
  };
}
