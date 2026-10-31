import {
  createIssuerPendingStore,
  issuerReviewFingerprint,
  withIssuerSubmissionLock,
} from "./service-issuer-pending";
import type { Hex } from "viem";
import { greenGoodsIndexer, type GraphQLReader } from "../data/graphql-client";
import { readIssuerBookings } from "./service-issuer-bookings";
import { sendCheckpointedCall, reconcileTransaction } from "../transactions/confirmation";
import {
  TransactionReplacementError,
  TransactionRevertedError,
  type TransactionSender,
} from "../transactions/types";
import { assertServiceActor } from "./service-actor-session";
import type { ServiceLiveSession } from "./service-access-live";
import { sessionIdentity, verifyWalletExecution } from "./service-access-live-submission";
import { serviceCallIdentity } from "./service-access-live-commands";
import {
  issuerAssetState,
  issuerPoolListing,
  issuerPoolState,
  verifyIssuerRoute,
  serviceIssuerChain,
  type ServiceIssuerChain,
} from "./service-issuer-chain";
import { serviceAddress, serviceFlag, serviceTuple } from "./service-access-chain-values";
import { verifyIssuerReceipt } from "./service-issuer-receipt";
import { issuerReadback, prepareIssuerCall } from "./service-issuer-commands";
import {
  issuerAsset,
  issuerDigest,
  issuerSame,
  SERVICE_ISSUER_ROUTES,
  ISSUER_REVIEW_SECONDS,
} from "./service-issuer-metadata";
import type {
  ServiceIssuerActor,
  ServiceIssuerOperations,
  ServiceIssuerPending,
  ServiceIssuerReview,
  ServiceIssuerRoute,
} from "./service-issuer-types";

interface Dependencies {
  session(): ServiceLiveSession;
  sender(): TransactionSender | null;
  routes?: readonly ServiceIssuerRoute[];
  chain?: ServiceIssuerChain;
  storage?: Pick<Storage, "getItem" | "setItem" | "removeItem">;
  bookingsReader?: GraphQLReader;
}
function rejected(error: unknown) {
  const seen = new Set<unknown>();
  let e = error;
  while (e && typeof e === "object" && !seen.has(e)) {
    seen.add(e);
    const v = e as { code?: number; name?: string; cause?: unknown };
    if (v.code === 4001 || v.name === "UserRejectedRequestError") return true;
    e = v.cause;
  }
  return false;
}

