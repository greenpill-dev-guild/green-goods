import { erc20Abi, parseAbi } from "viem";
import type { Address } from "../../types/domain";
import { logger } from "../app/logger";
import { serviceFlag, serviceTuple, serviceUint } from "./service-access-chain-values";
import type { PilotRewardItem } from "./service-access-pilot-types";
import type { ServiceAccessSnapshot } from "./service-access-types";
import type { ServiceVoucherSetup } from "./service-access-voucher-types";
import { greenGoodsIndexer, type GraphQLReader } from "../data/graphql-client";
import { discoverWalletVoucherSetups } from "./data-voucher-service";
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
  const holdings: VoucherHolding[] = input.issuers.map((issuer) => ({
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
    issuers: input.issuers,
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

/** Index discovery never replaces canonical balances, authorization or escrow results. */
export async function readLiveVoucherWallet(
  scope: VoucherWalletScope,
  dependencies: {
    routes?: readonly ServiceLiveRoute[];
    chain?: ServiceLiveChain;
    reader?: GraphQLReader;
    readSnapshot?: (key: ServiceAccessSnapshot["key"]) => Promise<ServiceAccessSnapshot>;
  } = {}
): Promise<VoucherWalletSnapshot> {
  const route = (dependencies.routes ?? SERVICE_LIVE_ROUTES).find(
    (r) =>
      r.sourceChainId === scope.sourceChainId &&
      r.core.address.toLowerCase() === scope.coreModule.toLowerCase()
  );
  if (!route?.walletState) return unavailableVoucherWallet(scope, "routes-unconfigured");
  const chain = dependencies.chain ?? serviceLiveChain;
  const reader = dependencies.reader ?? greenGoodsIndexer;
  await verifyServiceLiveRoute(route, chain);
  const state = route.walletState;
  const stateAbi = parseAbi([
    "function assetAuthorizations(address issuer,address token) view returns(address issuerAuthority,bool enabled)",
    "function have(address token) view returns(bool)",
    "function limitOf(address token,address pool) view returns(uint256)",
  ]);
  const issuers: VoucherIssuer[] = await Promise.all(
    route.assets.map(async (asset) => {
      const read = (address: Address, functionName: string, args: readonly unknown[]) =>
        chain.read({ chainId: 100, address, abi: stateAbi, functionName, args });
      const [authorization, admitted, cap] = await Promise.all([
        read(state.adapter, "assetAuthorizations", [asset.issuer, asset.token]),
        read(state.registry, "have", [asset.token]),
        read(state.limiter, "limitOf", [asset.token, state.pool]),
      ]);
      const reserve = serviceTuple(authorization, ["issuerAuthority", "enabled"]);
      return {
        account: asset.issuer,
        kind: "collective" as const,
        name: asset.issuerName ?? asset.symbol,
        gender: null,
        garden: asset.garden ?? scope.coreModule,
        asset: { chainId: 100, token: asset.token, symbol: asset.symbol, decimals: asset.decimals },
        // The member-row PR consumes these canonical states; delisting does not remove holdings.
        standing: {
          bookings: serviceFlag(reserve.enabled) ? ("open" as const) : ("paused" as const),
          exchange:
            serviceFlag(admitted) && serviceUint(cap) > 0n
              ? ("listed" as const)
              : ("delisted" as const),
        },
      };
    })
  );
  const balances = await Promise.all(
    route.assets.map(async (asset) => ({
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

/** Each reward on its own. Null where no delivery read exists for this request yet. */
export function requestRewardDeliveries(
  snapshot: ServiceAccessSnapshot
): RequestRewardDelivery[] | null {
  const pilot = snapshot.pilot;
  const reward = pilot?.reward;
  if (!pilot || !reward) return null;
  return [reward.voucher, reward.gd].flatMap((item) =>
    item ? [rewardDelivery(item, reward.workFulfilled, pilot.inventory)] : []
  );
}

export { readIssuerSafeThreshold, readVoucherIssuerApproval } from "./service-access-issuer-rule";
