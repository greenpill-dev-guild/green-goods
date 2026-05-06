/**
 * Green Goods Protocol ENS Name Hook
 *
 * Resolves an address to its Green Goods protocol subdomain. L2 ownerToSlug is
 * the fast path, with an L1 receiver fallback for authoritative receiver-only
 * records. Returns the full *.greengoods.eth name when present.
 *
 * @module hooks/ens/useGreenGoodsEnsName
 */

import { useQuery } from "@tanstack/react-query";
import { type Address, isAddress, zeroAddress } from "viem";

import { DEFAULT_CHAIN_ID } from "../../config/blockchain";
import { queryKeys, STALE_TIME_RARE } from "../../config/query-keys";
import { logger } from "../../modules/app/logger";
import {
  createClients,
  GreenGoodsENSABI,
  getNetworkContracts,
} from "../../utils/blockchain/contracts";
import {
  createENSL1Client,
  ENS_RECEIVER_OWNER_TO_SLUG_ABI,
  getENSL1ChainId,
  readENSL1ReceiverAddress,
} from "./availability";

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

      if (slug) return `${slug}.greengoods.eth`;

      const l1ChainId = getENSL1ChainId(DEFAULT_CHAIN_ID);
      if (!l1ChainId) return null;

      try {
        const l1ReceiverAddress = await readENSL1ReceiverAddress({ ensAddress, publicClient });
        if (!l1ReceiverAddress) return null;

        const l1Client =
          l1ChainId === DEFAULT_CHAIN_ID ? publicClient : createENSL1Client(l1ChainId);
        const l1Slug = (await l1Client.readContract({
          address: l1ReceiverAddress,
          abi: ENS_RECEIVER_OWNER_TO_SLUG_ABI,
          functionName: "ownerToSlug",
          args: [normalizedAddress],
        })) as string;

        return l1Slug ? `${l1Slug}.greengoods.eth` : null;
      } catch (error) {
        logger.warn("L1 Green Goods ENS name lookup failed", {
          error,
          address: normalizedAddress,
          chainId: DEFAULT_CHAIN_ID,
        });
        return null;
      }
    },
    enabled: Boolean(normalizedAddress && ensAddress && ensAddress !== zeroAddress),
    staleTime: STALE_TIME_RARE,
  });
}
