import { GARDEN_ACCOUNT_ROLE_ABI } from "@green-goods/shared/utils";
import type { Address } from "@green-goods/shared/types";
import { createPublicClient, http, type Chain } from "viem";
import type { GardenJoinRequestChainReader } from "../api/routes/garden-join-request-auth";

export function createGardenJoinRequestChainReader(options: {
  chain: Chain;
  rpcUrl: string;
}): GardenJoinRequestChainReader {
  const client = createPublicClient({ chain: options.chain, transport: http(options.rpcUrl) });
  const read = (
    gardenAddress: Address,
    accountAddress: Address,
    functionName: "isGardener" | "isOperator" | "isOwner"
  ) =>
    client.readContract({
      address: gardenAddress,
      abi: GARDEN_ACCOUNT_ROLE_ABI,
      functionName,
      args: [accountAddress],
    });
  return {
    async isMember(gardenAddress, accountAddress) {
      const [gardener, operator, owner] = await Promise.all([
        read(gardenAddress, accountAddress, "isGardener"),
        read(gardenAddress, accountAddress, "isOperator"),
        read(gardenAddress, accountAddress, "isOwner"),
      ]);
      return gardener || operator || owner;
    },
    async canManage(gardenAddress, accountAddress) {
      const [operator, owner] = await Promise.all([
        read(gardenAddress, accountAddress, "isOperator"),
        read(gardenAddress, accountAddress, "isOwner"),
      ]);
      return operator || owner;
    },
  };
}
