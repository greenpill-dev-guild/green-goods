import { DEFAULT_CHAIN_ID } from "../../config/blockchain";
import type { Address } from "../../types/domain";
import type { GardenVault, VaultDeposit, VaultEvent, VaultEventType } from "../../types/vaults";
import { logger } from "../app/logger";
import { greenGoodsIndexer } from "./graphql-client";

const GARDEN_VAULT_FIELDS = `
  id
  chainId
  garden
  asset
  vaultAddress
  totalDeposited
  totalWithdrawn
  totalHarvestCount
  donationAddress
  depositorCount
  paused
  createdAt
`;

const GARDEN_VAULTS_BY_GARDEN_QUERY = /* GraphQL */ `
  query GardenVaultsByGarden($chainId: Int!, $garden: String!) {
    GardenVault(
      where: { chainId: { _eq: $chainId }, garden: { _eq: $garden } }
      order_by: { createdAt: desc }
    ) {
      ${GARDEN_VAULT_FIELDS}
    }
  }
`;

const GARDEN_VAULTS_BY_CHAIN_QUERY = /* GraphQL */ `
  query GardenVaultsByChain($chainId: Int!) {
    GardenVault(where: { chainId: { _eq: $chainId } }, order_by: { createdAt: desc }) {
      ${GARDEN_VAULT_FIELDS}
    }
  }
`;

const VAULT_DEPOSITS_QUERY = /* GraphQL */ `
  query VaultDepositsByGarden($chainId: Int!, $garden: String!) {
    VaultDeposit(
      where: { chainId: { _eq: $chainId }, garden: { _eq: $garden } }
      order_by: { shares: desc }
    ) {
      id
      chainId
      garden
      asset
      vaultAddress
      depositor
      shares
      totalDeposited
      totalWithdrawn
    }
  }
`;

const VAULT_DEPOSITS_BY_USER_QUERY = /* GraphQL */ `
  query VaultDepositsByUser($chainId: Int!, $garden: String!, $depositor: String!) {
    VaultDeposit(
      where: {
        chainId: { _eq: $chainId }
        garden: { _eq: $garden }
        depositor: { _eq: $depositor }
      }
      order_by: { shares: desc }
    ) {
      id
      chainId
      garden
      asset
      vaultAddress
      depositor
      shares
      totalDeposited
      totalWithdrawn
    }
  }
`;

const VAULT_EVENTS_QUERY = /* GraphQL */ `
  query VaultEventsByGarden($chainId: Int!, $garden: String!, $limit: Int!) {
    VaultEvent(
      where: { chainId: { _eq: $chainId }, garden: { _eq: $garden } }
      order_by: { timestamp: desc }
      limit: $limit
    ) {
      id
      chainId
      garden
      asset
      vaultAddress
      eventType
      actor
      amount
      shares
      txHash
      timestamp
    }
  }
`;

interface GardenVaultsResponse {
  GardenVault?: Array<{
    id: string;
    chainId: number;
    garden: string;
    asset: string;
    vaultAddress: string;
    totalDeposited: bigint | string | number | null;
    totalWithdrawn: bigint | string | number | null;
    totalHarvestCount: number | null;
    donationAddress: string | null;
    depositorCount: number | null;
    paused: boolean | null;
    createdAt: number | null;
  }>;
}

interface VaultDepositsResponse {
  VaultDeposit?: Array<{
    id: string;
    chainId: number;
    garden: string;
    asset: string;
    vaultAddress: string;
    depositor: string;
    shares: bigint | string | number | null;
    totalDeposited: bigint | string | number | null;
    totalWithdrawn: bigint | string | number | null;
  }>;
}

interface VaultEventsResponse {
  VaultEvent?: Array<{
    id: string;
    chainId: number;
    garden: string;
    asset: string;
    vaultAddress: string;
    eventType: string;
    actor: string;
    amount: bigint | string | number | null;
    shares: bigint | string | number | null;
    txHash: string;
    timestamp: number | null;
  }>;
}

function normalizeAddress(address: string): Address {
  return address.toLowerCase() as Address;
}

function toBigInt(value: bigint | string | number | null | undefined): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(value);
  if (typeof value === "string" && value.length > 0) return BigInt(value);
  return 0n;
}

function mapGardenVault(
  vault: NonNullable<GardenVaultsResponse["GardenVault"]>[number]
): GardenVault {
  return {
    id: vault.id,
    chainId: vault.chainId,
    garden: normalizeAddress(vault.garden),
    asset: normalizeAddress(vault.asset),
    vaultAddress: normalizeAddress(vault.vaultAddress),
    totalDeposited: toBigInt(vault.totalDeposited),
    totalWithdrawn: toBigInt(vault.totalWithdrawn),
    totalHarvestCount: vault.totalHarvestCount ?? 0,
    donationAddress: vault.donationAddress ? normalizeAddress(vault.donationAddress) : null,
    depositorCount: vault.depositorCount ?? 0,
    paused: Boolean(vault.paused),
    createdAt: vault.createdAt ?? 0,
  };
}

