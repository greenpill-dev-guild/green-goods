import { useMemo } from "react";
import { useReadContract, useReadContracts } from "wagmi";
import { STALE_TIME_MEDIUM } from "../../config/query-keys/constants";
import type { Address } from "../../types/domain";
import type { SplitConfig } from "../../types/gardens-community";
import { COOKIE_JAR_MODULE_ABI } from "../../utils/blockchain/abis/cookie-jar";
import { OCTANT_VAULT_ABI } from "../../utils/blockchain/abis/octant";
import { YIELD_SPLITTER_ABI } from "../../utils/blockchain/abis/yield";
import { isZeroAddress, ZERO_ADDRESS } from "../../utils/blockchain/address";
import { getNetworkContracts } from "../../utils/blockchain/contracts";
import { useCurrentChain } from "../blockchain/useChainConfig";
import { useSplitConfig } from "./useSplitConfig";

export type YieldStatus = "loading" | "error" | "unavailable" | "empty" | "waiting" | "ready";

export interface YieldDestination {
  address: Address;
  kind: "cookie_jar" | "legacy_cookie_jar" | "treasury" | "garden_fallback";
}

export interface YieldDistributionAmounts {
  cookieJarAmount: bigint;
  fractionsAmount: bigint;
  treasuryAmount: bigint;
  totalAmount: bigint;
}

interface UseYieldStatusOptions {
  enabled?: boolean;
}

const BPS_DENOMINATOR = 10_000n;

export function estimateYieldDistribution(
  totalAmount: bigint,
  config: SplitConfig
): YieldDistributionAmounts {
  const cookieJarAmount = (totalAmount * BigInt(config.cookieJarBps)) / BPS_DENOMINATOR;
  const fractionsAmount = (totalAmount * BigInt(config.fractionsBps)) / BPS_DENOMINATOR;
  return {
    cookieJarAmount,
    fractionsAmount,
    treasuryAmount: totalAmount - cookieJarAmount - fractionsAmount,
    totalAmount,
  };
}

function successfulResult<T>(
  result: { status: "success" | "failure"; result?: unknown } | undefined,
  fallback: T
): T {
  return result?.status === "success" ? (result.result as T) : fallback;
}

