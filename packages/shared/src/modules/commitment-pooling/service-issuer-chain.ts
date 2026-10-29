import EscrowABI from "@green-goods/contracts/abis/GnosisVoucherEscrow.json";
import EntitlementABI from "@green-goods/contracts/abis/VoucherEntitlementModule.json";
import { getPublicClient } from "@wagmi/core";
import { type Abi, encodeFunctionData, keccak256, parseAbi } from "viem";
import { getWagmiConfig } from "../../config/appkit";
import type { Address } from "../../types/domain";
import { serviceAddress, serviceFlag, serviceUint } from "./service-access-chain-values";
import { serviceLiveChain } from "./service-access-live-chain";
import {
  type ServiceLiveChain,
  verifyServiceDeployment,
  verifyServiceLiveRoute,
} from "./service-access-live-route";
import { AdapterABI, PoolABI, TokenABI } from "./service-issuer-abis";
import { verifyIssuerProxyDeployment } from "./service-issuer-deployment";
import { issuerSame } from "./service-issuer-metadata";
import type {
  ServiceIssuerAsset,
  ServiceIssuerCodePin,
  ServiceIssuerPoolListing,
  ServiceIssuerRoute,
} from "./service-issuer-types";

export { AdapterABI, EscrowABI, PoolABI, TokenABI };

// Published CLC ce090fd ABI getters, also owned by contracts/script/utils/clc-release.ts.
const ISSUER_READ_ABI = parseAbi([
  "function totalMinted() view returns(uint256)",
  "function expired() view returns(bool)",
  "function adminOf(address) view returns(address)",
  "function getMinDelay() view returns(uint256)",
  "function owner() view returns(address)",
  "function paused() view returns(bool)",
  "function feePolicy() view returns(address)",
  "function feeAddress() view returns(address)",
  "function tokenRegistry() view returns(address)",
  "function tokenLimiter() view returns(address)",
  "function quoter() view returns(address)",
  "function protocolFeeController() view returns(address)",
  "function feesDecoupled() view returns(bool)",
  "function fees(address) view returns(uint256)",
  "function getQuote(address,address,uint256) view returns(uint256)",
  "function have(address) view returns(bool)",
  "function limitOf(address,address) view returns(uint256)",
  "function valueFor(address,address,uint256) view returns(uint256)",
  "function getFee(address,address) view returns(uint256)",
  "function getProtocolFee() view returns(uint256)",
  "function getProtocolFeeRecipient() view returns(address)",
  "function isActive() view returns(bool)",
]);
export interface ServiceIssuerChain extends ServiceLiveChain {
  timestamp(): Promise<bigint>;
}
export const serviceIssuerChain: ServiceIssuerChain = {
  ...serviceLiveChain,
  timestamp: async () => {
    const client = getPublicClient(getWagmiConfig(), { chainId: 100 });
    if (client?.chain?.id !== 100) throw new Error("Gnosis reader unavailable");
    return (await client.getBlock()).timestamp;
  },
};
export const issuerRead = (
  chain: ServiceIssuerChain,
  account: Address,
  functionName: string,
  args: readonly unknown[] = [],
  abi: Abi = ISSUER_READ_ABI
) => chain.read({ chainId: 100, address: account, abi, functionName, args });
async function codePin(chain: ServiceIssuerChain, pin: ServiceIssuerCodePin) {
  const code = await chain.code(100, pin.address);
  if (code === "0x" || !issuerSame(keccak256(code), pin.runtimeCodeHash))
    throw new Error("Issuer dependency runtime changed");
}
const ISSUER_PEER_FIELDS = [
  "guardian",
  "CCIP_ROUTER",
  "LOCAL_CHAIN_ID",
  "remoteChainId",
  "remotePeer",
  "remoteChainSelector",
];

