import { createPublicClient, http, parseAbi, type ContractFunctionParameters } from "viem";
import { getChain } from "../../config/chains";
import type { Address } from "../../types/domain";
import type { GardenVault } from "../../types/vaults";
import { AAVE_V3_POOL_ABI, rayToApr, rayToApy } from "../../utils/blockchain/aave";
import { OCTANT_MODULE_ABI, OCTANT_VAULT_ABI } from "../../utils/blockchain/abis/octant";
import { isZeroAddress } from "../../utils/blockchain/address";
import { getRpcUrl } from "../../utils/blockchain/chain-registry";
import { getNetworkContracts } from "../../utils/blockchain/contracts";
import { AAVE_V3_POOL } from "../../utils/blockchain/vaults";

export interface PublicVaultYield {
  yieldByVault: Record<string, bigint | undefined>;
  ratesByAsset: Record<string, { apr: number; apy: number } | undefined>;
}

const STRATEGY_ACCOUNTING_ABI = parseAbi([
  "function get_default_queue() view returns (address[])",
  "function strategies(address) view returns ((uint256 activation, uint256 lastReport, uint256 currentDebt, uint256 maxDebt))",
]);

interface VaultAccounting {
  key: string;
  totalDebt: bigint;
  readDebt: bigint;
  assets: bigint;
  complete: boolean;
}

/** Read the garden vaults without mounting wallet providers. */
export async function readPublicVaultYield(
  vaults: readonly GardenVault[],
  chainId: number,
  signal?: AbortSignal
): Promise<PublicVaultYield> {
  const result: PublicVaultYield = { yieldByVault: {}, ratesByAsset: {} };
  if (vaults.length === 0) return result;
  if (vaults.some((vault) => vault.chainId !== chainId)) {
    throw new Error("Public vault yield requires vaults from one chain");
  }
  const moduleAddress = getNetworkContracts(chainId).octantModule;
  if (isZeroAddress(moduleAddress)) throw new Error("Octant module unavailable");

  const client = createPublicClient({
    chain: getChain(chainId),
    transport: http(getRpcUrl(chainId), { fetchOptions: { signal } }),
  });
  // Pin every batch so a harvest or strategy replacement cannot mix accounting generations.
  const blockNumber = await client.getBlockNumber();
  const headers = await client.multicall({
    blockNumber,
    contracts: vaults.flatMap(
      (vault) =>
        [
          {
            address: moduleAddress,
            abi: OCTANT_MODULE_ABI,
            functionName: "vaultStrategies",
            args: [vault.vaultAddress],
          },
          {
            address: vault.vaultAddress,
            abi: STRATEGY_ACCOUNTING_ABI,
            functionName: "get_default_queue",
          },
          { address: vault.vaultAddress, abi: OCTANT_VAULT_ABI, functionName: "totalDebt" },
        ] as const
    ),
  });

  const calls: ContractFunctionParameters[] = [];
  const accounting: VaultAccounting[] = [];
  const positions: { vault: VaultAccounting; strategy: Address; offset: number }[] = [];
  for (const [index, vault] of vaults.entries()) {
    const current = headers[index * 3];
    const queue = headers[index * 3 + 1];
    const debt = headers[index * 3 + 2];
    if (current?.status !== "success" || typeof current.result !== "string") continue;
    if (queue?.status !== "success" || !Array.isArray(queue.result)) continue;
    if (debt?.status !== "success" || typeof debt.result !== "bigint") continue;
    const entry: VaultAccounting = {
      key: vault.vaultAddress.toLowerCase(),
      totalDebt: debt.result,
      readDebt: 0n,
      assets: 0n,
      complete: true,
    };
    accounting.push(entry);
    // resumeVault can retain an indebted old strategy; the mapped replacement may also
    // be absent from a full/custom withdrawal queue. Normalize and deduplicate both.
    const strategies = new Set(
      [...queue.result, current.result].map((address) => address.toLowerCase() as Address)
    );
    for (const strategy of strategies) {
      if (isZeroAddress(strategy)) continue;
      positions.push({ vault: entry, strategy, offset: calls.length });
      calls.push(
        {
          address: vault.vaultAddress,
          abi: STRATEGY_ACCOUNTING_ABI,
          functionName: "strategies",
          args: [strategy],
        },
        {
          address: strategy,
          abi: OCTANT_VAULT_ABI,
          functionName: "balanceOf",
          args: [vault.vaultAddress],
        }
      );
    }
  }

  const rateOffsets = new Map<string, number>();
  const poolAddress = AAVE_V3_POOL[chainId];
  if (poolAddress) {
    for (const vault of vaults) {
      const key = vault.asset.toLowerCase();
      if (rateOffsets.has(key)) continue;
      rateOffsets.set(key, calls.length);
      calls.push({
        address: poolAddress,
        abi: AAVE_V3_POOL_ABI,
        functionName: "getReserveData",
        args: [vault.asset as Address],
      });
    }
  }
  const reads = calls.length ? await client.multicall({ blockNumber, contracts: calls }) : [];
  const conversions: ContractFunctionParameters[] = [];
  const conversionOwners: VaultAccounting[] = [];
  for (const { vault, strategy, offset } of positions) {
    const params = reads[offset];
    const shares = reads[offset + 1];
    if (
      params?.status !== "success" ||
      !params.result ||
      typeof params.result !== "object" ||
      !("currentDebt" in params.result) ||
      typeof params.result.currentDebt !== "bigint" ||
      !("activation" in params.result) ||
      typeof params.result.activation !== "bigint" ||
      shares?.status !== "success" ||
      typeof shares.result !== "bigint"
    ) {
      vault.complete = false;
      continue;
    }
    vault.readDebt += params.result.currentDebt;
    if (params.result.activation === 0n || shares.result === 0n) continue;
    // Match process_report: only the shares this vault owns count toward its assets.
    conversions.push({
      address: strategy,
      abi: OCTANT_VAULT_ABI,
      functionName: "convertToAssets",
      args: [shares.result],
    });
    conversionOwners.push(vault);
  }
  const values = conversions.length
    ? await client.multicall({ blockNumber, contracts: conversions })
    : [];
  for (const [index, vault] of conversionOwners.entries()) {
    const value = values[index];
    if (value?.status === "success" && typeof value.result === "bigint")
      vault.assets += value.result;
    else vault.complete = false;
  }
  for (const vault of accounting) {
    // A custom queue can omit a funded strategy. Withhold a partial total rather than
    // silently reporting zero or subtracting debt whose assets were never measured.
    if (!vault.complete || vault.readDebt !== vault.totalDebt) continue;
    result.yieldByVault[vault.key] =
      vault.assets > vault.totalDebt ? vault.assets - vault.totalDebt : 0n;
  }
  for (const [key, offset] of rateOffsets) {
    const read = reads[offset];
    if (read?.status !== "success" || !read.result || typeof read.result !== "object") continue;
    if (
      !("currentLiquidityRate" in read.result) ||
      typeof read.result.currentLiquidityRate !== "bigint"
    )
      continue;
    const apr = rayToApr(read.result.currentLiquidityRate);
    const apy = rayToApy(read.result.currentLiquidityRate);
    if (Number.isFinite(apr) && Number.isFinite(apy)) result.ratesByAsset[key] = { apr, apy };
  }
  return result;
}
