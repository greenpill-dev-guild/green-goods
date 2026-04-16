/**
 * Green Goods Protocol ENS Name Hook
 *
 * Resolves an address to its Green Goods protocol subdomain on Arbitrum by reading
 * GreenGoodsENS.ownerToSlug. Returns the full *.greengoods.eth name when present.
 *
 * @module hooks/ens/useGreenGoodsEnsName
 */

import { useQuery } from "@tanstack/react-query";
import { type Address, isAddress, zeroAddress } from "viem";

import { DEFAULT_CHAIN_ID } from "../../config/blockchain";
import { queryKeys, STALE_TIME_RARE } from "../../config/query-keys";
import {
  createClients,
  GreenGoodsENSABI,
  getNetworkContracts,
} from "../../utils/blockchain/contracts";

export function useGreenGoodsEnsName(address?: Address | null) {
  const normalizedAddress =
    address && isAddress(address) ? (address.toLowerCase() as Address) : undefined;
  const contracts = getNetworkContracts(DEFAULT_CHAIN_ID);
  const ensAddress = contracts.greenGoodsENS as Address;

  return useQuery<string | null>({
    queryKey: queryKeys.ens.protocolName(normalizedAddress ?? ""),
    queryFn: async () => {
      if (!normalizedAddress || !ensAddress || ensAddress === zeroAddress) {
        return null;
      }

      const { publicClient } = createClients(DEFAULT_CHAIN_ID);
      const slug = (await publicClient.readContract({
        address: ensAddress,
        abi: GreenGoodsENSABI,
        functionName: "ownerToSlug",
        args: [normalizedAddress],
      })) as string;

      return slug ? `${slug}.greengoods.eth` : null;
    },
    enabled: Boolean(normalizedAddress && ensAddress && ensAddress !== zeroAddress),
    staleTime: STALE_TIME_RARE,
  });
}
