import type { Address } from "@green-goods/shared/types";
import { GARDEN_ACCOUNT_ROLE_ABI } from "@green-goods/shared/utils/blockchain/abis/garden";
import {
  createPublicClient,
  fallback,
  http,
  HttpRequestError,
  TimeoutError,
  type Chain,
} from "viem";

export interface GardenJoinRequestChainReader {
  isMember(gardenAddress: Address, accountAddress: Address): Promise<boolean>;
  areMembers?(gardenAddress: Address, accountAddresses: readonly Address[]): Promise<boolean[]>;
  isSteward(gardenAddress: Address, accountAddress: Address): Promise<boolean>;
  areStewards?(gardenAddress: Address, accountAddresses: readonly Address[]): Promise<boolean[]>;
  canManage(gardenAddress: Address, accountAddress: Address): Promise<boolean>;
  isOpenJoining(gardenAddress: Address): Promise<boolean>;
}

export function createGardenJoinRequestChainReader(options: {
  chain: Chain;
  rpcUrl: string;
}): GardenJoinRequestChainReader {
  const primary = new URL(options.rpcUrl);
  const isLocal =
    primary.hostname === "localhost" ||
    primary.hostname === "[::1]" ||
    primary.hostname.startsWith("127.");
  const publicRpc = options.chain.rpcUrls.default.http[0];
  // These are public, read-only contract checks. A rate-limited provider must not
  // strand a request before persistence. Never mix local fork state with live state.
  const urls =
    !isLocal && publicRpc && new URL(publicRpc).href !== primary.href
      ? [options.rpcUrl, publicRpc]
      : [options.rpcUrl];
  const client = createPublicClient({
    chain: options.chain,
    transport: fallback(
      urls.map((url) => http(url, { timeout: 2_000, retryCount: 0 })),
      {
        retryCount: 0,
        // Contract reverts and RPC validation errors remain authoritative failures.
        shouldThrow: (error) =>
          !(error instanceof HttpRequestError || error instanceof TimeoutError),
      }
    ),
  });
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
  const isSteward = async (gardenAddress: Address, accountAddress: Address) => {
    const [operator, owner] = await Promise.all([
      read(gardenAddress, accountAddress, "isOperator"),
      read(gardenAddress, accountAddress, "isOwner"),
    ]);
    return operator || owner;
  };
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
    isSteward,
    async areStewards(gardenAddress, accountAddresses) {
      if (accountAddresses.length === 0) return [];
      const results = await client.multicall({
        allowFailure: false,
        contracts: accountAddresses.flatMap((accountAddress) => [
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
        (_, index) => Boolean(results[index * 2]) || Boolean(results[index * 2 + 1])
      );
    },
    canManage: isSteward,
    async isOpenJoining(gardenAddress) {
      return client.readContract({
        address: gardenAddress,
        abi: GARDEN_ACCOUNT_ROLE_ABI,
        functionName: "openJoining",
      });
    },
  };
}
