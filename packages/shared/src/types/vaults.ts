import type { Address } from "./domain";

export type VaultEventType = "DEPOSIT" | "WITHDRAW" | "HARVEST" | "EMERGENCY_PAUSED";

export interface GardenVault {
  id: string;
  chainId: number;
  garden: Address;
  asset: Address;
  vaultAddress: Address;
  totalDeposited: bigint;
  totalWithdrawn: bigint;
  totalHarvestCount: number;
  donationAddress: Address | null;
  depositorCount: number;
  paused: boolean;
  createdAt: number;
}

export interface VaultDeposit {
  id: string;
  chainId: number;
  garden: Address;
  asset: Address;
  vaultAddress: Address;
  depositor: Address;
  shares: bigint;
  totalDeposited: bigint;
  totalWithdrawn: bigint;
}

export interface VaultEvent {
  id: string;
  chainId: number;
  garden: Address;
  asset: Address;
  vaultAddress: Address;
  eventType: VaultEventType;
  actor: Address;
  amount: bigint | null;
  shares: bigint | null;
  txHash: `0x${string}`;
  timestamp: number;
}

export interface DepositParams {
  gardenAddress: Address;
  assetAddress: Address;
  vaultAddress: Address;
  amount: bigint;
  receiver?: Address;
  /** Minimum shares to accept. Defaults to 99% of previewDeposit (1% slippage). */
  minSharesOut?: bigint;
}

export interface WithdrawParams {
  gardenAddress: Address;
  assetAddress: Address;
  vaultAddress: Address;
  amount: bigint;
  receiver?: Address;
  owner?: Address;
}

export interface HarvestParams {
  gardenAddress: Address;
  assetAddress: Address;
}

export interface EmergencyPauseParams {
  gardenAddress: Address;
  assetAddress: Address;
}

export interface VaultPreview {
  previewShares: bigint;
  previewAssets: bigint;
  maxDeposit: bigint;
  shareBalance: bigint;
  totalAssets: bigint;
  maxWithdraw: bigint;
  previewWithdrawShares: bigint;
}
