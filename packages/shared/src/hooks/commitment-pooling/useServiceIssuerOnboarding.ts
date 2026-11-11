import { useQuery } from "@tanstack/react-query";
import { commitmentPoolingKeys } from "../../config/query-keys/commitment-pooling";
import {
  issuerPoolListing,
  serviceIssuerChain,
} from "../../modules/commitment-pooling/service-issuer-chain";
import { logger } from "../../modules/app/logger";
import {
  issuerDigest,
  SERVICE_ISSUER_ROUTES,
} from "../../modules/commitment-pooling/service-issuer-metadata";
import type {
  ServiceIssuerPoolListing,
  ServiceIssuerRoute,
} from "../../modules/commitment-pooling/service-issuer-types";

export type ServiceIssuerListings = ReadonlyMap<string, ServiceIssuerPoolListing>;
export const serviceIssuerListingKey = (routeId: string, poolId: string, assetId: string) =>
  `${routeId}:${poolId}:${assetId}`;

/** Each pool owns its listing observation; one unavailable pool cannot hide another. */
export function useServiceIssuerListings(
  routes: readonly ServiceIssuerRoute[] = SERVICE_ISSUER_ROUTES
) {
  return useQuery({
    queryKey: commitmentPoolingKeys.issuerListings(
      routes.flatMap((route) =>
        route.pools.map(
          (pool) =>
            `${route.service.id}:${pool.id}:${pool.deployment.address}:${issuerDigest(pool.listings)}`
        )
      )
    ),
    enabled: routes.length > 0,
    retry: false,
    queryFn: async (): Promise<ServiceIssuerListings> =>
      new Map(
        (
          await Promise.all(
            routes.flatMap((route) =>
              route.pools.flatMap((pool) =>
                pool.listings.map(async (policy) => {
                  const asset = route.assets.find((candidate) => candidate.id === policy.assetId);
                  if (!asset) throw new Error("Pool listing refers to an unknown issuer token");
                  try {
                    return [
                      serviceIssuerListingKey(route.service.id, pool.id, asset.id),
                      await issuerPoolListing(serviceIssuerChain, pool, asset),
                    ] as const;
                  } catch (error) {
                    logger.warn("Issuer pool listing unavailable", {
                      poolId: pool.id,
                      assetId: asset.id,
                      error,
                    });
                    return null;
                  }
                })
              )
            )
          )
        ).filter((entry): entry is NonNullable<typeof entry> => entry !== null)
      ),
  });
}
