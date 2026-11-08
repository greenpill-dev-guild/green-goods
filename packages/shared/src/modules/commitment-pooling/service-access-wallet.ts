import { erc20Abi, parseAbi } from "viem";
import type { Address } from "../../types/domain";
import { logger } from "../app/logger";
import { serviceFlag, serviceTuple, serviceUint } from "./service-access-chain-values";
import type { PilotRewardItem } from "./service-access-pilot-types";
import type { ServiceAccessSnapshot } from "./service-access-types";
import type { ServiceVoucherSetup } from "./service-access-voucher-types";
import { greenGoodsIndexer, type GraphQLReader } from "../data/graphql-client";
import { discoverWalletVoucherSetups } from "./data-voucher-service";
import {
  readVoucherExchangeListings,
  voucherExchangeStanding,
} from "./service-issuer-wallet-pools";
import { verifyServiceDeploymentState } from "./service-access-live-route";
import { SERVICE_ISSUER_ROUTES } from "./service-issuer-metadata";
import type { ServiceIssuerRoute } from "./service-issuer-types";
import { SERVICE_LIVE_ROUTES, type ServiceLiveRoute } from "./service-access-live-config";
import {
  serviceLiveChain,
  hydrateLiveVoucherSnapshot,
  verifyServiceLiveRoute,
  type ServiceLiveChain,
} from "./service-access-live-chain";
import { createServiceAccessReadRepository } from "./service-access-read-repository";
import type {
  RequestRewardDelivery,
  VoucherBookingEscrow,
  VoucherBookingRef,
  VoucherHolding,
  VoucherIssuer,
  VoucherPendingReturn,
  VoucherWalletScope,
  VoucherWalletSnapshot,
  VoucherWalletUnavailableReason,
} from "./service-access-wallet-types";

function voucherBookingRef(setup: ServiceVoucherSetup): VoucherBookingRef {
  const a = setup.authorization;
  return {
    sourceChainId: a.sourceChainId,
    coreModule: a.coreModule,
    commitmentId: a.commitmentId,
    garden: a.providerGarden,
    setupId: setup.setupId,
  };
}

/** The destination result wins; a cancellation decided at the source shows before it arrives. */
function canceling(setup: ServiceVoucherSetup): boolean {
  return setup.source.decision === "abort" || setup.destination?.result.decision === "abort";
}

export function voucherBookingEscrow(setup: ServiceVoucherSetup): VoucherBookingEscrow {
  const base = {
    booking: voucherBookingRef(setup),
    issuer: setup.authorization.issuer,
    asset: setup.asset,
    agreed: setup.authorization.voucherUnits,
  };
  const d = setup.destination;
  if (!d) return { ...base, held: 0n, stage: canceling(setup) ? "closed" : "awaiting-approval" };
  const deposited = d.result.depositedUnits - d.result.setupRefundedUnits;
  if (d.result.phase === "aborted" || (deposited === 0n && canceling(setup)))
    return { ...base, held: 0n, stage: "closed" };
  if (d.result.phase === "none" || d.result.phase === "authorized")
    return {
      ...base,
      held: 0n,
      stage: d.result.issuerApproved ? "awaiting-deposit" : "awaiting-approval",
    };
  if (d.result.phase === "abort-refund-pending" || canceling(setup))
    return { ...base, held: deposited, stage: "returning" };
  const final = d.finalAllocation;
  if (!final) return { ...base, held: deposited, stage: "held" };
  const arrived =
    (final.release.state === "succeeded" ? final.allocation.releaseVoucherUnits : 0n) +
    (final.refund.state === "succeeded" ? final.allocation.refundVoucherUnits : 0n);
  return {
    ...base,
    held: deposited - arrived,
    stage: final.financiallyClosed ? "closed" : "settling",
  };
}

/** A return is pending until its transfer arrives; nothing is shown as back before then. */
export function voucherPendingReturn(setup: ServiceVoucherSetup): VoucherPendingReturn | null {
  const d = setup.destination;
  if (!d) return null;
  const base = {
    booking: voucherBookingRef(setup),
    issuer: setup.authorization.issuer,
    asset: setup.asset,
  };
  const final = d.finalAllocation;
  if (final) {
    const { state, attempts } = final.refund;
    return final.allocation.refundVoucherUnits > 0n && (state === "pending" || state === "failed")
      ? { ...base, amount: final.allocation.refundVoucherUnits, cause: "split", state, attempts }
      : null;
  }
  const deposited = d.result.depositedUnits - d.result.setupRefundedUnits;
  if (deposited === 0n || d.result.phase === "aborted" || !canceling(setup)) return null;
  return {
    ...base,
    amount: deposited,
    cause: "cancellation",
    state:
      d.result.phase === "abort-refund-pending" && !d.result.actionSucceeded ? "failed" : "pending",
    attempts: null,
  };
}

