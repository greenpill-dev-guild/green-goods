import { useMemo } from "react";
import { useReadContracts } from "wagmi";
import type { CookieJar } from "../../types/cookie-jar";
import type { Address } from "../../types/domain";
import {
  COOKIE_JAR_ABI,
  COOKIE_JAR_MODULE_ABI,
  ERC20_DECIMALS_ABI,
} from "../../utils/blockchain/abis";
import { getNetworkContracts } from "../../utils/blockchain/contracts";
import { ZERO_ADDRESS } from "../../utils/blockchain/vaults";
import { useGardens } from "../blockchain/useBaseLists";
import { useCurrentChain } from "../blockchain/useChainConfig";
import { useRole } from "../gardener/useRole";
import { STALE_TIME_MEDIUM } from "../query-keys";

/**
 * Aggregates cookie jars across all gardens where the current user is an operator.
 * Useful for wallet/dashboard views that show all jars the user can manage.
 */
export function useUserCookieJars() {
  const chainId = useCurrentChain();
  const { operatorGardens: roleOperatorGardens } = useRole();
  const { data: gardens } = useGardens();

  const contracts = getNetworkContracts(chainId);
  const moduleAddress = contracts.cookieJarModule;
  const moduleConfigured = !!moduleAddress && moduleAddress.toLowerCase() !== ZERO_ADDRESS;

  // Filter to operator gardens only
  const operatorGardens = useMemo(() => {
    if (!gardens || !roleOperatorGardens?.length) return [];
    const opSet = new Set(roleOperatorGardens.map((g) => g.id.toLowerCase()));
    return gardens.filter((g) => opSet.has(g.tokenAddress.toLowerCase()));
  }, [gardens, roleOperatorGardens]);

  // Step 1: Batch-read jar addresses for each operator garden
  const jarAddressContracts = useMemo(
    () =>
      operatorGardens.map((garden) => ({
        address: moduleAddress as Address,
        abi: COOKIE_JAR_MODULE_ABI,
        functionName: "getGardenJars" as const,
        args: [garden.tokenAddress.toLowerCase() as Address] as const,
      })),
    [operatorGardens, moduleAddress]
  );

  const { data: jarAddressResults, isLoading: isLoadingAddresses } = useReadContracts({
    contracts: jarAddressContracts,
    query: {
      enabled: moduleConfigured && operatorGardens.length > 0,
      staleTime: STALE_TIME_MEDIUM,
    },
  });

  // Flatten jar addresses with their garden context
  const jarGardenPairs = useMemo(() => {
    if (!jarAddressResults) return [];
    const pairs: Array<{ jarAddress: Address; gardenAddress: Address }> = [];
    for (let i = 0; i < operatorGardens.length; i++) {
      const result = jarAddressResults[i];
      const addrs = (result?.result as Address[] | undefined) ?? [];
      for (const addr of addrs) {
        if (addr.toLowerCase() !== ZERO_ADDRESS) {
          pairs.push({
            jarAddress: addr,
            gardenAddress: operatorGardens[i].tokenAddress.toLowerCase() as Address,
          });
        }
      }
    }
    return pairs;
  }, [jarAddressResults, operatorGardens]);

  // Step 2: Multicall to read each jar's state
  const jarDetailContracts = useMemo(
    () =>
      jarGardenPairs.flatMap(({ jarAddress }) => [
        { address: jarAddress, abi: COOKIE_JAR_ABI, functionName: "CURRENCY" as const },
        { address: jarAddress, abi: COOKIE_JAR_ABI, functionName: "currencyHeldByJar" as const },
        { address: jarAddress, abi: COOKIE_JAR_ABI, functionName: "maxWithdrawal" as const },
        { address: jarAddress, abi: COOKIE_JAR_ABI, functionName: "withdrawalInterval" as const },
        { address: jarAddress, abi: COOKIE_JAR_ABI, functionName: "paused" as const },
        {
          address: jarAddress,
          abi: COOKIE_JAR_ABI,
          functionName: "EMERGENCY_WITHDRAWAL_ENABLED" as const,
        },
        { address: jarAddress, abi: COOKIE_JAR_ABI, functionName: "MIN_DEPOSIT" as const },
      ]),
    [jarGardenPairs]
  );

  const { data: detailResults, isLoading: isLoadingDetails } = useReadContracts({
    contracts: jarDetailContracts,
    query: {
      enabled: jarGardenPairs.length > 0,
      staleTime: STALE_TIME_MEDIUM,
    },
  });

  // Step 3: Read decimals for each jar's currency (depends on step 2 results)
  const currencyAddresses = useMemo(() => {
    if (!detailResults) return [];
    const FIELDS_PER_JAR = 7;
    return jarGardenPairs.map((_, i) => {
      const currency = detailResults[i * FIELDS_PER_JAR]?.result as Address | undefined;
      return currency;
    });
  }, [detailResults, jarGardenPairs]);

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

  // Step 4: Transform into CookieJar[]
  const jars = useMemo<CookieJar[]>(() => {
    if (!detailResults) return [];

    const FIELDS_PER_JAR = 7;
    let decimalsIdx = 0;
    return jarGardenPairs
      .map(({ jarAddress, gardenAddress }, i) => {
        const offset = i * FIELDS_PER_JAR;
        const currency = detailResults[offset]?.result as Address | undefined;
        const balance = detailResults[offset + 1]?.result as bigint | undefined;
        const maxWithdrawal = detailResults[offset + 2]?.result as bigint | undefined;
        const withdrawalInterval = detailResults[offset + 3]?.result as bigint | undefined;
        const isPaused = detailResults[offset + 4]?.result as boolean | undefined;
        const emergencyEnabled = detailResults[offset + 5]?.result as boolean | undefined;
        const minDeposit = detailResults[offset + 6]?.result as bigint | undefined;

        if (currency === undefined || balance === undefined) return null;

        const tokenDecimals = (decimalsResults?.[decimalsIdx]?.result as number | undefined) ?? 18;
        decimalsIdx++;

        return {
          jarAddress,
          gardenAddress,
          assetAddress: currency,
          balance: balance ?? 0n,
          currency,
          decimals: tokenDecimals,
          maxWithdrawal: maxWithdrawal ?? 0n,
          withdrawalInterval: withdrawalInterval ?? 0n,
          minDeposit: minDeposit ?? 0n,
          isPaused: isPaused ?? false,
          emergencyWithdrawalEnabled: emergencyEnabled ?? false,
        } satisfies CookieJar;
      })
      .filter((jar): jar is CookieJar => jar !== null);
  }, [detailResults, decimalsResults, jarGardenPairs]);

  return {
    jars,
    isLoading: isLoadingAddresses || isLoadingDetails || isLoadingDecimals,
    moduleConfigured,
  };
}
