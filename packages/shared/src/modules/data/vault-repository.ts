import { DEFAULT_CHAIN_ID } from "../../config/blockchain";
import type { Address } from "../../types/domain";
import type { YieldAllocation } from "../../types/gardens-community";
import type { GardenVault, VaultDeposit, VaultEvent, VaultEventType } from "../../types/vaults";
import { greenGoodsIndexer, type GraphQLReader } from "./graphql-client";

export type RepositoryResult<T> =
  | { status: "ok"; data: T }
  | { status: "empty"; data: T }
  | { status: "partial"; data: T; error: Error }
  | { status: "error"; error: Error };

const GARDEN_VAULT_FIELDS = `
  id chainId garden asset vaultAddress totalDeposited totalWithdrawn
  totalHarvestCount donationAddress depositorCount paused createdAt
`;
const VAULT_DEPOSIT_FIELDS = `
  id chainId garden asset vaultAddress depositor shares totalDeposited totalWithdrawn
`;
const YIELD_ALLOCATION_FIELDS = `
  garden asset cookieJarAmount fractionsAmount juiceboxAmount totalAmount timestamp txHash
`;

const GARDEN_VAULTS_BY_GARDEN_QUERY = /* GraphQL */ `
  query GardenVaultsByGarden($chainId: Int!, $garden: String!) {
    GardenVault(where: { chainId: { _eq: $chainId }, garden: { _eq: $garden } }, order_by: { createdAt: desc }) { ${GARDEN_VAULT_FIELDS} }
  }
`;
const GARDEN_VAULTS_BY_CHAIN_QUERY = /* GraphQL */ `
  query GardenVaultsByChain($chainId: Int!) {
    GardenVault(where: { chainId: { _eq: $chainId } }, order_by: { createdAt: desc }) { ${GARDEN_VAULT_FIELDS} }
  }
`;
const VAULT_DEPOSITS_QUERY = /* GraphQL */ `
  query VaultDepositsByGarden($chainId: Int!, $garden: String!) {
    VaultDeposit(where: { chainId: { _eq: $chainId }, garden: { _eq: $garden } }, order_by: { shares: desc }) { ${VAULT_DEPOSIT_FIELDS} }
  }
`;
const VAULT_DEPOSITS_BY_USER_QUERY = /* GraphQL */ `
  query VaultDepositsByUser($chainId: Int!, $garden: String!, $depositor: String!) {
    VaultDeposit(where: { chainId: { _eq: $chainId }, garden: { _eq: $garden }, depositor: { _eq: $depositor } }, order_by: { shares: desc }) { ${VAULT_DEPOSIT_FIELDS} }
  }
`;
const VAULT_DEPOSITS_ACROSS_GARDENS_BY_USER_QUERY = /* GraphQL */ `
  query VaultDepositsAcrossGardensByUser($chainId: Int!, $depositor: String!) {
    VaultDeposit(where: { chainId: { _eq: $chainId }, depositor: { _eq: $depositor } }, order_by: { totalDeposited: desc }) { ${VAULT_DEPOSIT_FIELDS} }
  }
`;
const ALL_VAULT_DEPOSITS_QUERY = /* GraphQL */ `
  query AllVaultDeposits($chainId: Int!) {
    VaultDeposit(where: { chainId: { _eq: $chainId } }, order_by: { totalDeposited: desc }) { ${VAULT_DEPOSIT_FIELDS} }
  }
`;
const VAULT_EVENTS_QUERY = /* GraphQL */ `
  query VaultEventsByGarden($chainId: Int!, $garden: String!, $limit: Int!) {
    VaultEvent(where: { chainId: { _eq: $chainId }, garden: { _eq: $garden } }, order_by: { timestamp: desc }, limit: $limit) {
      id chainId garden asset vaultAddress eventType actor amount shares txHash timestamp
    }
  }
`;
const ALL_YIELD_ALLOCATIONS_QUERY = /* GraphQL */ `
  query AllYieldAllocations($chainId: Int!) {
    YieldAllocation(where: { chainId: { _eq: $chainId } }, order_by: { timestamp: desc }) { ${YIELD_ALLOCATION_FIELDS} }
  }
`;
const GARDEN_YIELD_ALLOCATIONS_QUERY = /* GraphQL */ `
  query GardenYieldAllocations($garden: String!, $chainId: Int!) {
    YieldAllocation(where: { garden: { _eq: $garden }, chainId: { _eq: $chainId } }, order_by: { timestamp: desc }) { ${YIELD_ALLOCATION_FIELDS} }
  }
`;

interface GardenVaultRow {
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
}

