import type { Hex } from "viem";
import type { Address } from "../../types/domain";
import { greenGoodsIndexer, type GraphQLReader } from "../data/graphql-client";
import { SERVICE_LIVE_ROUTES, type ServiceLiveRoute } from "./service-access-live-config";
import {
  hydrateLiveVoucherSnapshot,
  serviceLiveChain,
  verifyServiceLiveRoute,
  type ServiceLiveChain,
} from "./service-access-live-chain";
import { createServiceAccessReadRepository } from "./service-access-read-repository";
import type { ServiceAccessKey, ServiceAccessSnapshot } from "./service-access-types";
import type { ServiceVoucherSetup } from "./service-access-voucher-types";
import type { VoucherIssuer } from "./voucher-console";

export interface Dependencies {
  routes?: readonly ServiceLiveRoute[];
  chain?: ServiceLiveChain;
  reader?: GraphQLReader;
  readSnapshot?: (key: ServiceAccessKey) => Promise<ServiceAccessSnapshot>;
}
export const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
export const issuerFor = (route: ServiceLiveRoute, setup: ServiceVoucherSetup): VoucherIssuer => {
  const asset = route.assets.find(
    (asset) =>
      same(asset.token, setup.authorization.token) && same(asset.issuer, setup.authorization.issuer)
  );
  if (!asset) throw new Error("Booking issuer is outside the reviewed route");
  return {
    name: asset.issuerName ?? asset.symbol,
    safe: asset.issuer,
    decimals: asset.decimals,
    chainId: 100,
    execution: "safe-file",
  };
};

export async function context(input: { chainId: number; garden: Address }, deps: Dependencies) {
  const route = (deps.routes ?? SERVICE_LIVE_ROUTES).find((r) => r.sourceChainId === input.chainId);
  if (!route) return null;
  const chain = deps.chain ?? serviceLiveChain;
  const reader = deps.reader ?? greenGoodsIndexer;
  await verifyServiceLiveRoute(route, chain);
  const read =
    deps.readSnapshot ??
    createServiceAccessReadRepository(reader, { read: chain.read }).getServiceAccess;
  const booking = async (commitmentId: bigint, buyer: Address, setupId?: Hex) => {
    const snapshot = await read({
      sourceChainId: route.sourceChainId,
      coreModule: route.core.address,
      commitmentId,
      buyer,
    });
    if (
      snapshot.evidence !== "onchain" ||
      snapshot.mode !== "voucher" ||
      snapshot.key.commitmentId !== commitmentId ||
      !same(snapshot.key.buyer, buyer) ||
      !same(snapshot.key.coreModule, route.core.address) ||
      snapshot.key.sourceChainId !== route.sourceChainId ||
      !snapshot.offer ||
      !same(snapshot.offer.providerGarden, input.garden) ||
      snapshot.capabilities.reasons.includes("authoritative-read-failed")
    )
      throw new Error("Canonical voucher offer unavailable");
    await hydrateLiveVoucherSnapshot(snapshot, route, chain);
    const setup = snapshot.voucherSetups.find(
      (row) => row.setupId === (setupId ?? snapshot.currentVoucherSetupId)
    );
    if (
      !setup ||
      !same(setup.authorization.providerGarden, input.garden) ||
      setup.authorization.commitmentId !== commitmentId ||
      !same(setup.authorization.buyer, buyer)
    )
      throw new Error("Canonical voucher setup unavailable");
    return { snapshot, setup };
  };
  return { route, chain, reader, booking };
}
