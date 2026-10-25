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
  purpose: "source-authority" | "pool-registration" | "pool-cap" | "pool-price";
  owner: Address;
  call: ContractCall;
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
    draft("pool-cap", route.pool.limiter.owner, route.pool.limiter.address, 100, "setLimitFor", [
      asset.token.address,
      route.pool.deployment.address,
      asset.poolHoldingCap,
    ]),
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
