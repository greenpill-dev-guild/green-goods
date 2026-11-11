import type { Address } from "../../types/domain";
import { logger } from "../app/logger";
import { verifyServiceDeploymentState, type ServiceLiveChain } from "./service-access-live-route";
import type { VoucherIssuerExchange, VoucherIssuerStanding } from "./service-access-wallet-types";
import { issuerPoolListing } from "./service-issuer-chain";
import { issuerPoolStatus } from "./service-issuer-pool";
import type { ServiceIssuerRoute } from "./service-issuer-types";

/** Pool observations inform availability; full exchange review rechecks every dependency before signing. */
export async function readVoucherExchangeListings(
  routes: readonly ServiceIssuerRoute[],
  token: Address,
  chain: ServiceLiveChain
): Promise<VoucherIssuerExchange[]> {
  const listings = new Map<string, Promise<VoucherIssuerExchange>>();
  for (const route of routes) {
    const asset = route.assets.find(
      (entry) => entry.token.address.toLowerCase() === token.toLowerCase()
    );
    if (!asset) continue;
    for (const pool of route.pools) {
      if (!pool.listings.some((policy) => policy.assetId === asset.id)) continue;
      const key = `${pool.chainId}:${pool.deployment.address.toLowerCase()}`;
      if (listings.has(key)) continue;
      const base = {
        poolId: pool.id,
        poolAddress: pool.deployment.address,
        name: pool.name,
        garden: pool.garden,
      };
      listings.set(
        key,
        (async () => {
          try {
            await Promise.all(
              [pool.deployment, pool.registry, pool.limiter].map((pin) =>
                verifyServiceDeploymentState(pin, pool.chainId, chain)
              )
            );
            const observed = await issuerPoolListing(chain, pool, asset);
            return {
              ...base,
              status: issuerPoolStatus(observed),
              limit: observed.limit,
              holding: observed.holding,
            };
          } catch (error) {
            logger.warn("Voucher exchange listing unavailable", { poolId: pool.id, token, error });
            return { ...base, status: "unavailable" as const, limit: null, holding: null };
          }
        })()
      );
    }
  }
  return Promise.all(listings.values());
}

export function voucherExchangeStanding(
  listings: readonly VoucherIssuerExchange[]
): VoucherIssuerStanding["exchange"] {
  if (listings.some((listing) => listing.status === "listed")) return "listed";
  if (!listings.length || listings.some((listing) => listing.status === "unavailable"))
    return "unavailable";
  return listings.every((listing) => listing.status === "delisted") ? "delisted" : "setup";
}
