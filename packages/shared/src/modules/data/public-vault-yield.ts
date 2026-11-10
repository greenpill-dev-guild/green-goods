import { createPublicClient, http, type ContractFunctionParameters } from "viem";
import { getChain } from "../../config/chains";
import type { Address } from "../../types/domain";
import type { GardenVault } from "../../types/vaults";
import { AAVE_V3_POOL_ABI, rayToApr, rayToApy } from "../../utils/blockchain/aave";
import {
  OCTANT_MODULE_ABI,
  OCTANT_VAULT_ABI,
  STRATEGY_ABI,
} from "../../utils/blockchain/abis/octant";
import { isZeroAddress } from "../../utils/blockchain/address";
import { getRpcUrl } from "../../utils/blockchain/chain-registry";
import { getNetworkContracts } from "../../utils/blockchain/contracts";
import { AAVE_V3_POOL } from "../../utils/blockchain/vaults";

export interface PublicVaultYield {
  yieldByVault: Record<string, bigint | undefined>;
  ratesByAsset: Record<string, { apr: number; apy: number } | undefined>;
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
  // Pin both batches so a harvest between reads cannot mix old debt with new assets.
  const blockNumber = await client.getBlockNumber();
  const strategies = await client.multicall({
    blockNumber,
    contracts: vaults.map(
      (vault) =>
        ({
          address: moduleAddress,
          abi: OCTANT_MODULE_ABI,
          functionName: "vaultStrategies",
          args: [vault.vaultAddress],
        }) as const
    ),
  });

  const calls: ContractFunctionParameters[] = [];
  const yieldOffsets = new Map<string, number>();
  for (const [index, vault] of vaults.entries()) {
    const strategy = strategies[index];
    if (strategy?.status !== "success") continue;
    const key = vault.vaultAddress.toLowerCase();
    if (isZeroAddress(strategy.result)) {
      result.yieldByVault[key] = 0n;
      continue;
    }
    yieldOffsets.set(key, calls.length);
    calls.push(
      { address: strategy.result, abi: STRATEGY_ABI, functionName: "totalAssets" },
      { address: vault.vaultAddress, abi: OCTANT_VAULT_ABI, functionName: "totalDebt" }
    );
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
  if (calls.length === 0) return result;
  const reads = await client.multicall({ blockNumber, contracts: calls });
  for (const [key, offset] of yieldOffsets) {
    const assets = reads[offset];
    const debt = reads[offset + 1];
    if (assets?.status !== "success" || debt?.status !== "success") continue;
    if (typeof assets.result !== "bigint" || typeof debt.result !== "bigint") continue;
    // totalAssets is the live Aave balance; totalDebt is the last reported principal.
    result.yieldByVault[key] = assets.result > debt.result ? assets.result - debt.result : 0n;
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
