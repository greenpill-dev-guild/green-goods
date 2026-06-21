import { useMemo } from "react";
import { useReadContracts } from "wagmi";
import { STALE_TIME_MEDIUM } from "../../config/query-keys";
import type { CookieJar } from "../../types/cookie-jar";
import type { Address, Garden } from "../../types/domain";
import {
  COOKIE_JAR_ABI,
  COOKIE_JAR_MODULE_ABI,
  ERC20_DECIMALS_ABI,
  GARDEN_ACCOUNT_ROLE_ABI,
} from "../../utils/blockchain/abis";
import { getNetworkContracts } from "../../utils/blockchain/contracts";
import { ZERO_ADDRESS } from "../../utils/blockchain/vaults";
import { usePrimaryAddress } from "../auth/usePrimaryAddress";
import { useGardens } from "../blockchain/useBaseLists";
import { useCurrentChain } from "../blockchain/useChainConfig";

interface AccessibleGardenCheck {
  garden: Garden;
  eligible: boolean;
  confirmed: boolean;
}

/**
 * Aggregates cookie jars across all gardens where the connected user can access
 * the jar onchain. Access is derived from the garden account's role checks and
 * intentionally fails closed when eligibility cannot be confirmed.
 */
export function useAccessibleCookieJars() {
  const chainId = useCurrentChain();
  const primaryAddress = usePrimaryAddress() as Address | null;
  const { data: gardens = [] } = useGardens();

  const contracts = getNetworkContracts(chainId);
  const moduleAddress = contracts.cookieJarModule;
  const moduleConfigured = !!moduleAddress && moduleAddress.toLowerCase() !== ZERO_ADDRESS;

  const eligibilityContracts = useMemo(
    () =>
      primaryAddress
        ? gardens.map((garden) => ({
            address: garden.id.toLowerCase() as Address,
            abi: GARDEN_ACCOUNT_ROLE_ABI,
            functionName: "isGardener" as const,
            args: [primaryAddress] as const,
          }))
        : [],
    [gardens, primaryAddress]
  );

  const { data: eligibilityResults, isLoading: isLoadingEligibility } = useReadContracts({
    contracts: eligibilityContracts,
    allowFailure: true,
    query: {
      enabled: moduleConfigured && Boolean(primaryAddress) && gardens.length > 0,
      staleTime: STALE_TIME_MEDIUM,
    },
  });

  const accessibleGardens = useMemo<AccessibleGardenCheck[]>(() => {
    if (!primaryAddress || !moduleConfigured || gardens.length === 0) return [];

    return gardens.map((garden, index) => {
      const result = eligibilityResults?.[index];
      const confirmed = result?.status === "success" && typeof result.result === "boolean";
      const eligible = confirmed ? Boolean(result.result) : false;

      return { garden, eligible, confirmed };
    });
  }, [eligibilityResults, gardens, moduleConfigured, primaryAddress]);

  const eligibilityErrorCount = useMemo(
    () => (eligibilityResults ?? []).filter((result) => result?.status !== "success").length,
    [eligibilityResults]
  );

  const eligibleGardens = useMemo(
    () =>
      accessibleGardens
        .filter((check) => check.confirmed && check.eligible)
        .map((check) => check.garden),
    [accessibleGardens]
  );

  const jarAddressContracts = useMemo(
    () =>
      eligibleGardens.map((garden) => ({
        address: moduleAddress as Address,
        abi: COOKIE_JAR_MODULE_ABI,
        functionName: "getGardenJars" as const,
        args: [garden.id.toLowerCase() as Address] as const,
      })),
    [eligibleGardens, moduleAddress]
  );

  const { data: jarAddressResults, isLoading: isLoadingAddresses } = useReadContracts({
    contracts: jarAddressContracts,
    allowFailure: true,
    query: {
      enabled: moduleConfigured && eligibleGardens.length > 0,
      staleTime: STALE_TIME_MEDIUM,
    },
  });

  const jarGardenPairs = useMemo(() => {
    if (!jarAddressResults) return [];

    const pairs: Array<{ jarAddress: Address; gardenAddress: Address }> = [];

    for (let index = 0; index < eligibleGardens.length; index++) {
      const result = jarAddressResults[index];
      const addresses = (result?.result as Address[] | undefined) ?? [];

      for (const address of addresses) {
        if (address.toLowerCase() !== ZERO_ADDRESS) {
          pairs.push({
            jarAddress: address,
            gardenAddress: eligibleGardens[index].id.toLowerCase() as Address,
          });
        }
      }
    }

    return pairs;
  }, [eligibleGardens, jarAddressResults]);

  const jarAddressErrorCount = useMemo(
    () => (jarAddressResults ?? []).filter((result) => result?.status !== "success").length,
    [jarAddressResults]
  );

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
    allowFailure: true,
    query: {
      enabled: jarGardenPairs.length > 0,
      staleTime: STALE_TIME_MEDIUM,
    },
  });

  const detailErrorCount = useMemo(
    () => (detailResults ?? []).filter((result) => result?.status !== "success").length,
    [detailResults]
  );

  const currencyAddresses = useMemo(() => {
    if (!detailResults) return [];

    const fieldsPerJar = 7;
    return jarGardenPairs.map((_, index) => {
      const currency = detailResults[index * fieldsPerJar]?.result as Address | undefined;
      return currency;
    });
  }, [detailResults, jarGardenPairs]);

  const decimalsContracts = useMemo(
    () =>
      currencyAddresses
        .filter((address): address is Address => Boolean(address))
        .map((address) => ({
          address,
          abi: ERC20_DECIMALS_ABI,
          functionName: "decimals" as const,
        })),
    [currencyAddresses]
  );

  const { data: decimalsResults, isLoading: isLoadingDecimals } = useReadContracts({
    contracts: decimalsContracts,
    allowFailure: true,
    query: {
      enabled: decimalsContracts.length > 0,
      staleTime: STALE_TIME_MEDIUM,
    },
  });

  const decimalsErrorCount = useMemo(
    () => (decimalsResults ?? []).filter((result) => result?.status !== "success").length,
    [decimalsResults]
  );

  const jars = useMemo<CookieJar[]>(() => {
    if (!detailResults) return [];

    const fieldsPerJar = 7;
    let decimalsIndex = 0;

    return jarGardenPairs
      .map(({ jarAddress, gardenAddress }, index) => {
        const offset = index * fieldsPerJar;
        const currency = detailResults[offset]?.result as Address | undefined;
        const balance = detailResults[offset + 1]?.result as bigint | undefined;
        const maxWithdrawal = detailResults[offset + 2]?.result as bigint | undefined;
        const withdrawalInterval = detailResults[offset + 3]?.result as bigint | undefined;
        const isPaused = detailResults[offset + 4]?.result as boolean | undefined;
        const emergencyEnabled = detailResults[offset + 5]?.result as boolean | undefined;
        const minDeposit = detailResults[offset + 6]?.result as bigint | undefined;

        const tokenDecimals =
          currency !== undefined
            ? ((decimalsResults?.[decimalsIndex++]?.result as number | undefined) ?? 18)
            : 18;

        if (currency === undefined || balance === undefined) return null;

        return {
          jarAddress,
          gardenAddress,
          assetAddress: currency,
          balance,
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
    isLoading: isLoadingEligibility || isLoadingAddresses || isLoadingDetails || isLoadingDecimals,
    moduleConfigured,
    eligibleGardenCount: eligibleGardens.length,
    confirmedGardenCount: accessibleGardens.filter((check) => check.confirmed).length,
    unconfirmedGardenCount: accessibleGardens.filter((check) => !check.confirmed).length,
    eligibilityErrorCount,
    hasEligibilityReadFailure: eligibilityErrorCount > 0,
    jarAddressErrorCount,
    hasJarAddressReadFailure: jarAddressErrorCount > 0,
    detailErrorCount,
    hasDetailReadFailure: detailErrorCount > 0,
    decimalsErrorCount,
    hasDecimalsReadFailure: decimalsErrorCount > 0,
  };
}
