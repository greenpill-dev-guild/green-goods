import type { ServiceAccessSnapshot } from "./service-access-types";
import type { VoucherWalletSnapshot } from "./service-access-wallet-types";
import { SERVICE_ISSUER_ROUTES, issuerSame } from "./service-issuer-metadata";
import type { ServiceIssuerAsset, ServiceIssuerRoute } from "./service-issuer-types";

export interface ServiceIssuerExchangeChoice {
  key: string;
  routeId: string;
  poolId: string;
  poolName: string;
  input: ServiceIssuerAsset;
  output: ServiceIssuerAsset;
  held: bigint;
  requiredOutput: bigint;
}
/** Catalog candidates only. The selected pool's live quote/review owns admission and liquidity. */
export function serviceIssuerExchangeChoices(
  snapshot: ServiceAccessSnapshot | null,
  wallet: VoucherWalletSnapshot | undefined,
  routes: readonly ServiceIssuerRoute[] = SERVICE_ISSUER_ROUTES
): ServiceIssuerExchangeChoice[] {
  const desired = snapshot?.offer?.voucher;
  if (!snapshot || snapshot.evidence !== "onchain" || wallet?.evidence !== "onchain" || !desired)
    return [];
  const heldTarget =
    wallet.holdings.find(
      (holding) =>
        holding.issuer.asset.chainId === desired.asset.chainId &&
        issuerSame(holding.issuer.asset.token, desired.asset.token)
    )?.available ?? 0n;
  const requiredOutput = desired.units > heldTarget ? desired.units - heldTarget : 0n;
  if (requiredOutput === 0n) return [];
  return routes.flatMap((route) => {
    if (
      route.service.sourceChainId !== snapshot.key.sourceChainId ||
      !issuerSame(route.service.core.address, snapshot.key.coreModule)
    )
      return [];
    const output = route.assets.find(
      (asset) =>
        issuerSame(asset.token.address, desired.asset.token) &&
        issuerSame(asset.ownerReserve, desired.issuer)
    );
    if (!output) return [];
    return route.pools.flatMap((pool) => {
      if (!pool.listings.some((listing) => listing.assetId === output.id && !listing.delisting))
        return [];
      return route.assets.flatMap((input) => {
        if (
          input.id === output.id ||
          !pool.listings.some((listing) => listing.assetId === input.id && !listing.delisting)
        )
          return [];
        const held =
          wallet.holdings.find(
            (holding) =>
              holding.issuer.asset.chainId === pool.chainId &&
              issuerSame(holding.issuer.asset.token, input.token.address)
          )?.available ?? 0n;
        return held > 0n
          ? [
              {
                key: `${route.service.id}:${pool.id}:${input.id}:${output.id}`,
                routeId: route.service.id,
                poolId: pool.id,
                poolName: pool.name,
                input,
                output,
                held,
                requiredOutput,
              },
            ]
          : [];
      });
    });
  });
}
