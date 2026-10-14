import { normalizeAddress } from "./addresses";

export function getGardenVaultId(chainId: number, garden: string, asset: string): string {
  return `${chainId}-${normalizeAddress(garden)}-${normalizeAddress(asset)}`;
}

export function getGardenVaultIndexId(chainId: number, garden: string): string {
  return `${chainId}-${normalizeAddress(garden)}`;
}

export function getVaultDepositId(
  chainId: number,
  vaultAddress: string,
  depositor: string
): string {
  return `${chainId}-${normalizeAddress(vaultAddress)}-${normalizeAddress(depositor)}`;
}

export function getVaultAddressIndexId(chainId: number, vaultAddress: string): string {
  return `${chainId}-${normalizeAddress(vaultAddress)}`;
}

export function getVaultEventId(
  chainId: number,
  txHash: string,
  logIndex: bigint | number
): string {
  return `${chainId}-${txHash}-${logIndex.toString()}`;
}

export function getGardenCommunityId(chainId: number, garden: string): string {
  return `${chainId}-${normalizeAddress(garden)}`;
}

export function getKarmaSyncRecordId(
  chainId: number,
  txHash: string,
  logIndex: bigint | number
): string {
  return `${chainId}-${txHash}-${logIndex.toString()}`;
}

export function getKarmaProjectAccessId(chainId: number, garden: string, account: string): string {
  return `${chainId}-${normalizeAddress(garden)}-${normalizeAddress(account)}`;
}

export function getGardenSignalPoolId(
  chainId: number,
  garden: string,
  poolAddress: string
): string {
  return `${chainId}-${normalizeAddress(garden)}-${normalizeAddress(poolAddress)}`;
}

export function getYieldAllocationId(
  chainId: number,
  txHash: string,
  logIndex: bigint | number
): string {
  return `${chainId}-${txHash}-${logIndex.toString()}`;
}

export function getYieldAccumulationId(chainId: number, garden: string, asset: string): string {
  return `${chainId}-${normalizeAddress(garden)}-${normalizeAddress(asset)}`;
}

export function getYieldFractionPurchaseId(
  chainId: number,
  txHash: string,
  logIndex: bigint | number,
  hypercertId: bigint
): string {
  return `${chainId}-${txHash}-${logIndex.toString()}-${hypercertId.toString()}`;
}

export function getYieldEventId(
  chainId: number,
  txHash: string,
  logIndex: bigint | number
): string {
  return `${chainId}-${txHash}-${logIndex.toString()}`;
}

export function getCookieJarId(chainId: number, garden: string, asset: string): string {
  return `${chainId}-${normalizeAddress(garden)}-${normalizeAddress(asset)}`;
}

export function getCampaignCookieJarId(chainId: number, jarAddress: string): string {
  return `${chainId}-${normalizeAddress(jarAddress)}`;
}

export function getGreenWillBadgeDefinitionId(chainId: number, badgeId: string): string {
  return `${chainId}-${badgeId}`;
}

export function getGreenWillBadgeOwnershipId(
  chainId: number,
  badgeId: string,
  owner: string
): string {
  return `${chainId}-${badgeId}-${normalizeAddress(owner)}`;
}

export function getMarketplaceOrderId(chainId: number, orderId: bigint): string {
  return `${chainId}-${orderId.toString()}`;
}

export function getMarketplacePurchaseId(
  chainId: number,
  txHash: string,
  logIndex: bigint | number
): string {
  return `${chainId}-${txHash}-${logIndex.toString()}`;
}