/** Consent and issuer operations share the reviewed reward route on both chains. */
export async function verifyIssuerRewardRoute(
  route: Pick<ServiceIssuerRoute, "adapterSource" | "adapter">,
  chain: ServiceLiveChain
) {
  await Promise.all([
    verifyServiceDeployment(route.adapterSource, 42161, chain),
    verifyServiceDeployment(route.adapter, 100, chain),
  ]);
  const source = await Promise.all(
    ISSUER_PEER_FIELDS.map((functionName) =>
      chain.read({
        chainId: 42161,
        address: route.adapterSource.address,
        abi: EntitlementABI as Abi,
        functionName,
      })
    )
  );
  if (
    issuerSame(route.adapterSource.owner, route.adapterSource.guardian) ||
    !issuerSame(serviceAddress(source[0]), route.adapterSource.guardian) ||
    !issuerSame(serviceAddress(source[1]), route.adapterSource.router) ||
    serviceUint(source[2]) !== 42161n ||
    serviceUint(source[3]) !== 100n ||
    !issuerSame(serviceAddress(source[4]), route.adapter.address) ||
    serviceUint(source[5]) !== route.adapterSource.remoteSelector
  )
    throw new Error("Issuer source peer or recovery authority changed");
  const adapter = await Promise.all(
    ISSUER_PEER_FIELDS.map((functionName) =>
      chain.read({ chainId: 100, address: route.adapter.address, abi: AdapterABI, functionName })
    )
  );
  if (
    issuerSame(route.adapter.owner, route.adapter.guardian) ||
    !issuerSame(serviceAddress(adapter[0]), route.adapter.guardian) ||
    !issuerSame(serviceAddress(adapter[1]), route.adapter.router) ||
    serviceUint(adapter[2]) !== 100n ||
    serviceUint(adapter[3]) !== 42161n ||
    !issuerSame(serviceAddress(adapter[4]), route.adapter.sourcePeer) ||
    serviceUint(adapter[5]) !== route.adapter.sourceSelector
  )
    throw new Error("Issuer adapter peer or recovery authority changed");
  if (!issuerSame(route.adapter.sourcePeer, route.adapterSource.address))
    throw new Error("Issuer source peer pin missing");
}
export async function verifyIssuerRoute(
  route: ServiceIssuerRoute,
  asset: ServiceIssuerAsset,
  chain: ServiceIssuerChain
) {
  await verifyServiceLiveRoute(route.service, chain);
  await Promise.all([
    codePin(chain, route.factory),
    verifyIssuerRewardRoute(route, chain),
    ...[
      asset.token,
      route.pool.deployment,
      route.pool.registry,
      route.pool.limiter,
      route.pool.quoter,
      route.pool.feePolicy,
      route.pool.protocolFee,
    ].map((pin) => verifyIssuerProxyDeployment(pin, route.factory, chain)),
  ]);
  if (
    !issuerSame(
      asset.token.factoryDeployment.initializer,
      encodeFunctionData({
        abi: TokenABI,
        functionName: "initialize",
        args: [asset.name, asset.symbol, asset.decimals, asset.ownerReserve as `0x${string}`, 0n],
      })
    )
  )
    throw new Error("Reviewed member token initializer changed");
  const control = asset.upgradeControl!;
  const admin = serviceAddress(
    await issuerRead(chain, route.factory.address, "adminOf", [asset.token.address])
  );
  if (!issuerSame(admin, control.admin)) throw new Error("Issuer proxy control changed");
  const pool = route.pool;
  for (const pin of [
    pool.deployment,
    pool.registry,
    pool.limiter,
    pool.quoter,
    pool.feePolicy,
    pool.protocolFee,
  ]) {
    if (
      !issuerSame(
        serviceAddress(await issuerRead(chain, route.factory.address, "adminOf", [pin.address])),
        pool.proxyAdmin
      )
    )
      throw new Error("Reviewed pool proxy control changed");
  }
  const expected = {
    feePolicy: pool.feePolicy.address,
    feeAddress: pool.feeAddress,
    tokenRegistry: pool.registry.address,
    tokenLimiter: pool.limiter.address,
    quoter: pool.quoter.address,
    protocolFeeController: pool.protocolFee.address,
  };
  for (const [name, account] of Object.entries(expected)) {
    if (
      !issuerSame(serviceAddress(await issuerRead(chain, pool.deployment.address, name)), account)
    )
      throw new Error("Curated pool dependency changed");
  }
  if (!serviceFlag(await issuerRead(chain, pool.deployment.address, "feesDecoupled")))
    throw new Error("Curated pool fee mode changed");
  const [name, symbol, decimals] = await Promise.all(
    ["name", "symbol", "decimals"].map((fn) =>
      issuerRead(chain, asset.token.address, fn, [], TokenABI as Abi)
    )
  );
  if (name !== asset.name || symbol !== asset.symbol || decimals !== asset.decimals)
    throw new Error("Issuer token metadata changed");
}
export async function issuerAssetState(
  chain: ServiceIssuerChain,
  route: ServiceIssuerRoute,
  asset: ServiceIssuerAsset,
  actor: Address
) {
  const token = (fn: string, args: readonly unknown[] = []) =>
    issuerRead(chain, asset.token.address, fn, args, TokenABI as Abi);
  const [
    minted,
    expired,
    balance,
    reserveAllowance,
    poolAllowance,
    authorization,
    adapterPaused,
    escrowPaused,
    sourceAuthority,
  ] = await Promise.all([
    issuerRead(chain, asset.token.address, "totalMinted"),
    issuerRead(chain, asset.token.address, "expired"),
    token("balanceOf", [actor]),
    token("allowance", [actor, route.adapter.address]),
    token("allowance", [actor, route.pool.deployment.address]),
    issuerRead(
      chain,
      route.adapter.address,
      "assetAuthorizations",
      [asset.ownerReserve, asset.token.address],
      AdapterABI as Abi
    ),
    issuerRead(chain, route.adapter.address, "paused", [], AdapterABI as Abi),
    issuerRead(chain, route.service.destination.address, "paused", [], EscrowABI as Abi),
    chain.read({
      chainId: 42161,
      address: route.adapterSource.address,
      abi: EntitlementABI as Abi,
      functionName: "issuerAuthority",
      args: [asset.ownerReserve, asset.token.address],
    }),
  ]);
  return {
    minted: serviceUint(minted),
    expired: serviceFlag(expired),
    balance: serviceUint(balance),
    reserveAllowance: serviceUint(reserveAllowance),
    poolAllowance: serviceUint(poolAllowance),
    authorization,
    adapterPaused: serviceFlag(adapterPaused),
    escrowPaused: serviceFlag(escrowPaused),
    sourceAuthority: serviceAddress(sourceAuthority),
  };
}
/**
 * The token's place in the shared pool: admitted by the registry, the limiter's holding limit
 * (zero before its cap lands, and once delisted) and what the pool holds now. Read apart from any
 * review's state, so a trade in the pool never invalidates the member's own review.
 */