interface VaultDepositRow {
  id: string;
  chainId: number;
  garden: string;
  asset: string;
  vaultAddress: string;
  depositor: string;
  shares: bigint | string | number | null;
  totalDeposited: bigint | string | number | null;
  totalWithdrawn: bigint | string | number | null;
}

interface VaultEventRow {
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
}

interface YieldAllocationRow {
  garden: string;
  asset: string;
  cookieJarAmount: string;
  fractionsAmount: string;
  juiceboxAmount: string;
  totalAmount: string;
  timestamp: number;
  txHash: string;
}

function address(value: string): Address {
  return value.toLowerCase() as Address;
}

function bigint(value: bigint | string | number | null | undefined): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(value);
  if (typeof value === "string" && value.length > 0) return BigInt(value);
  return 0n;
}

function mapGardenVault(row: GardenVaultRow): GardenVault {
  return {
    id: row.id,
    chainId: row.chainId,
    garden: address(row.garden),
    asset: address(row.asset),
    vaultAddress: address(row.vaultAddress),
    totalDeposited: bigint(row.totalDeposited),
    totalWithdrawn: bigint(row.totalWithdrawn),
    totalHarvestCount: row.totalHarvestCount ?? 0,
    donationAddress: row.donationAddress ? address(row.donationAddress) : null,
    depositorCount: row.depositorCount ?? 0,
    paused: Boolean(row.paused),
    createdAt: row.createdAt ?? 0,
  };
}

function mapVaultDeposit(row: VaultDepositRow): VaultDeposit {
  return {
    id: row.id,
    chainId: row.chainId,
    garden: address(row.garden),
    asset: address(row.asset),
    vaultAddress: address(row.vaultAddress),
    depositor: address(row.depositor),
    shares: bigint(row.shares),
    totalDeposited: bigint(row.totalDeposited),
    totalWithdrawn: bigint(row.totalWithdrawn),
  };
}

function mapVaultEvent(row: VaultEventRow): VaultEvent {
  const txHash = row.txHash.startsWith("0x") ? row.txHash : `0x${row.txHash}`;
  return {
    id: row.id,
    chainId: row.chainId,
    garden: address(row.garden),
    asset: address(row.asset),
    vaultAddress: address(row.vaultAddress),
    eventType: row.eventType as VaultEventType,
    actor: address(row.actor),
    amount: row.amount === null || row.amount === undefined ? null : bigint(row.amount),
    shares: row.shares === null || row.shares === undefined ? null : bigint(row.shares),
    txHash: txHash as `0x${string}`,
    timestamp: row.timestamp ?? 0,
  };
}

function mapYieldAllocation(row: YieldAllocationRow): YieldAllocation {
  return {
    gardenAddress: address(row.garden),
    assetAddress: address(row.asset),
    cookieJarAmount: BigInt(row.cookieJarAmount),
    fractionsAmount: BigInt(row.fractionsAmount),
    juiceboxAmount: BigInt(row.juiceboxAmount),
    totalAmount: BigInt(row.totalAmount),
    timestamp: row.timestamp,
    txHash: row.txHash,
  };
}