function mapVaultDeposit(
  deposit: NonNullable<VaultDepositsResponse["VaultDeposit"]>[number]
): VaultDeposit {
  return {
    id: deposit.id,
    chainId: deposit.chainId,
    garden: normalizeAddress(deposit.garden),
    asset: normalizeAddress(deposit.asset),
    vaultAddress: normalizeAddress(deposit.vaultAddress),
    depositor: normalizeAddress(deposit.depositor),
    shares: toBigInt(deposit.shares),
    totalDeposited: toBigInt(deposit.totalDeposited),
    totalWithdrawn: toBigInt(deposit.totalWithdrawn),
  };
}

function mapVaultEvent(event: NonNullable<VaultEventsResponse["VaultEvent"]>[number]): VaultEvent {
  const txHash = event.txHash.startsWith("0x") ? event.txHash : `0x${event.txHash}`;

  return {
    id: event.id,
    chainId: event.chainId,
    garden: normalizeAddress(event.garden),
    asset: normalizeAddress(event.asset),
    vaultAddress: normalizeAddress(event.vaultAddress),
    eventType: event.eventType as VaultEventType,
    actor: normalizeAddress(event.actor),
    amount: event.amount === null || event.amount === undefined ? null : toBigInt(event.amount),
    shares: event.shares === null || event.shares === undefined ? null : toBigInt(event.shares),
    txHash: txHash as `0x${string}`,
    timestamp: event.timestamp ?? 0,
  };
}

export async function getGardenVaults(
  gardenAddress: string,
  chainId: number = DEFAULT_CHAIN_ID
): Promise<GardenVault[]> {
  const { data, error } = await greenGoodsIndexer.query<GardenVaultsResponse>(
    GARDEN_VAULTS_BY_GARDEN_QUERY,
    { chainId, garden: gardenAddress.toLowerCase() },
    "getGardenVaults"
  );

  if (error) {
    logger.error("[getGardenVaults] Indexer query failed", {
      chainId,
      gardenAddress,
      error: error.message,
    });
    throw new Error(`Failed to load garden vaults: ${error.message}`);
  }

  return (data?.GardenVault ?? []).map(mapGardenVault);
}

export async function getAllGardenVaults(
  chainId: number = DEFAULT_CHAIN_ID
): Promise<GardenVault[]> {
  const { data, error } = await greenGoodsIndexer.query<GardenVaultsResponse>(
    GARDEN_VAULTS_BY_CHAIN_QUERY,
    { chainId },
    "getAllGardenVaults"
  );

  if (error) {
    logger.error("[getAllGardenVaults] Indexer query failed", { chainId, error: error.message });
    throw new Error(`Failed to load vault catalog: ${error.message}`);
  }

  return (data?.GardenVault ?? []).map(mapGardenVault);
}

export async function getVaultDeposits(
  gardenAddress: string,
  chainId: number = DEFAULT_CHAIN_ID,
  depositorAddress?: string
): Promise<VaultDeposit[]> {
  if (depositorAddress) {
    const { data, error } = await greenGoodsIndexer.query<VaultDepositsResponse>(
      VAULT_DEPOSITS_BY_USER_QUERY,
      {
        chainId,
        garden: gardenAddress.toLowerCase(),
        depositor: depositorAddress.toLowerCase(),
      },
      "getVaultDepositsByUser"
    );

    if (error) {
      logger.error("[getVaultDepositsByUser] Indexer query failed", {
        chainId,
        gardenAddress,
        depositorAddress,
        error: error.message,
      });
      throw new Error(`Failed to load user vault deposits: ${error.message}`);
    }

    return (data?.VaultDeposit ?? []).map(mapVaultDeposit);
  }

  const { data, error } = await greenGoodsIndexer.query<VaultDepositsResponse>(
    VAULT_DEPOSITS_QUERY,
    { chainId, garden: gardenAddress.toLowerCase() },
    "getVaultDeposits"
  );

  if (error) {
    logger.error("[getVaultDeposits] Indexer query failed", {
      chainId,
      gardenAddress,
      error: error.message,
    });
    throw new Error(`Failed to load vault deposits: ${error.message}`);
  }

  return (data?.VaultDeposit ?? []).map(mapVaultDeposit);
}

export async function getVaultEvents(
  gardenAddress: string,
  chainId: number = DEFAULT_CHAIN_ID,
  limit = 100
): Promise<VaultEvent[]> {
  const { data, error } = await greenGoodsIndexer.query<VaultEventsResponse>(
    VAULT_EVENTS_QUERY,
    { chainId, garden: gardenAddress.toLowerCase(), limit },
    "getVaultEvents"
  );

  if (error) {
    logger.error("[getVaultEvents] Indexer query failed", { error: error.message });
    return [];
  }

  return (data?.VaultEvent ?? []).map(mapVaultEvent);
}