/** Holdings, escrow and returns for one account from the setups its bookings own. */
export function voucherWalletFromSetups(input: {
  scope: VoucherWalletScope;
  evidence: "onchain" | "local-rehearsal";
  complete: boolean;
  issuers: readonly VoucherIssuer[];
  balances: readonly { token: VoucherIssuer["asset"]["token"]; amount: bigint }[];
  setups: readonly ServiceVoucherSetup[];
}): VoucherWalletSnapshot {
  const holder = input.scope.account.toLowerCase();
  const own = input.setups.filter((setup) => setup.authorization.holder.toLowerCase() === holder);
  const unique = new Map<string, VoucherIssuer>();
  for (const issuer of input.issuers) {
    const key = `${issuer.asset.chainId}:${issuer.asset.token.toLowerCase()}`;
    const existing = unique.get(key);
    if (existing && existing.account.toLowerCase() !== issuer.account.toLowerCase())
      throw new Error("Conflicting voucher issuer identity");
    if (!existing) unique.set(key, issuer);
  }
  const issuers = [...unique.values()];
  const holdings: VoucherHolding[] = issuers.map((issuer) => ({
    issuer,
    available:
      input.balances.find(
        (balance) => balance.token.toLowerCase() === issuer.asset.token.toLowerCase()
      )?.amount ?? 0n,
  }));
  return {
    account: input.scope.account,
    evidence: input.evidence,
    complete: input.complete,
    reason: null,
    issuers,
    holdings,
    bookings: own.map(voucherBookingEscrow).filter((escrow) => escrow.stage !== "closed"),
    returns: own.flatMap((setup) => voucherPendingReturn(setup) ?? []),
  };
}

function unavailableVoucherWallet(
  scope: VoucherWalletScope,
  reason: VoucherWalletUnavailableReason
): VoucherWalletSnapshot {
  return {
    account: scope.account,
    evidence: "unavailable",
    complete: false,
    reason,
    issuers: [],
    holdings: [],
    bookings: [],
    returns: [],
  };
}

/**
 * Whose vouchers a service read concerns: the holder a booking froze when it was prepared, else
 * the Gnosis account the reader holds vouchers in, else the source buyer, as agreeing names it. A
 * wallet's escrow and returns are its holder's, so the buyer's own wallet can miss them.
 */
export function serviceVoucherHolder(
  snapshot: Pick<
    ServiceAccessSnapshot,
    "key" | "capabilities" | "voucherSetups" | "currentVoucherSetupId"
  >
): Address {
  const booking = snapshot.voucherSetups.find(
    (setup) => setup.setupId === snapshot.currentVoucherSetupId
  );
  return booking?.authorization.holder ?? snapshot.capabilities.gnosisHolder ?? snapshot.key.buyer;
}

type VoucherWalletRouteScope = Pick<VoucherWalletScope, "sourceChainId" | "coreModule">;

/** The reviewed route that serves a wallet scope's chain and core module, if the build has one. */
function voucherWalletRoutes(
  scope: VoucherWalletRouteScope,
  routes: readonly ServiceLiveRoute[]
): ServiceLiveRoute[] {
  return routes.filter(
    (r) =>
      r.sourceChainId === scope.sourceChainId &&
      r.core.address.toLowerCase() === scope.coreModule.toLowerCase()
  );
}

/**
 * Whether this build reads vouchers for a chain and core module: a reviewed route with its wallet
 * state, the rule `readLiveVoucherWallet` checks first. It is the one answer of a wallet read that
 * needs no read, so a surface can list the wallet's Vouchers tab at once and let the read fill it.
 */
export function hasVoucherWalletRoute(scope: VoucherWalletRouteScope): boolean {
  return Boolean(voucherWalletRoutes(scope, SERVICE_LIVE_ROUTES)[0]?.walletState);
}

