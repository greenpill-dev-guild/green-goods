import {
  createIssuerPendingStore,
  createIssuerExchangeStore,
  issuerReviewFingerprint,
  withIssuerSubmissionLock,
} from "./service-issuer-pending";
import type { Hex } from "viem";
import { logger } from "../app/logger";
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
  verifyIssuerPool,
  serviceIssuerChain,
  type ServiceIssuerChain,
} from "./service-issuer-chain";
import { serviceAddress, serviceFlag, serviceTuple } from "./service-access-chain-values";
import { verifyIssuerReceipt } from "./service-issuer-receipt";
import { issuerReadback, prepareIssuerCall } from "./service-issuer-commands";
import {
  issuerAsset,
  issuerExchangeAction,
  issuerPool,
  issuerConfiguration,
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
  ServiceIssuerPoolListing,
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
  const exchangeStore = createIssuerExchangeStore(storage);
  const continuation = async (actor: ServiceIssuerActor, amount: bigint) => {
    const record = exchangeStore.read(actor);
    const first = record?.review;
    if (
      !record ||
      !first ||
      first.action.kind !== "exchange" ||
      first.continuation ||
      first.actor.routeId !== actor.routeId ||
      first.action.outputAssetId !== actor.assetId ||
      first.actor.poolId === actor.poolId ||
      !actor.poolId
    )
      throw new Error("A confirmed first hop and a distinct second pool are required");
    if (typeof amount !== "bigint" || amount <= 0n || amount > record.deliveredOutput)
      throw new Error("Second hop cannot spend more than the vouchers received");
    const route = routeFor(actor);
    if (issuerConfiguration(route, first.actor.poolId) !== first.configuration)
      throw new Error("First exchange configuration changed; review held vouchers separately");
    const receipt = await chain.receipt(100, record.transactionHash);
    if (
      receipt.status !== "success" ||
      !issuerSame(receipt.transactionHash, record.transactionHash)
    )
      throw new Error("First exchange receipt needs reconciliation");
    if (record.submission.broadcastReference?.kind !== "user-operation")
      await verifyWalletExecution(
        chain,
        100,
        record.transactionHash,
        serviceCallIdentity(first.call)
      );
    const delivered = await verifyIssuerReceipt(
      chain,
      route,
      first,
      record.submission,
      record.transactionHash
    );
    if (delivered !== record.deliveredOutput)
      throw new Error("First exchange delivery changed; reconcile before continuing");
    return {
      transactionHash: record.transactionHash,
      reviewFingerprint: first.fingerprint,
      deliveredOutput: delivered,
      intermediateResidue: delivered - amount,
    };
  };
  const complete = async (p: ServiceIssuerPending, sender: TransactionSender, hash: Hex) => {
    const route = routeFor(p.actor);
    if (
      issuerConfiguration(
        route,
        issuerExchangeAction(p.review.action) ? p.actor.poolId : undefined
      ) !== p.review.configuration
    )
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
    if (deliveredOutput !== undefined) {
      // Persist before clearing pending: a storage failure remains reconcilable without resending.
      exchangeStore.save({
        version: 1,
        review: p.review,
        submission: p.submission!,
        transactionHash: hash,
        deliveredOutput,
      });
    }
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
      configuration: issuerConfiguration(
        route,
        issuerExchangeAction(action) ? actor.poolId : undefined
      ),
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
          r.continuation &&
          (r.action.kind !== "exchange" ||
            issuerDigest(await continuation(r.actor, r.action.amount)) !==
              issuerDigest(r.continuation))
        )
          throw new Error("Exchange continuation changed; review again");
        if (
          r.version !== 1 ||
          r.evidence !== "live-review" ||
          r.fingerprint !== issuerReviewFingerprint(r) ||
          r.configuration !==
            issuerConfiguration(route, issuerExchangeAction(r.action) ? r.actor.poolId : undefined)
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
  const quote: ServiceIssuerOperations["quote"] = async (actor, outputAssetId, amount) => {
    const route = routeFor(actor);
    const identity = sessionIdentity(deps.session());
    await assertActor(actor, identity);
    const pool = issuerPool(route, actor.poolId);
    const input = issuerAsset(route, actor.assetId, true);
    const output = issuerAsset(route, outputAssetId, true);
    if (
      typeof amount !== "bigint" ||
      amount <= 0n ||
      amount >= (1n << 256n) - 1n ||
      issuerSame(input.token.address, output.token.address)
    )
      throw new Error("Finite exchange input and distinct assets required");
    await verifyIssuerRoute(route, input, chain);
    const state = await issuerPoolState(chain, route, pool, input, output, amount);
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
      poolId: pool.id,
      poolAddress: pool.deployment.address,
      outputAssetId,
      amount,
      grossOutput: state.grossQuote,
      quotedOutput: state.quote,
      reservedOutputFees: state.outputFees,
      observedAt,
      expiresAt: observedAt + ISSUER_REVIEW_SECONDS,
    };
  };
  return {
    quote,
    lastExchange: exchangeStore.read,
    quoteContinuation: async (actor, outputAssetId, amount) => {
      const first = await continuation(actor, amount);
      const next = await quote(actor, outputAssetId, amount);
      return {
        ...next,
        firstTransactionHash: first.transactionHash,
        intermediateResidue: first.intermediateResidue,
      };
    },
    reviewContinuation: async (actor, action) => {
      const first = await continuation(actor, action.amount);
      const next = { ...(await review(actor, action)), continuation: first };
      return { ...next, fingerprint: issuerReviewFingerprint(next) };
    },
    read: async (actor) => {
      if (!routes.some((route) => route.service.id === actor.routeId))
        return { evidence: "unavailable", reason: "unconfigured" };
      const route = routeFor(actor);
      const asset = issuerAsset(route, actor.assetId, true);
      await verifyIssuerRoute(route, asset, chain);
      let pool: ServiceIssuerPoolListing | null = null;
      let poolAllowance = 0n;
      let poolStatus: "unselected" | "observed" | "unavailable" = "unselected";
      const state = await issuerAssetState(chain, route, asset, actor.address);
      if (actor.poolId) {
        try {
          const selectedPool = issuerPool(route, actor.poolId);
          await verifyIssuerPool(route, selectedPool, chain);
          pool = await issuerPoolListing(chain, selectedPool, asset);
          poolAllowance = (await issuerAssetState(chain, route, asset, actor.address, selectedPool))
            .poolAllowance;
          poolStatus = "observed";
        } catch (error) {
          poolStatus = "unavailable";
          logger.warn(
            "Selected voucher exchange is unavailable; retaining holdings and service recovery",
            { error, poolId: actor.poolId }
          );
        }
      }
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
        poolAllowance,
        reserveEnabled: serviceFlag(authorization.enabled),
        configuredReserveAuthority: serviceAddress(authorization.issuerAuthority),
        registeredSourceAuthority: state.sourceAuthority,
        pool,
        poolStatus,
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
