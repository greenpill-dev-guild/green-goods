import { useReadContract } from "wagmi";
import { ActionRegistryABI, getNetworkContracts } from "../../utils/blockchain/contracts";
import { useCurrentChain } from "../blockchain/useChainConfig";

/**
 * Reads the gardenDomains(address) bitmask from ActionRegistry.
 *
 * Returns the raw uint8 domain bitmask for a garden address.
 * Bit mapping: 0=Solar, 1=Agro, 2=Edu, 3=Waste.
 *
 * @param gardenAddress - Garden contract address to look up
 * @returns wagmi useReadContract result with data as number | undefined
 */
export function useGardenDomains(gardenAddress: string | undefined) {
  const chainId = useCurrentChain();
  const contracts = getNetworkContracts(chainId);

  return useReadContract({
    address: contracts.actionRegistry as `0x${string}`,
    abi: ActionRegistryABI,
    functionName: "gardenDomains",
    args: gardenAddress ? [gardenAddress as `0x${string}`] : undefined,
    query: { enabled: Boolean(gardenAddress) },
  });
}