/** Index discovery never replaces canonical balances, authorization or escrow results. */
export async function readLiveVoucherWallet(
  scope: VoucherWalletScope,
  dependencies: {
    routes?: readonly ServiceLiveRoute[];
    issuerRoutes?: readonly ServiceIssuerRoute[];
    chain?: ServiceLiveChain;
    reader?: GraphQLReader;
    readSnapshot?: (key: ServiceAccessSnapshot["key"]) => Promise<ServiceAccessSnapshot>;
  } = {}
): Promise<VoucherWalletSnapshot> {
  try {
    const routes = voucherWalletRoutes(scope, dependencies.routes ?? SERVICE_LIVE_ROUTES);
    const route = routes[0];
    if (!route?.walletState) return unavailableVoucherWallet(scope, "routes-unconfigured");
    const chain = dependencies.chain ?? serviceLiveChain;
    const reader = dependencies.reader ?? greenGoodsIndexer;
    await Promise.all(routes.map((entry) => verifyServiceLiveRoute(entry, chain)));
    const assets = new Map<
      string,
      { asset: ServiceLiveRoute["assets"][number]; adapter: Address }
    >();
    for (const entry of routes) {
      if (!entry.walletState) throw new Error("Voucher reserve route unavailable");
      await verifyServiceDeploymentState(entry.walletState.adapter, 100, chain);
      for (const asset of entry.assets) {
        const key = asset.token.toLowerCase();
        const previous = assets.get(key);
        if (
          previous &&
          (previous.asset.issuer.toLowerCase() !== asset.issuer.toLowerCase() ||
            previous.adapter.toLowerCase() !== entry.walletState.adapter.address.toLowerCase())
        )
          throw new Error("Conflicting voucher issuer or reserve adapter identity");
        if (!previous) assets.set(key, { asset, adapter: entry.walletState.adapter.address });
      }
    }
    const catalog = (dependencies.issuerRoutes ?? SERVICE_ISSUER_ROUTES).filter(
      (entry) =>
        entry.service.sourceChainId === scope.sourceChainId &&
        entry.service.core.address.toLowerCase() === scope.coreModule.toLowerCase()
    );
    const stateAbi = parseAbi([
      "function assetAuthorizations(address issuer,address token) view returns(address issuerAuthority,bool enabled)",
      "function have(address token) view returns(bool)",
      "function limitOf(address token,address pool) view returns(uint256)",
    ]);
    const issuers: VoucherIssuer[] = await Promise.all(
      [...assets.values()].map(async ({ asset, adapter }) => {
        const read = (address: Address, functionName: string, args: readonly unknown[]) =>
          chain.read({ chainId: 100, address, abi: stateAbi, functionName, args });
        const authorization = await read(adapter, "assetAuthorizations", [
          asset.issuer,
          asset.token,
        ]);
        const reserve = serviceTuple(authorization, ["issuerAuthority", "enabled"]);
        const reviewedAsset = catalog
          .flatMap((entry) => entry.assets)
          .find(
            (candidate) =>
              candidate.token.address.toLowerCase() === asset.token.toLowerCase() &&
              candidate.ownerReserve.toLowerCase() === asset.issuer.toLowerCase()
          );
        const exchanges = await readVoucherExchangeListings(catalog, asset.token, chain);
        const services = reviewedAsset?.service.offers;
        return {
          account: asset.issuer,
          kind: reviewedAsset?.kind ?? ("collective" as const),
          name: asset.issuerName ?? asset.symbol,
          gender: null,
          services:
            services?.length &&
            services.every(
              (offer) =>
                offer.name?.trim() &&
                offer.unit.trim() &&
                offer.serviceUnits > 0n &&
                offer.voucherUnits > 0n
            )
              ? services.map(({ name, unit, serviceUnits, voucherUnits, serviceTermsRef }) => ({
                  name: name ?? unit,
                  unit,
                  serviceUnits,
                  voucherUnits,
                  serviceTermsRef,
                }))
              : null,
          garden: asset.garden ?? scope.coreModule,
          asset: {
            chainId: 100,
            token: asset.token,
            symbol: asset.symbol,
            decimals: asset.decimals,
          },
          exchanges,
          // Delisting in an exchange does not remove holdings or booked service obligations.
          standing: {
            bookings: serviceFlag(reserve.enabled) ? ("open" as const) : ("paused" as const),
            exchange: voucherExchangeStanding(exchanges),
          },
        };
      })
    );
    const balances = await Promise.all(
      [...assets.values()].map(async ({ asset }) => ({
        token: asset.token,
        amount: serviceUint(
          await chain.read({
            chainId: 100,
            address: asset.token,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [scope.account],
          })
        ),
      }))
    );
    const setups: ServiceVoucherSetup[] = [];
    let discoveryFailed = false;
    try {
      const discovered = await discoverWalletVoucherSetups(scope, route.source.address, reader);
      // A bounded cross-chain projection cannot prove that every setup has arrived.

      const read =
        dependencies.readSnapshot ??
        createServiceAccessReadRepository(reader, { read: chain.read }).getServiceAccess;
      const snapshots = new Map<string, ServiceAccessSnapshot>();
      for (const hint of discovered.records) {
        const key = `${hint.commitmentId}:${hint.buyer}`;
        let snapshot = snapshots.get(key);
        if (!snapshot) {
          snapshot = await read({
            sourceChainId: scope.sourceChainId,
            coreModule: scope.coreModule,
            commitmentId: hint.commitmentId,
            buyer: hint.buyer,
          });
          if (
            snapshot.evidence !== "onchain" ||
            snapshot.capabilities.reasons.includes("authoritative-read-failed")
          )
            throw new Error("Canonical wallet booking unavailable");
          await hydrateLiveVoucherSnapshot(snapshot, route, chain);
          snapshots.set(key, snapshot);
        }
        const setup = snapshot.voucherSetups.find(
          (row) =>
            row.setupId === hint.setupId &&
            row.authorization.holder.toLowerCase() === scope.account.toLowerCase()
        );
        if (!setup) throw new Error("Indexed wallet booking does not match the canonical holder");
        setups.push(setup);
      }
    } catch (error) {
      discoveryFailed = true;
      logger.warn("Voucher wallet booking discovery is incomplete", {
        source: "readLiveVoucherWallet",
        error,
      });
    }
    const wallet = voucherWalletFromSetups({
      scope,
      evidence: "onchain",
      complete: false,
      issuers,
      balances,
      setups,
    });
    return { ...wallet, reason: discoveryFailed ? "projection-unregistered" : null };
  } catch (error) {
    logger.warn("Canonical voucher wallet reads are unavailable", {
      error,
      account: scope.account,
    });
    return unavailableVoucherWallet(scope, "canonical-read-unavailable");
  }
}