/** Live-only explicit member operations. No DEV promotion, offline queue, automatic retry or second spend. */
export function createServiceIssuerOperations(deps: Dependencies): ServiceIssuerOperations {
  const chain = deps.chain ?? serviceIssuerChain;
  const routes = deps.routes ?? SERVICE_ISSUER_ROUTES;
  const storage = () => {
    const value = deps.storage ?? globalThis.localStorage;
    if (!value) throw new Error("Durable issuer receipt storage unavailable");
    return value;
  };
  const routeFor = (actor: ServiceIssuerActor) => {
    const matches = routes.filter((r) => r.service.id === actor.routeId);
    if (matches.length !== 1) throw new Error("Receipt-backed issuer route configuration required");
    return matches[0]!;
  };
  const assertActor = (actor: ServiceIssuerActor, expected?: string) =>
    assertServiceActor(
      actor.address,
      100,
      routeFor(actor).service.sourceChainId,
      deps.session,
      deps.sender(),
      chain,
      expected
    );
  const pendingStore = createIssuerPendingStore(storage);
  const pending = pendingStore.read;
  const complete = async (p: ServiceIssuerPending, sender: TransactionSender, hash: Hex) => {
    const route = routeFor(p.actor);
    if (issuerDigest(route) !== p.review.configuration)
      throw new Error(
        "Issuer configuration changed; retain the pending receipt for reconciliation"
      );
    const receipt = await chain.receipt(100, hash);
    if (!issuerSame(receipt.transactionHash, hash))
      throw new Error("Issuer receipt identity mismatch");
    if (receipt.status !== "success") throw new TransactionRevertedError(hash);
    if (sender.authMode === "wallet")
      await verifyWalletExecution(chain, 100, hash, serviceCallIdentity(p.review.call));
    const deliveredOutput = await verifyIssuerReceipt(chain, route, p.review, p.submission!, hash);
    const currentStateMatchesReceipt = await issuerReadback(
      chain,
      route,
      p.actor,
      p.review.action,
      p.review.expected
    );
    pendingStore.clear(p);
    return {
      status: "confirmed" as const,
      transactionHash: hash,
      currentStateMatchesReceipt,
      ...(deliveredOutput === undefined ? {} : { deliveredOutput }),
    };
  };
  const reconcile: ServiceIssuerOperations["reconcile"] = async (actor) => {
    const p = pending(actor);
    if (!p) return null;
    // Read the original pending actor/route, even if a different asset is selected now.
    const sender = await assertActor(p.actor);
    if (!p.submission) return { status: "pending", pending: p };
    const result = await reconcileTransaction(sender, p.submission, async (hash) => {
      const receipt = await chain.receipt(100, hash);
      if (!issuerSame(receipt.transactionHash, hash))
        throw new Error("Issuer receipt identity mismatch");
      return {
        status: receipt.status === "success" ? "success" : "reverted",
        transactionHash: receipt.transactionHash,
      };
    });
    if (result.status === "unresolved") return { status: "pending", pending: p };
    if (result.status === "reverted") {
      pendingStore.clear(p);
      return { status: "reverted" };
    }
    if (result.status === "confirmed") return complete(p, sender, result.transactionHash);
    return { status: "pending", pending: p };
  };
  const review: ServiceIssuerOperations["review"] = async (actor, action) => {
    const route = routeFor(actor);
    const identity = sessionIdentity(deps.session());
    await assertActor(actor, identity);
    if (pending(actor))
      throw new Error("Reconcile the pending issuer transaction before reviewing another action");
    const expiresAt = (await chain.timestamp()) + ISSUER_REVIEW_SECONDS;
    const prepared = await prepareIssuerCall(chain, route, actor, action, expiresAt);
    await assertActor(actor, identity);
    const value: Omit<ServiceIssuerReview, "fingerprint"> = {
      version: 1,
      evidence: "live-review",
      actor: structuredClone(actor),
      action: structuredClone(action),
      session: identity,
      configuration: issuerDigest(route),
      state: prepared.state,
      expected: prepared.expected,
      expiresAt,
      call: prepared.call,
    };
    return { ...value, fingerprint: issuerReviewFingerprint(value) };
  };
  const execute: ServiceIssuerOperations["execute"] = async (r) => {
    let p: ServiceIssuerPending | undefined;
    let beforeFailed = false;
    const clear = () => {
      if (p) pendingStore.clear(p);
      p = undefined;
    };
    const persist = () => {
      if (!p) throw new Error("Missing issuer checkpoint");
      pendingStore.save(p);
    };
    try {
      if (pending(r.actor))
        throw new Error("Pending issuer transaction must be reconciled before another send");
      const route = routeFor(r.actor);
      const sender = await assertActor(r.actor, r.session);
      const fresh = async () => {
        await assertActor(r.actor, r.session);
        if (
          r.version !== 1 ||
          r.evidence !== "live-review" ||
          r.fingerprint !== issuerReviewFingerprint(r) ||
          r.configuration !== issuerDigest(route)
        )
          throw new Error("Issuer review or terms changed");
        const next = await prepareIssuerCall(chain, route, r.actor, r.action, r.expiresAt);
        if (
          next.state !== r.state ||
          issuerDigest(next.expected) !== issuerDigest(r.expected) ||
          serviceCallIdentity(next.call) !== serviceCallIdentity(r.call)
        )
          throw new Error("Issuer state or quote changed; review again");
        if (sender.authMode === "wallet" && (await chain.balance(100, r.actor.address)) <= 0n)
          throw new Error("The owning member wallet needs native Gnosis gas");
        await assertActor(r.actor, r.session);
      };
      await fresh();
      const result = await sendCheckpointedCall(
        sender,
        r.call,
        (submission) => {
          p = { version: 1, actor: r.actor, review: r, submission };
          persist();
        },
        clear,
        {
          assertOwnership: fresh,
          onBeforeBroadcast: async () => {
            try {
              await fresh();
              p ??= { version: 1, actor: r.actor, review: r };
              persist();
            } catch (error) {
              beforeFailed = true;
              throw error;
            }
          },
        }
      );
      p = { version: 1, actor: r.actor, review: r, submission: result };
      persist();
      if (result.confirmation === "pending") return { status: "pending", pending: p };
      return await complete(p, sender, result.hash);
    } catch (error) {
      if (
        beforeFailed ||
        (rejected(error) && !p?.submission) ||
        error instanceof TransactionRevertedError ||
        error instanceof TransactionReplacementError
      )
        clear();
      throw error;
    }
  };
  return {
    quote: async (actor, outputAssetId, amount) => {
      const route = routeFor(actor);
      const identity = sessionIdentity(deps.session());
      await assertActor(actor, identity);
      const input = issuerAsset(route, actor.assetId);
      const output = issuerAsset(route, outputAssetId);
      if (
        typeof amount !== "bigint" ||
        amount <= 0n ||
        amount >= (1n << 256n) - 1n ||
        issuerSame(input.token.address, output.token.address)
      )
        throw new Error("Finite exchange input and distinct assets required");
      await verifyIssuerRoute(route, input, chain);
      const state = await issuerPoolState(chain, route, input, output, amount);
      if (
        state.outputExpired ||
        state.quote === 0n ||
        state.availableOutput < state.grossQuote ||
        state.poolInput + amount > state.cap
      )
        throw new Error("Curated pool quote or liquidity unavailable");
      const observedAt = await chain.timestamp();
      await assertActor(actor, identity);
      return {
        outputAssetId,
        amount,
        grossOutput: state.grossQuote,
        quotedOutput: state.quote,
        reservedOutputFees: state.outputFees,
        observedAt,
        expiresAt: observedAt + ISSUER_REVIEW_SECONDS,
      };
    },
    read: async (actor) => {
      if (!routes.some((route) => route.service.id === actor.routeId))
        return { evidence: "unavailable", reason: "unconfigured" };
      const route = routeFor(actor);
      const asset = issuerAsset(route, actor.assetId, true);
      await verifyIssuerRoute(route, asset, chain);
      const [state, pool] = await Promise.all([
        issuerAssetState(chain, route, asset, actor.address),
        issuerPoolListing(chain, route, asset),
      ]);
      const authorization = serviceTuple(state.authorization, ["issuerAuthority", "enabled"]);
      const own = issuerSame(actor.address, asset.ownerReserve);
      return {
        evidence: "onchain",
        actor,
        asset,
        holdingBalance: state.balance,
        issuerReserveBalance: own ? state.balance : null,
        totalMinted: state.minted,
        reserveAllowance: own ? state.reserveAllowance : null,
        poolAllowance: state.poolAllowance,
        reserveEnabled: serviceFlag(authorization.enabled),
        configuredReserveAuthority: serviceAddress(authorization.issuerAuthority),
        registeredSourceAuthority: state.sourceAuthority,
        pool,
        pending: pending(actor),
        bookings: await readIssuerBookings(
          chain,
          route,
          actor,
          deps.bookingsReader ?? greenGoodsIndexer
        ),
      };
    },
    review,
    pending,
    reconcile: (actor) => withIssuerSubmissionLock(actor, () => reconcile(actor)),
    execute: (r) => withIssuerSubmissionLock(r.actor, () => execute(r)),
  };
}
