import { createPublicClient, http, keccak256, parseAbi, type PublicClient } from "viem";
import { gnosis } from "viem/chains";
import { SERVICE_ISSUER_DESK_POOLS } from "@green-goods/shared/modules/commitment-pooling/service-issuer-desk-protocol";
import { createVoucherAwardChain } from "./voucher-awards-chain";
import { serviceIssuerDeskContext, type ServiceIssuerDeskAuthority } from "./service-issuer-desk";

const OWNER = parseAbi([
  "function owner() view returns(address)",
  "function hasRole(uint64 roleId,address account) view returns(bool isMember,uint32 executionDelay)",
]);
const IMPLEMENTATION_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
export function createServiceIssuerDeskAuthority(input: {
  rpcUrl: string;
  client?: PublicClient;
  pools?: typeof SERVICE_ISSUER_DESK_POOLS;
}): ServiceIssuerDeskAuthority {
  const client =
    input.client ?? createPublicClient({ chain: gnosis, transport: http(input.rpcUrl) });
  const safeAuthority = createVoucherAwardChain({ rpcUrl: input.rpcUrl, client });
  const pools = input.pools ?? SERVICE_ISSUER_DESK_POOLS;
  return {
    context: serviceIssuerDeskContext,
    async canManage(selection, actor) {
      const pool = pools.find(
        (p) => p.routeId === selection.routeId && p.poolId === selection.poolId
      );
      if (!pool) return false;
      const pin = pool.deployment;
      const [owner, code, implementation, implementationCode] = await Promise.all([
        client.readContract({ address: pin.address, abi: OWNER, functionName: "owner" }),
        client.getCode({ address: pin.address }),
        client.getStorageAt({ address: pin.address, slot: IMPLEMENTATION_SLOT }),
        client.getCode({ address: pin.implementation.address }),
      ]);
      if (
        !code ||
        keccak256(code) !== pin.runtimeCodeHash ||
        implementation?.toLowerCase() !==
          `0x${pin.implementation.address.slice(2).toLowerCase().padStart(64, "0")}` ||
        !implementationCode ||
        keccak256(implementationCode) !== pin.implementation.runtimeCodeHash
      )
        return false;
      if (owner.toLowerCase() !== pin.owner.toLowerCase()) {
        if (!pin.accessManager || owner.toLowerCase() !== pin.accessManager.toLowerCase())
          return false;
        const [isAdmin] = await client.readContract({
          address: pin.accessManager,
          abi: OWNER,
          functionName: "hasRole",
          args: [0n, pin.owner],
        });
        // This desk prepares terms only. The manager's governance execution delay is unchanged.
        if (!isAdmin) return false;
      }
      // A configured manager administers the pool; the named Safe still authorizes its stewards.
      return safeAuthority.canPrepare(pin.owner, actor);
    },
  };
}