export function useYieldStatus(
  gardenAddress?: Address,
  assetAddress?: Address,
  vaultAddress?: Address,
  options: UseYieldStatusOptions = {}
) {
  const chainId = useCurrentChain();
  const network = getNetworkContracts(chainId);
  const yieldSplitter = network.yieldSplitter as Address;
  const cookieJarModule = network.cookieJarModule as Address;
  const enabled =
    (options.enabled ?? true) &&
    Boolean(gardenAddress && assetAddress && vaultAddress) &&
    !isZeroAddress(yieldSplitter);

  const baseQuery = useReadContracts({
    contracts: enabled
      ? [
          {
            address: yieldSplitter,
            abi: YIELD_SPLITTER_ABI,
            functionName: "gardenShares",
            args: [gardenAddress!, vaultAddress!],
            chainId,
          },
          {
            address: yieldSplitter,
            abi: YIELD_SPLITTER_ABI,
            functionName: "pendingYield",
            args: [gardenAddress!, assetAddress!],
            chainId,
          },
          {
            address: yieldSplitter,
            abi: YIELD_SPLITTER_ABI,
            functionName: "minYieldThreshold",
            args: [],
            chainId,
          },
          {
            address: yieldSplitter,
            abi: YIELD_SPLITTER_ABI,
            functionName: "assetYieldThresholds",
            args: [assetAddress!],
            chainId,
          },
          {
            address: yieldSplitter,
            abi: YIELD_SPLITTER_ABI,
            functionName: "getEscrowedFractions",
            args: [gardenAddress!, assetAddress!],
            chainId,
          },
          {
            address: yieldSplitter,
            abi: YIELD_SPLITTER_ABI,
            functionName: "gardenVaults",
            args: [gardenAddress!, assetAddress!],
            chainId,
          },
          {
            address: yieldSplitter,
            abi: YIELD_SPLITTER_ABI,
            functionName: "gardenCookieJars",
            args: [gardenAddress!],
            chainId,
          },
          {
            address: yieldSplitter,
            abi: YIELD_SPLITTER_ABI,
            functionName: "gardenTreasuries",
            args: [gardenAddress!],
            chainId,
          },
          {
            address: yieldSplitter,
            abi: YIELD_SPLITTER_ABI,
            functionName: "cookieJarModule",
            args: [],
            chainId,
          },
        ]
      : [],
    allowFailure: true,
    query: { enabled, staleTime: STALE_TIME_MEDIUM },
  });

  const registeredShares = successfulResult<bigint>(baseQuery.data?.[0], 0n);
  const pendingYield = successfulResult<bigint>(baseQuery.data?.[1], 0n);
  const globalThreshold = successfulResult<bigint>(baseQuery.data?.[2], 0n);
  const assetThreshold = successfulResult<bigint>(baseQuery.data?.[3], 0n);
  const escrowedFractions = successfulResult<bigint>(baseQuery.data?.[4], 0n);
  const registeredVault = successfulResult<Address | undefined>(baseQuery.data?.[5], undefined);
  const legacyCookieJar = successfulResult<Address | undefined>(baseQuery.data?.[6], undefined);
  const treasury = successfulResult<Address | undefined>(baseQuery.data?.[7], undefined);
  const splitterCookieJarModule = successfulResult<Address | undefined>(
    baseQuery.data?.[8],
    undefined
  );

  const conversionQuery = useReadContract({
    address: vaultAddress,
    abi: OCTANT_VAULT_ABI,
    functionName: "convertToAssets",
    args: vaultAddress ? [registeredShares] : undefined,
    chainId,
    query: {
      enabled: enabled && registeredShares > 0n,
      staleTime: STALE_TIME_MEDIUM,
    },
  });

  // _routeToCookieJar() resolves the jar through the splitter's mutable
  // cookieJarModule, which the owner can rotate via setCookieJarModule(); the
  // deployment artifact is only the fallback when that read is unavailable.
  const resolvedCookieJarModule =
    splitterCookieJarModule && !isZeroAddress(splitterCookieJarModule)
      ? splitterCookieJarModule
      : cookieJarModule;
  const moduleConfigured =
    Boolean(resolvedCookieJarModule) && !isZeroAddress(resolvedCookieJarModule);
  const moduleJarQuery = useReadContract({
    address: resolvedCookieJarModule,
    abi: COOKIE_JAR_MODULE_ABI,
    functionName: "getGardenJar",
    args: gardenAddress && assetAddress ? [gardenAddress, assetAddress] : undefined,
    chainId,
    query: {
      enabled: enabled && !baseQuery.isLoading && moduleConfigured,
      staleTime: STALE_TIME_MEDIUM,
    },
  });
  const splitConfigQuery = useSplitConfig(gardenAddress, { enabled });

  const registeredShareAssets =
    registeredShares > 0n ? ((conversionQuery.data as bigint | undefined) ?? 0n) : 0n;
  const totalAvailable = registeredShareAssets + pendingYield;
  const threshold = assetThreshold > 0n ? assetThreshold : globalThreshold;
  const isVaultRegistered =
    Boolean(registeredVault && vaultAddress) &&
    registeredVault!.toLowerCase() === vaultAddress!.toLowerCase();
  const moduleJar = moduleJarQuery.data as Address | undefined;

  const destination = useMemo<YieldDestination>(() => {
    if (moduleJar && !isZeroAddress(moduleJar)) return { address: moduleJar, kind: "cookie_jar" };
    if (legacyCookieJar && !isZeroAddress(legacyCookieJar)) {
      return { address: legacyCookieJar, kind: "legacy_cookie_jar" };
    }
    if (treasury && !isZeroAddress(treasury)) return { address: treasury, kind: "treasury" };
    return { address: gardenAddress ?? (ZERO_ADDRESS as Address), kind: "garden_fallback" };
  }, [gardenAddress, legacyCookieJar, moduleJar, treasury]);

  // Only the reads that status derivation depends on may flip the hook into
  // "error": gardenShares (0), pendingYield (1), minYieldThreshold (2), and
  // gardenVaults (5). assetYieldThresholds, getEscrowedFractions,
  // gardenCookieJars, gardenTreasuries, and cookieJarModule all have fallbacks
  // (global threshold / zero / destination chain / deployment artifact), so
  // their failures must not hide an otherwise ready distribution.
  const requiredBaseReadIndexes = [0, 1, 2, 5];
  const hasBaseReadFailure = Boolean(
    baseQuery.data &&
      requiredBaseReadIndexes.some((index) => baseQuery.data?.[index]?.status === "failure")
  );
  // The displayed destination is only trustworthy when every read in its
  // resolution chain succeeded — gardenCookieJars (6), gardenTreasuries (7),
  // the live cookieJarModule (8), and the module jar lookup. Their failures
  // fall back silently, so approving a distribution against a fallback
  // address could name a destination on-chain routing will not use.
  // Consumers must gate confirmation on this instead of on status/isError.
  const destinationReadIndexes = [6, 7, 8];
  const destinationVerified =
    !destinationReadIndexes.some((index) => baseQuery.data?.[index]?.status === "failure") &&
    !moduleJarQuery.isError;
  const isLoading =
    enabled &&
    (baseQuery.isLoading ||
      splitConfigQuery.isLoading ||
      moduleJarQuery.isLoading ||
      (registeredShares > 0n && conversionQuery.isLoading));
  const isError =
    enabled &&
    (baseQuery.isError ||
      hasBaseReadFailure ||
      splitConfigQuery.isError ||
      moduleJarQuery.isError ||
      (registeredShares > 0n && conversionQuery.isError));

  let status: YieldStatus;
  if (isLoading) status = "loading";
  else if (isError) status = "error";
  else if (!isVaultRegistered) status = "unavailable";
  else if (totalAvailable === 0n) status = "empty";
  else if (totalAvailable < threshold) status = "waiting";
  else status = "ready";

  return {
    status,
    registeredShares,
    registeredShareAssets,
    pendingYield,
    totalAvailable,
    threshold,
    escrowedFractions,
    registeredVault,
    isVaultRegistered,
    splitConfig: splitConfigQuery.config,
    destination,
    destinationVerified,
    estimatedDistribution: estimateYieldDistribution(totalAvailable, splitConfigQuery.config),
    isLoading,
    isError,
    refetch: async () => {
      await Promise.all([
        baseQuery.refetch(),
        conversionQuery.refetch(),
        moduleJarQuery.refetch(),
        splitConfigQuery.refetch(),
      ]);
    },
  };
}
