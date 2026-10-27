import { vi } from "vitest";
import { keccak256 } from "viem";
import type { GraphQLReader } from "../../modules/data/graphql-client";
import { SERVICE_LIVE_ROUTES } from "../../modules/commitment-pooling/service-access-live-config";
import type { ServiceLiveChain } from "../../modules/commitment-pooling/service-access-live-chain";

export function liveVoucherFixture(rows: unknown[] = []) {
  const route = structuredClone(SERVICE_LIVE_ROUTES[0]!);
  delete route.core.receipt.kind;
  const pins = [route.core, route.source, route.destination];
  for (const pin of [...pins, ...route.assets]) {
    pin.runtimeCodeHash = keccak256("0x6001");
    pin.implementation.runtimeCodeHash = keccak256("0x6002");
  }
  const implementations = [...pins, ...route.assets].map((pin) =>
    pin.implementation.address.toLowerCase()
  );
  const chain: ServiceLiveChain = {
    code: async (_chain, address) =>
      implementations.includes(address.toLowerCase()) ? "0x6002" : "0x6001",
    storage: async (_chain, address) => {
      const pin =
        pins.find((p) => p.address === address) ?? route.assets.find((p) => p.token === address)!;
      return `0x${"0".repeat(24)}${pin.implementation.address.slice(2)}`;
    },
    receipt: async (_chain, hash) => {
      const pin = pins.find((p) => p.receipt.transactionHash === hash)!;
      return {
        status: "success",
        transactionHash: hash,
        blockNumber: pin.receipt.blockNumber,
        blockHash: pin.receipt.blockHash,
        to: pin.address,
      };
    },
    transaction: async () => {
      throw new Error("Not an upgrade receipt");
    },
    balance: async () => 0n,
    read: async ({ chainId, address, functionName }) => {
      const endpoint = address === route.source.address ? route.source : route.destination;
      switch (functionName) {
        case "owner":
          return (
            pins.find((p) => p.address === address)?.owner ??
            route.assets.find((p) => p.token === address)!.issuer
          );
        case "serviceOfferProtocolVersion":
        case "voucherAcceptanceProtocolVersion":
          return 1;
        case "voucherServiceSetupModule":
          return route.source.address;
        case "commitmentPooling":
          return route.core.address;
        case "guardian":
          return endpoint.guardian;
        case "CCIP_ROUTER":
          return endpoint.router;
        case "LOCAL_CHAIN_ID":
          return BigInt(chainId);
        case "remoteChainId":
          return chainId === 42161 ? 100n : 42161n;
        case "remotePeer":
          return chainId === 42161 ? route.destination.address : route.source.address;
        case "remoteChainSelector":
          return endpoint.remoteSelector;
        case "symbol":
          return route.assets.find((p) => p.token === address)!.symbol;
        case "decimals":
          return route.assets.find((p) => p.token === address)!.decimals;
        case "assetAuthorizations":
          return [route.core.owner, true];
        case "have":
          return true;
        case "limitOf":
          return 20_000_000n;
        case "balanceOf":
          return address === route.assets[0]!.token ? 17n : 3n;
        default:
          throw new Error(`Unexpected read ${functionName}`);
      }
    },
  };
  const reader: GraphQLReader = {
    query: vi.fn().mockResolvedValue({ data: { VoucherServiceSetup: rows } }),
  };
  const wallet = {
    sourceChainId: 42161,
    account: "0x0000000000000000000000000000000000000200" as const,
    coreModule: route.core.address,
  };
  return { route, chain, reader, wallet };
}
