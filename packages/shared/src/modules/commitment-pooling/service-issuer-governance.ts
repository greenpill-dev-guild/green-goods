import EntitlementABI from "@green-goods/contracts/abis/VoucherEntitlementModule.json";
import { type Abi, parseAbi } from "viem";
import type { Address } from "../../types/domain";
import type { ContractCall } from "../transactions/types";
import { issuerAsset } from "./service-issuer-metadata";
import type { ServiceIssuerRoute } from "./service-issuer-types";

const ADMISSION = parseAbi([
  "function register(address)",
  "function setLimitFor(address,address,uint256)",
  "function setPriceIndexValue(address,uint256)",
]);
interface ServiceIssuerGovernanceDraft {
  kind: "owner-safe-draft";
  purpose: "source-authority" | "pool-registration" | "pool-cap" | "pool-price" | "pool-delist";
  owner: Address;
  /** Always on a named chain: the same owner address can be a different Safe on each chain. */
  call: ContractCall & { chainId: number };
}
const limitDraft = (
  route: ServiceIssuerRoute,
  token: Address,
  limit: bigint | null,
  purpose: "pool-cap" | "pool-delist"
): ServiceIssuerGovernanceDraft => ({
  kind: "owner-safe-draft",
  purpose,
  owner: route.pool.limiter.owner,
  call: {
    address: route.pool.limiter.address,
    account: route.pool.limiter.owner,
    chainId: 100,
    functionName: "setLimitFor",
    args: [token, route.pool.deployment.address, limit],
    abi: ADMISSION,
    value: 0n,
  },
});

/**
 * Delisting is a zero pool holding limit: the pool takes in no more of the token, while every
 * balance, the pool's own holding, each booking's escrow, the issuer's registration and the
 * member's reserve stay exactly as they are. Like the other drafts it is the owner Safe's call.
 */
export function serviceIssuerDelistingDraft(
  route: ServiceIssuerRoute,
  assetId: string
): ServiceIssuerGovernanceDraft {
  return limitDraft(route, issuerAsset(route, assetId, true).token.address, 0n, "pool-delist");
}
/** Preparation only. Steward assistance confers no authority; normal owner Safe review remains required. */
export function serviceIssuerGovernanceDrafts(
  route: ServiceIssuerRoute,
  assetId: string
): ServiceIssuerGovernanceDraft[] {
  const asset = issuerAsset(route, assetId);
  const draft = (
    purpose: ServiceIssuerGovernanceDraft["purpose"],
    owner: Address,
    address: Address,
    chainId: number,
    functionName: string,
    args: readonly unknown[],
    abi: Abi = ADMISSION
  ): ServiceIssuerGovernanceDraft => ({
    kind: "owner-safe-draft",
    purpose,
    owner,
    call: { address, account: owner, chainId, functionName, args, abi, value: 0n },
  });
  return [
    draft(
      "source-authority",
      route.adapterSource.owner,
      route.adapterSource.address,
      42161,
      "setIssuerAuthority",
      [asset.ownerReserve, asset.token.address, asset.sourceAuthority],
      EntitlementABI as Abi
    ),
    draft(
      "pool-registration",
      route.pool.registry.owner,
      route.pool.registry.address,
      100,
      "register",
      [asset.token.address]
    ),
    limitDraft(route, asset.token.address, asset.poolHoldingCap, "pool-cap"),
    draft(
      "pool-price",
      route.pool.quoter.owner,
      route.pool.quoter.address,
      100,
      "setPriceIndexValue",
      [asset.token.address, asset.priceIndex]
    ),
  ];
}
