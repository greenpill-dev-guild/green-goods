import type { Address } from "@green-goods/shared/types";
import { GARDEN_ACCOUNT_ROLE_ABI } from "@green-goods/shared/utils/blockchain/abis/garden";
import { createPublicClient, http, type Chain } from "viem";

export interface GardenJoinRequestChainReader {
  isMember(gardenAddress: Address, accountAddress: Address): Promise<boolean>;
  areMembers?(gardenAddress: Address, accountAddresses: readonly Address[]): Promise<boolean[]>;
  canManage(gardenAddress: Address, accountAddress: Address): Promise<boolean>;
  isOpenJoining(gardenAddress: Address): Promise<boolean>;
}

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
    async areMembers(gardenAddress, accountAddresses) {
      if (accountAddresses.length === 0) return [];
      const results = await client.multicall({
        allowFailure: false,
        contracts: accountAddresses.flatMap((accountAddress) => [
          {
            address: gardenAddress,
            abi: GARDEN_ACCOUNT_ROLE_ABI,
            functionName: "isGardener" as const,
            args: [accountAddress],
          },
          {
            address: gardenAddress,
            abi: GARDEN_ACCOUNT_ROLE_ABI,
            functionName: "isOperator" as const,
            args: [accountAddress],
          },
          {
            address: gardenAddress,
            abi: GARDEN_ACCOUNT_ROLE_ABI,
            functionName: "isOwner" as const,
            args: [accountAddress],
          },
        ]),
      });
      return accountAddresses.map(
        (_, index) =>
          Boolean(results[index * 3]) ||
          Boolean(results[index * 3 + 1]) ||
          Boolean(results[index * 3 + 2])
      );
    },
    async canManage(gardenAddress, accountAddress) {
      const [operator, owner] = await Promise.all([
        read(gardenAddress, accountAddress, "isOperator"),
        read(gardenAddress, accountAddress, "isOwner"),
      ]);
      return operator || owner;
    },
    async isOpenJoining(gardenAddress) {
      return client.readContract({
        address: gardenAddress,
        abi: GARDEN_ACCOUNT_ROLE_ABI,
        functionName: "openJoining",
      });
    },
  };
}