export async function issuerPoolListing(
  chain: ServiceIssuerChain,
  route: ServiceIssuerRoute,
  asset: ServiceIssuerAsset
): Promise<ServiceIssuerPoolListing> {
  const pool = route.pool.deployment.address;
  const [admitted, limit, holding] = await Promise.all([
    issuerRead(chain, route.pool.registry.address, "have", [asset.token.address]),
    issuerRead(chain, route.pool.limiter.address, "limitOf", [asset.token.address, pool]),
    issuerRead(chain, asset.token.address, "balanceOf", [pool], TokenABI as Abi),
  ]);
  return {
    admitted: serviceFlag(admitted),
    limit: serviceUint(limit),
    holding: serviceUint(holding),
  };
}
export async function issuerPoolState(
  chain: ServiceIssuerChain,
  route: ServiceIssuerRoute,
  input: ServiceIssuerAsset,
  output: ServiceIssuerAsset,
  amount: bigint
) {
  const pool = route.pool.deployment.address;
  await verifyIssuerRoute(route, output, chain);
  const listed = await Promise.all(
    [input, output].map((asset) =>
      issuerRead(chain, route.pool.registry.address, "have", [asset.token.address])
    )
  );
  if (listed.some((v) => !serviceFlag(v))) throw new Error("Pool asset admission unavailable");
  const [
    cap,
    quote,
    grossQuote,
    inventory,
    poolInput,
    fee,
    protocolFee,
    feeRecipient,
    protocolActive,
    outputFees,
    outputExpired,
  ] = await Promise.all([
    issuerRead(chain, route.pool.limiter.address, "limitOf", [input.token.address, pool]),
    issuerRead(
      chain,
      pool,
      "getAmountOut",
      [output.token.address, input.token.address, amount],
      PoolABI as Abi
    ),
    issuerRead(chain, pool, "getQuote", [output.token.address, input.token.address, amount]),
    issuerRead(chain, output.token.address, "balanceOf", [pool], TokenABI as Abi),
    issuerRead(chain, input.token.address, "balanceOf", [pool], TokenABI as Abi),
    issuerRead(chain, route.pool.feePolicy.address, "getFee", [
      input.token.address,
      output.token.address,
    ]),
    issuerRead(chain, route.pool.protocolFee.address, "getProtocolFee"),
    issuerRead(chain, route.pool.protocolFee.address, "getProtocolFeeRecipient"),
    issuerRead(chain, route.pool.protocolFee.address, "isActive"),
    issuerRead(chain, pool, "fees", [output.token.address]),
    issuerRead(chain, output.token.address, "expired"),
  ]);
  if (serviceUint(cap) !== input.poolHoldingCap)
    throw new Error("Reviewed pool holding cap changed");
  if (serviceUint(outputFees) > serviceUint(inventory))
    throw new Error("Curated output fee reserve exceeds its balance");
  return {
    quote: serviceUint(quote),
    grossQuote: serviceUint(grossQuote),
    inventory: serviceUint(inventory),
    poolInput: serviceUint(poolInput),
    cap: serviceUint(cap),
    fee: serviceUint(fee),
    protocolFee: serviceUint(protocolFee),
    feeRecipient: serviceAddress(feeRecipient),
    protocolActive: serviceFlag(protocolActive),
    outputFees: serviceUint(outputFees),
    availableOutput: serviceUint(inventory) - serviceUint(outputFees),
    outputExpired: serviceFlag(outputExpired),
  };
}
