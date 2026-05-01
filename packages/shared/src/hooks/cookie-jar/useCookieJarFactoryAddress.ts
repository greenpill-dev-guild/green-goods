import { useReadContract } from "wagmi";
import { STALE_TIME_RARE } from "../../config/query-keys";
import type { Address } from "../../types/domain";
import { COOKIE_JAR_MODULE_ABI } from "../../utils/blockchain/abis";
import { getNetworkContracts } from "../../utils/blockchain/contracts";
import { ZERO_ADDRESS } from "../../utils/blockchain/vaults";
import { useCurrentChain } from "../blockchain/useChainConfig";

export function useCookieJarFactoryAddress(options: { enabled?: boolean } = {}) {
  const chainId = useCurrentChain();
  const contracts = getNetworkContracts(chainId);
  const configuredFactoryAddress = contracts.cookieJarFactory;
  const moduleAddress = contracts.cookieJarModule;
  const factoryConfigured =
    !!configuredFactoryAddress && configuredFactoryAddress.toLowerCase() !== ZERO_ADDRESS;
  const moduleConfigured = !!moduleAddress && moduleAddress.toLowerCase() !== ZERO_ADDRESS;

  const query = useReadContract({
    address: moduleAddress as Address,
    abi: COOKIE_JAR_MODULE_ABI,
    functionName: "cookieJarFactory",
    query: {
      enabled: (options.enabled ?? true) && !factoryConfigured && moduleConfigured,
      staleTime: STALE_TIME_RARE,
    },
  });

  const factoryAddress = factoryConfigured
    ? (configuredFactoryAddress as Address)
    : typeof query.data === "string" && query.data.toLowerCase() !== ZERO_ADDRESS
      ? (query.data as Address)
      : undefined;

  return {
    factoryAddress,
    moduleConfigured: factoryConfigured || moduleConfigured,
    isLoading: !factoryConfigured && query.isLoading,
    error: query.error,
  };
}