function error(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

async function queryRows<TResponse, TRow, T>(
  reader: GraphQLReader,
  query: string,
  variables: Record<string, unknown>,
  operation: string,
  select: (data: TResponse) => TRow[] | undefined,
  map: (row: TRow) => T
): Promise<RepositoryResult<T[]>> {
  try {
    const result = await reader.query<TResponse>(query, variables, operation);
    const data = "data" in result ? result.data : undefined;
    const rows = data ? (select(data) ?? []) : [];
    const mapped = rows.map(map);
    if (result.error) {
      return mapped.length > 0
        ? { status: "partial", data: mapped, error: result.error }
        : { status: "error", error: result.error };
    }
    return mapped.length > 0 ? { status: "ok", data: mapped } : { status: "empty", data: [] };
  } catch (cause) {
    return { status: "error", error: error(cause) };
  }
}

export function createVaultRepository(reader: GraphQLReader) {
  const repository = {
    getGardenVaults: (gardenAddress: string, chainId = DEFAULT_CHAIN_ID) =>
      queryRows<{ GardenVault?: GardenVaultRow[] }, GardenVaultRow, GardenVault>(
        reader,
        GARDEN_VAULTS_BY_GARDEN_QUERY,
        { chainId, garden: gardenAddress.toLowerCase() },
        "getGardenVaults",
        (data) => data.GardenVault,
        mapGardenVault
      ),
    getAllGardenVaults: (chainId = DEFAULT_CHAIN_ID) =>
      queryRows<{ GardenVault?: GardenVaultRow[] }, GardenVaultRow, GardenVault>(
        reader,
        GARDEN_VAULTS_BY_CHAIN_QUERY,
        { chainId },
        "getAllGardenVaults",
        (data) => data.GardenVault,
        mapGardenVault
      ),
    getVaultDeposits: (
      gardenAddress: string,
      chainId = DEFAULT_CHAIN_ID,
      depositorAddress?: string
    ) =>
      queryRows<{ VaultDeposit?: VaultDepositRow[] }, VaultDepositRow, VaultDeposit>(
        reader,
        depositorAddress ? VAULT_DEPOSITS_BY_USER_QUERY : VAULT_DEPOSITS_QUERY,
        {
          chainId,
          garden: gardenAddress.toLowerCase(),
          ...(depositorAddress ? { depositor: depositorAddress.toLowerCase() } : {}),
        },
        depositorAddress ? "getVaultDepositsByUser" : "getVaultDeposits",
        (data) => data.VaultDeposit,
        mapVaultDeposit
      ),
    getVaultDepositsByUser: (depositorAddress: string, chainId = DEFAULT_CHAIN_ID) =>
      queryRows<{ VaultDeposit?: VaultDepositRow[] }, VaultDepositRow, VaultDeposit>(
        reader,
        VAULT_DEPOSITS_ACROSS_GARDENS_BY_USER_QUERY,
        { chainId, depositor: depositorAddress.toLowerCase() },
        "getVaultDepositsAcrossGardensByUser",
        (data) => data.VaultDeposit,
        mapVaultDeposit
      ),
    getVaultEvents: (gardenAddress: string, chainId = DEFAULT_CHAIN_ID, limit = 100) =>
      queryRows<{ VaultEvent?: VaultEventRow[] }, VaultEventRow, VaultEvent>(
        reader,
        VAULT_EVENTS_QUERY,
        { chainId, garden: gardenAddress.toLowerCase(), limit },
        "getVaultEvents",
        (data) => data.VaultEvent,
        mapVaultEvent
      ),
    getAllVaultDeposits: (chainId = DEFAULT_CHAIN_ID) =>
      queryRows<{ VaultDeposit?: VaultDepositRow[] }, VaultDepositRow, VaultDeposit>(
        reader,
        ALL_VAULT_DEPOSITS_QUERY,
        { chainId },
        "getAllVaultDeposits",
        (data) => data.VaultDeposit,
        mapVaultDeposit
      ),
    getAllYieldAllocations: (chainId = DEFAULT_CHAIN_ID) =>
      queryRows<{ YieldAllocation?: YieldAllocationRow[] }, YieldAllocationRow, YieldAllocation>(
        reader,
        ALL_YIELD_ALLOCATIONS_QUERY,
        { chainId },
        "AllYieldAllocations",
        (data) => data.YieldAllocation,
        mapYieldAllocation
      ),
    getGardenYieldAllocations: (gardenAddress: Address, chainId = DEFAULT_CHAIN_ID) =>
      queryRows<{ YieldAllocation?: YieldAllocationRow[] }, YieldAllocationRow, YieldAllocation>(
        reader,
        GARDEN_YIELD_ALLOCATIONS_QUERY,
        { garden: gardenAddress.toLowerCase(), chainId },
        "GardenYieldAllocations",
        (data) => data.YieldAllocation,
        mapYieldAllocation
      ),
  };

  return {
    ...repository,
    getGardenVaultSnapshot: async (gardenAddress: string, chainId = DEFAULT_CHAIN_ID) => {
      const [vaults, deposits] = await Promise.all([
        repository.getGardenVaults(gardenAddress, chainId),
        repository.getVaultDeposits(gardenAddress, chainId),
      ]);
      if (vaults.status === "error" && deposits.status === "error") {
        return {
          status: "error",
          error: new AggregateError(
            [vaults.error, deposits.error],
            "Failed to load garden vault snapshot"
          ),
        } satisfies RepositoryResult<{ vaults: GardenVault[]; deposits: VaultDeposit[] }>;
      }
      const data = {
        vaults: vaults.status === "error" ? [] : vaults.data,
        deposits: deposits.status === "error" ? [] : deposits.data,
      };
      const partialError =
        vaults.status === "error"
          ? vaults.error
          : deposits.status === "error"
            ? deposits.error
            : vaults.status === "partial"
              ? vaults.error
              : deposits.status === "partial"
                ? deposits.error
                : null;
      if (partialError) {
        return { status: "partial", data, error: partialError } satisfies RepositoryResult<
          typeof data
        >;
      }
      const status = data.vaults.length > 0 || data.deposits.length > 0 ? "ok" : "empty";
      return { status, data } satisfies RepositoryResult<typeof data>;
    },
  };
}

export type VaultRepository = ReturnType<typeof createVaultRepository>;
export const vaultRepository = createVaultRepository(greenGoodsIndexer);
