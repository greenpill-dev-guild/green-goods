/**
 * Protocol Member Status Hook
 *
 * Checks if an address is a protocol member (wears the protocol gardeners hat).
 * Protocol membership is required for claiming a personal *.greengoods.eth name.
 * Members are auto-minted the protocol hat when they join any garden.
 *
 * @module hooks/ens/useProtocolMemberStatus
 */

import { useQuery } from "@tanstack/react-query";
import { type Address, zeroAddress } from "viem";

import { DEFAULT_CHAIN_ID } from "../../config/blockchain";
import { queryKeys, STALE_TIME_RARE } from "../query-keys";
import {
  createClients,
  GreenGoodsENSABI,
  HatsABI,
  getNetworkContracts,
} from "../../utils/blockchain/contracts";

export function useProtocolMemberStatus(address: Address | undefined) {
  const contracts = getNetworkContracts(DEFAULT_CHAIN_ID);
  const ensAddress = contracts.greenGoodsENS as Address;

  return useQuery<boolean>({
    queryKey: queryKeys.ens.protocolMembership(address ?? ""),
    queryFn: async () => {
      if (!address || !ensAddress || ensAddress === zeroAddress) return false;

      const { publicClient } = createClients(DEFAULT_CHAIN_ID);

      // Read the Hats contract address and protocol hat ID from the ENS contract
      const [hatsAddress, protocolHatId] = await Promise.all([
        publicClient.readContract({
          address: ensAddress,
          abi: GreenGoodsENSABI,
          functionName: "HATS",
        }) as Promise<Address>,
        publicClient.readContract({
          address: ensAddress,
          abi: GreenGoodsENSABI,
          functionName: "protocolHatId",
        }) as Promise<bigint>,
      ]);

      if (!hatsAddress || hatsAddress === zeroAddress || protocolHatId === 0n) {
        return false;
      }

      // Check if the address wears the protocol hat
      return publicClient.readContract({
        address: hatsAddress,
        abi: HatsABI,
        functionName: "isWearerOfHat",
        args: [address, protocolHatId],
      }) as Promise<boolean>;
    },
    enabled: Boolean(address) && Boolean(ensAddress) && ensAddress !== zeroAddress,
    staleTime: STALE_TIME_RARE, // 5 min -- protocol membership changes infrequently
  });
}