function rewardDelivery(
  item: PilotRewardItem,
  workFulfilled: boolean,
  inventory: NonNullable<ServiceAccessSnapshot["pilot"]>["inventory"]
): RequestRewardDelivery {
  const voucher = item.paymentMethod === "issuer-reserve-allowance";
  const sameToken = inventory.asset.token.toLowerCase() === item.asset.token.toLowerCase();
  const shortOf =
    voucher && sameToken && item.state !== "delivered"
      ? inventory.reserve < item.amount
        ? "reserve"
        : inventory.allowance < item.amount
          ? "allowance"
          : null
      : null;
  const status: RequestRewardDelivery["status"] = !workFulfilled
    ? "after-work"
    : item.state === "delivered"
      ? "received"
      : shortOf
        ? "waiting"
        : item.state === "failed"
          ? "delayed"
          : "on-the-way";
  return {
    id: item.id,
    kind: voucher ? "voucher" : "gd",
    asset: item.asset,
    amount: item.amount,
    funder: item.funder,
    status,
    shortOf: status === "waiting" ? shortOf : null,
    receipt: item.receipt,
    attempts: item.attempts,
  };
}

const BEFORE_CONFIRMATION = new Set([
  "OFFERED",
  "REQUESTED",
  "ACCEPTED",
  "EVIDENCE_SUBMITTED",
  "READY_FOR_CONFIRMATION",
]);

/**
 * A live request's voucher reward while its work is still to come. Only the live read names the
 * reviewed voucher (its decimals). After confirmation the live distribution read owns delivery;
 * a source receipt alone never establishes arrival.
 */
function liveEarnedReward(snapshot: ServiceAccessSnapshot): RequestRewardDelivery[] | null {
  if (snapshot.earnedReward) return [snapshot.earnedReward];
  const earned = snapshot.acceptancePolicy.earned;
  const terms = earned.terms;
  if (
    earned.status !== "bound" ||
    !earned.termsHash ||
    !terms ||
    terms.asset.decimals === null ||
    !BEFORE_CONFIRMATION.has(snapshot.coreState ?? "")
  )
    return null;
  return [
    {
      id: earned.termsHash,
      kind: "voucher",
      asset: terms.asset,
      amount: terms.totalUnits,
      funder: terms.issuer,
      status: "after-work",
      shortOf: null,
      receipt: null,
      attempts: 0n,
    },
  ];
}

/** Each reward on its own. Null where no delivery read exists for this request yet. */
export function requestRewardDeliveries(
  snapshot: ServiceAccessSnapshot
): RequestRewardDelivery[] | null {
  const pilot = snapshot.pilot;
  const reward = pilot?.reward;
  if (!pilot || !reward) return liveEarnedReward(snapshot);
  return [reward.voucher, reward.gd].flatMap((item) =>
    item ? [rewardDelivery(item, reward.workFulfilled, pilot.inventory)] : []
  );
}

export { readIssuerSafeThreshold, readVoucherIssuerApproval } from "./service-access-issuer-rule";
