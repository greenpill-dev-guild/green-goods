import { useMemo } from "react";
import { useReadContract, useReadContracts } from "wagmi";
import type { CookieJar } from "../../types/cookie-jar";
import type { Address } from "../../types/domain";
import {
  COOKIE_JAR_ABI,
  COOKIE_JAR_MODULE_ABI,
  ERC20_DECIMALS_ABI,
} from "../../utils/blockchain/abis";
import { getNetworkContracts } from "../../utils/blockchain/contracts";
import { ZERO_ADDRESS } from "../../utils/blockchain/vaults";
import { useCurrentChain } from "../blockchain/useChainConfig";
import { STALE_TIME_MEDIUM } from "../query-keys";

interface UseGardenCookieJarsOptions {
  enabled?: boolean;
}

export function useGardenCookieJars(
  gardenAddress?: string,
  options: UseGardenCookieJarsOptions = {}
) {
  const chainId = useCurrentChain();
  const enabled = options.enabled ?? true;
  const normalizedGarden = gardenAddress?.toLowerCase() as Address | undefined;

  const contracts = getNetworkContracts(chainId);
  const moduleAddress = contracts.cookieJarModule;
  const moduleConfigured = !!moduleAddress && moduleAddress.toLowerCase() !== ZERO_ADDRESS;

  // Step 1: Get jar addresses for this garden
  const {
    data: jarAddresses,
    isLoading: isLoadingAddresses,
    error: addressError,
  } = useReadContract({
    address: moduleAddress as Address,
    abi: COOKIE_JAR_MODULE_ABI,
    functionName: "getGardenJars",
    args: normalizedGarden ? [normalizedGarden] : undefined,
    query: {
      enabled: enabled && moduleConfigured && !!normalizedGarden,
      staleTime: STALE_TIME_MEDIUM,
    },
  });

  const validJarAddresses = useMemo(
    () =>
      ((jarAddresses as Address[] | undefined) ?? []).filter(
        (addr) => addr.toLowerCase() !== ZERO_ADDRESS
      ),
    [jarAddresses]
  );

  // Step 2: Multicall to read each jar's state
  const jarContracts = useMemo(
    () =>
      validJarAddresses.flatMap((jarAddr) => [
        { address: jarAddr, abi: COOKIE_JAR_ABI, functionName: "CURRENCY" as const },
        { address: jarAddr, abi: COOKIE_JAR_ABI, functionName: "currencyHeldByJar" as const },
        { address: jarAddr, abi: COOKIE_JAR_ABI, functionName: "maxWithdrawal" as const },
        { address: jarAddr, abi: COOKIE_JAR_ABI, functionName: "withdrawalInterval" as const },
        { address: jarAddr, abi: COOKIE_JAR_ABI, functionName: "paused" as const },
        {
          address: jarAddr,
          abi: COOKIE_JAR_ABI,
          functionName: "EMERGENCY_WITHDRAWAL_ENABLED" as const,
        },
        { address: jarAddr, abi: COOKIE_JAR_ABI, functionName: "MIN_DEPOSIT" as const },
      ]),
    [validJarAddresses]
  );

  const {
    data: multicallResults,
    isLoading: isLoadingDetails,
    error: detailsError,
  } = useReadContracts({
    contracts: jarContracts,
    query: {
      enabled: validJarAddresses.length > 0,
      staleTime: STALE_TIME_MEDIUM,
    },
  });

  // Step 3: Read decimals for each jar's currency (depends on step 2 results)
  const currencyAddresses = useMemo(() => {
    if (!multicallResults) return [];
    const FIELDS_PER_JAR = 7;
    return validJarAddresses.map((_, i) => {
      const currency = multicallResults[i * FIELDS_PER_JAR]?.result as Address | undefined;
      return currency;
    });
  }, [multicallResults, validJarAddresses]);

  const decimalsContracts = useMemo(
    () =>
      currencyAddresses
        .filter((addr): addr is Address => !!addr)
        .map((addr) => ({
          address: addr,
          abi: ERC20_DECIMALS_ABI,
          functionName: "decimals" as const,
        })),
    [currencyAddresses]
  );

  const { data: decimalsResults, isLoading: isLoadingDecimals } = useReadContracts({
    contracts: decimalsContracts,
    query: {
      enabled: decimalsContracts.length > 0,
      staleTime: STALE_TIME_MEDIUM,
    },
  });

  // Step 4: Transform multicall results into CookieJar[]
  const jars = useMemo<CookieJar[]>(() => {
    if (!multicallResults || !normalizedGarden) return [];

    const FIELDS_PER_JAR = 7;
    let decimalsIdx = 0;
    return validJarAddresses
      .map((jarAddr, i) => {
        const offset = i * FIELDS_PER_JAR;
        const currency = multicallResults[offset]?.result as Address | undefined;
        const balance = multicallResults[offset + 1]?.result as bigint | undefined;
        const maxWithdrawal = multicallResults[offset + 2]?.result as bigint | undefined;
        const withdrawalInterval = multicallResults[offset + 3]?.result as bigint | undefined;
        const isPaused = multicallResults[offset + 4]?.result as boolean | undefined;
        const emergencyEnabled = multicallResults[offset + 5]?.result as boolean | undefined;
        const minDeposit = multicallResults[offset + 6]?.result as bigint | undefined;

        // Skip jars where critical data failed to load
        if (currency === undefined || balance === undefined) return null;

        const tokenDecimals = (decimalsResults?.[decimalsIdx]?.result as number | undefined) ?? 18;
        decimalsIdx++;

        return {
          jarAddress: jarAddr,
          gardenAddress: normalizedGarden,
          assetAddress: currency,
          balance: balance ?? 0n,
          currency: currency,
          decimals: tokenDecimals,
          maxWithdrawal: maxWithdrawal ?? 0n,
          withdrawalInterval: withdrawalInterval ?? 0n,
          minDeposit: minDeposit ?? 0n,
          isPaused: isPaused ?? false,
          emergencyWithdrawalEnabled: emergencyEnabled ?? false,
        } satisfies CookieJar;
      })
      .filter((jar): jar is CookieJar => jar !== null);
  }, [multicallResults, decimalsResults, validJarAddresses, normalizedGarden]);

  return {
    jars,
    isLoading: isLoadingAddresses || isLoadingDetails || isLoadingDecimals,
    error: addressError || detailsError,
    jarCount: validJarAddresses.length,
    moduleConfigured,
  };
}
