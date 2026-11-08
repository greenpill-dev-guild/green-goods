import deployment from "@green-goods/contracts/deployments/100-pilot-downstream.json";
import { SERVICE_LIVE_ROUTES } from "./service-access-live-config";
import type { Address } from "../../types/domain";

const receiver = deployment.contracts.find((item) => item.contract === "StewardSafeReceiver");
/** Award permissions follow the receipt-backed issuer registry, not a caller's chosen token. */
export const VOUCHER_AWARD_ISSUERS = SERVICE_LIVE_ROUTES.flatMap((route) =>
  route.assets.map((asset) => ({
    ...asset,
    chainId: 100 as const,
    guardReceiver:
      asset.issuer.toLowerCase() === deployment.techAndSunBootstrap.safe.toLowerCase() && receiver
        ? {
            address: receiver.address as Address,
            runtimeCodeHash: receiver.runtimeHash as `0x${string}`,
          }
        : null,
  }))
).filter(
  (asset, index, all) =>
    all.findIndex(
      (other) =>
        other.issuer.toLowerCase() === asset.issuer.toLowerCase() &&
        other.token.toLowerCase() === asset.token.toLowerCase()
    ) === index
);

export type VoucherAwardIssuer = (typeof VOUCHER_AWARD_ISSUERS)[number];
