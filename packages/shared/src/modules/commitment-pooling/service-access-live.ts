import EntitlementABI from "@green-goods/contracts/abis/VoucherEntitlementModule.json";
import type { Abi } from "viem";
import type { Address } from "../../types/domain";
import { readGardenMembership } from "../../utils/blockchain/garden-role-reads";
import { logger } from "../app/logger";
import { reconcileTransaction } from "../transactions/confirmation";
import type { TransactionSender } from "../transactions/types";
import { serviceAccessAvailableActions } from "./service-access";
import { serviceAddress, serviceFlag, serviceTuple } from "./service-access-chain-values";
import {
  hydrateLiveVoucherSnapshot,
  type ServiceLiveChain,
  serviceLiveChain,
  verifyServiceLiveRoute,
} from "./service-access-live-chain";
import { SERVICE_LIVE_ROUTES, type ServiceLiveRoute } from "./service-access-live-config";
import {
  configIdentity,
  executeLiveServiceCall,
  hasActiveServiceSubmission,
  parsePending,
  verifyWalletExecution,
} from "./service-access-live-submission";
import type {
  ServiceAccessAction,
  ServiceAccessActionResult,
  ServiceAccessAdapter,
  ServiceAccessKey,
  ServiceAccessSnapshot,
} from "./service-access-types";
import { voucherSetupAvailableActions } from "./service-access-voucher";
import { readEarnedRewardDelivery } from "./service-access-earned-delivery";
import { assertServiceActor } from "./service-actor-session";
import { AdapterABI } from "./service-issuer-abis";
import { verifyIssuerRewardRoute } from "./service-issuer-chain";
import { SERVICE_ISSUER_ROUTES } from "./service-issuer-metadata";
import type { ServiceIssuerRoute } from "./service-issuer-types";

export interface ServiceLiveSession {
  address: Address | null;
  authMode: "passkey" | "wallet" | "embedded" | null;
  profile: string | null;
  generation: number;
  online: boolean;
}
interface ServiceLiveDependencies {
  session(): ServiceLiveSession;
  sender(): TransactionSender | null;
  readSnapshot(key: ServiceAccessKey): Promise<ServiceAccessSnapshot>;
  routes?: readonly ServiceLiveRoute[];
  /** The reviewed issuer routes, whose source pin is the reward module a request's reward binds. */
  issuerRoutes?: readonly ServiceIssuerRoute[];
  chain?: ServiceLiveChain;
  membership?: typeof readGardenMembership;
  storage?: Pick<Storage, "getItem" | "setItem" | "removeItem">;
}
/** A voucher offer's acts, a request reward's agreement, or whatever the promise reads as. */
type ServiceLiveReadPurpose = "any" | "voucher" | "earned";
const same = (a: string | null | undefined, b: string | null | undefined) =>
  !!a && !!b && a.toLowerCase() === b.toLowerCase();
/** A reviewed route starts without signer powers; each chain's actor check grants its own. */
function routeCapabilities(
  key: ServiceAccessKey,
  holder: Address | null = null
): ServiceAccessSnapshot["capabilities"] {
  return {
    mutation: "onchain",
    reasons: [],
    sourceBuyer: key.buyer,
    celoDepositor: null,
    gnosisHolder: holder,
    canSignSource: false,
    canSendSource: false,
    canSignCelo: false,
    canSignHolder: false,
    canSendDestination: false,
  };
}
const ROUTE_PROOF_REUSE_MS = 60_000;
/** Online member acts only. Persisted public references are partitioned by chain/address, never replayed automatically. */
export function createLiveServiceAccessAdapter(
  deps: ServiceLiveDependencies
): ServiceAccessAdapter {
  const chain = deps.chain ?? serviceLiveChain;
  const routes = deps.routes ?? SERVICE_LIVE_ROUTES;
  const membership = deps.membership ?? readGardenMembership;
  const routeFor = (key: ServiceAccessKey) =>
    routes.find(
      (route) =>
        route.sourceChainId === key.sourceChainId && same(route.core.address, key.coreModule)
    );
  const assertSession = async (key: ServiceAccessKey, expected?: string, chainId?: number) => {
    return assertServiceActor(
      key.buyer,
      chainId ?? key.sourceChainId,
      key.sourceChainId,
      deps.session,
      deps.sender(),
      chain,
      expected
    );
  };
  // A route's proof costs about forty reads. Reads share a recent one; the check right before a
  // broadcast always proves the route again.
  const proofs = new Map<string, { at: number; proof: Promise<void> }>();
  const prove = (id: string, fresh: boolean, run: () => Promise<void>) => {
    const cached = proofs.get(id);
    if (!fresh && cached && Date.now() - cached.at < ROUTE_PROOF_REUSE_MS) return cached.proof;
    const proof = run();
    proofs.set(id, { at: Date.now(), proof });
    proof.catch(() => {
      if (proofs.get(id)?.proof === proof) proofs.delete(id);
    });
    return proof;
  };
  const verifyRoute = (route: ServiceLiveRoute, fresh: boolean) =>
    prove(configIdentity(route), fresh, () => verifyServiceLiveRoute(route, chain));
  // The issuer route over the same core pins the Arbitrum reward module that a request's reward
  // binds; the live route's own identity stays unchanged, so no pending record is orphaned.
  const issuerRoutes = deps.issuerRoutes ?? SERVICE_ISSUER_ROUTES;
  const earnedRouteFor = (route: ServiceLiveRoute) =>
    issuerRoutes.find(
      (issuer) =>
        issuer.service.sourceChainId === route.sourceChainId &&
        same(issuer.service.core.address, route.core.address)
    ) ?? null;
  const storage = () => deps.storage ?? globalThis.localStorage;
  /** A send on record is settled before any new act; until then the act waits for it. */
  const reconcilePending = async (
    s: ServiceAccessSnapshot,
    key: ServiceAccessKey,
    route: ServiceLiveRoute,
    chainIds: readonly number[],
    reconcile: boolean
  ) => {
    const store = storage();
    for (const chainId of chainIds) {
      const scope = `green-goods:service-pending:v1:${chainId}:${key.buyer.toLowerCase()}`;
      if (!store || hasActiveServiceSubmission(scope) || !reconcile) continue;
      const record = store.getItem(scope);
      if (!record) continue;
      const pending = parsePending(record, chainId, key.buyer, configIdentity(route));
      const sender = deps.sender();
      const outcome =
        pending.version === 1 &&
        pending.route === configIdentity(route) &&
        pending.submission &&
        sender
          ? await reconcileTransaction(sender, pending.submission, async (hash) => {
              const receipt = await chain.receipt(chainId, hash);
              return {
                status: receipt.status === "success" ? "success" : "reverted",
                transactionHash: receipt.transactionHash,
              };
            })
          : { status: "unresolved" as const };
      if (outcome.status !== "unresolved") {
        if (outcome.status === "confirmed" && sender?.authMode === "wallet")
          await verifyWalletExecution(chain, chainId, outcome.transactionHash, pending.call);
        store.removeItem(scope);
      } else {
        s.capabilities.mutation = "unavailable";
        s.capabilities.reasons = [...s.capabilities.reasons, "submission-pending"];
      }
    }
  };
  /** The reviewed voucher a request's reward pays, under the reviewed reward module; else throws. */
  const reviewEarned = async (
    s: ServiceAccessSnapshot,
    route: ServiceLiveRoute,
    fresh: boolean
  ) => {
    const earned = s.acceptancePolicy.earned;
    const issuer = earnedRouteFor(route);
    const pin = issuer?.adapterSource;
    if (s.capabilities.reasons.includes("authoritative-read-failed") || !earned.terms)
      throw new Error("Authoritative live service state unavailable");
    if (!pin || !earned.module || !same(earned.module, pin.address))
      throw new Error("Earned reward module is outside the reviewed route");
    const terms = earned.terms;
    const asset = route.assets.find(
      (v) => same(v.token, terms.asset.token) && same(v.issuer, terms.issuer)
    );
    const rewardAsset = issuer!.assets.find(
      (v) => same(v.token.address, terms.asset.token) && same(v.ownerReserve, terms.issuer)
    );
    if (
      !asset ||
      !rewardAsset ||
      terms.asset.chainId !== 100 ||
      !same(rewardAsset.sourceAuthority, terms.issuerAuthority)
    )
      throw new Error("Earned reward asset is outside the reviewed route");
    await Promise.all([
      verifyRoute(route, fresh),
      prove(`earned:${pin.address.toLowerCase()}`, fresh, () =>
        verifyIssuerRewardRoute(issuer!, chain)
      ),
    ]);
    // Current issuer permissions govern new agreements, not the immutable delivery history.
    if (s.coreState === "FULFILLED") return asset;
    // Authorization is mutable per asset; it cannot inherit another asset's cached route proof.
    const [sourceAuthority, authorization] = await Promise.all([
      chain.read({
        chainId: 42161,
        address: pin.address,
        abi: EntitlementABI as Abi,
        functionName: "issuerAuthority",
        args: [terms.issuer, terms.asset.token],
      }),
      chain.read({
        chainId: 100,
        address: issuer!.adapter.address,
        abi: AdapterABI,
        functionName: "assetAuthorizations",
        args: [terms.issuer, terms.asset.token],
      }),
    ]);
    const reserve = serviceTuple(authorization, ["issuerAuthority", "enabled"]);
    if (
      !same(serviceAddress(sourceAuthority), rewardAsset.sourceAuthority) ||
      !same(serviceAddress(reserve.issuerAuthority), rewardAsset.sourceAuthority) ||
      !serviceFlag(reserve.enabled)
    )
      throw new Error("Earned reward issuer authority changed");
    return asset;
  };
  /**
   * A request's voucher reward, which its member agrees to from their own account before taking
   * it up. The agreement is offered only for the reviewed reward module and a reviewed voucher; an
   * unreviewed reward still reads as the core reports it, and only an agreement refuses it.
   */
  const readEarned = async (
    key: ServiceAccessKey,
    s: ServiceAccessSnapshot,
    route: ServiceLiveRoute,
    reconcile: boolean,
    fresh: boolean,
    agreeing: boolean
  ): Promise<ServiceAccessSnapshot> => {
    const earned = s.acceptancePolicy.earned;
    let asset: Awaited<ReturnType<typeof reviewEarned>>;
    try {
      asset = await reviewEarned(s, route, fresh);
    } catch (error) {
      if (agreeing) throw error;
      logger.warn("Earned reward review failed; agreement is unavailable", {
        error,
        commitmentId: key.commitmentId.toString(),
      });
      s.capabilities.mutation = "unavailable";
      s.capabilities.reasons = [...s.capabilities.reasons, "deployment-unreviewed"];
      s.availableActions = serviceAccessAvailableActions(s);
      return s;
    }
    const terms = earned.terms!;
    terms.asset = {
      chainId: 100,
      token: asset.token,
      symbol: asset.symbol,
      decimals: asset.decimals,
    };
    s.earnedReward = await readEarnedRewardDelivery(
      s,
      earnedRouteFor(route)!.adapter.address,
      chain.read
    );
    s.complete = true;
    if (s.mode !== "voucher") s.capabilities = routeCapabilities(key);
    try {
      await assertSession(key);
      s.capabilities.canSignSource = s.capabilities.canSendSource = true;
    } catch {
      s.capabilities.reasons = ["signer-unavailable"];
    }
    // A garden claim's account must agree for itself; this app signs only a member's own.
    if (earned.claimType !== "individual")
      s.capabilities.reasons = [...s.capabilities.reasons, "earned-consent-unavailable"];
    await reconcilePending(
      s,
      key,
      route,
      s.mode === "voucher" ? [key.sourceChainId, 100] : [key.sourceChainId],
      reconcile
    );
    s.availableActions = serviceAccessAvailableActions(s);
    s.voucherSetups = s.voucherSetups.map((row) => ({
      ...row,
      availableActions: voucherSetupAvailableActions(s, row),
    }));
    return s;
  };
  const read = async (
    key: ServiceAccessKey,
    reconcile = true,
    purpose: ServiceLiveReadPurpose = "any",
    fresh = false
  ): Promise<ServiceAccessSnapshot> => {
    const route = routeFor(key);
    if (!route) return deps.readSnapshot(key);
    const s = await deps.readSnapshot(key);
    // An unread promise may still be a voucher offer, so a failed read stays a failure.
    if (s.evidence !== "onchain") throw new Error("Authoritative live service state unavailable");
    const earned = s.acceptancePolicy.earned.status === "bound";
    if (purpose === "earned" && !earned)
      throw new Error("Authoritative live service state unavailable");
    if (earned && s.mode !== "voucher" && purpose !== "voucher")
      return readEarned(key, s, route, reconcile, fresh, purpose === "earned");
    // The route carries the core's voucher offers; its other promises read as they do unrouted.
    if (s.mode !== "voucher" && purpose !== "voucher") return s;
    await verifyRoute(route, fresh);
    if (
      s.evidence !== "onchain" ||
      s.mode !== "voucher" ||
      !s.offer?.voucher ||
      !same(s.key.buyer, key.buyer) ||
      s.key.commitmentId !== key.commitmentId ||
      !same(s.key.coreModule, key.coreModule) ||
      s.key.sourceChainId !== key.sourceChainId ||
      s.capabilities.reasons.includes("authoritative-read-failed")
    )
      throw new Error("Authoritative live service state unavailable");
    const asset = route.assets.find(
      (v) =>
        same(v.token, s.offer!.voucher!.asset.token) && same(v.issuer, s.offer!.voucher!.issuer)
    );
    if (!asset) throw new Error("Service asset is outside the reviewed route");
    s.offer.voucher.asset = {
      chainId: 100,
      token: asset.token,
      symbol: asset.symbol,
      decimals: asset.decimals,
    };
    const memberships = await Promise.all(
      route.buyerGardens.map(async (garden) => ({
        garden,
        member: await membership(garden.address, key.buyer, key.sourceChainId),
      }))
    );
    // An unknown membership is not "no": with no garden confirmed, the member retries instead of
    // reading as ineligible. A confirmed garden stays usable whatever the others answer.
    if (
      !memberships.some(({ member }) => member === true) &&
      memberships.some(({ member }) => member === null)
    )
      throw new Error("Buyer garden membership unavailable");
    s.eligibleBuyerGardens = memberships
      .filter(({ member }) => member === true)
      .map(({ garden }) => garden);
    await hydrateLiveVoucherSnapshot(s, route, chain);
    s.complete = true;
    s.capabilities = routeCapabilities(key, key.buyer);
    try {
      await assertSession(key);
      s.capabilities.canSignSource = s.capabilities.canSendSource = true;
      await assertSession(key, undefined, 100);
      s.capabilities.canSignHolder = s.capabilities.canSendDestination = true;
    } catch {
      s.capabilities.reasons = ["signer-unavailable"];
    }
    if (earned) return readEarned(key, s, route, reconcile, fresh, purpose === "earned");
    await reconcilePending(s, key, route, [key.sourceChainId, 100], reconcile);
    s.availableActions = serviceAccessAvailableActions(s);
    s.voucherSetups = s.voucherSetups.map((row) => ({
      ...row,
      availableActions: voucherSetupAvailableActions(s, row),
    }));
    return s;
  };
  const execute = (
    key: ServiceAccessKey,
    action: ServiceAccessAction
  ): Promise<ServiceAccessActionResult> =>
    executeLiveServiceCall(key, action, routeFor(key), {
      session: () => deps.session(),
      storage,
      chain,
      read: (k, reconcile, fresh) =>
        read(k, reconcile, action.action === "consentEarnedTerms" ? "earned" : "voucher", fresh),
      assertSession,
    });
  return {
    read: (key) => read(key),
    execute: (key, action) => {
      if (!routeFor(key)) return execute(key, action);
      // The same member cannot approve two service calls concurrently in separate tabs.
      if (typeof window !== "undefined") {
        if (!navigator.locks)
          return Promise.reject(new Error("Exclusive service submission locking unavailable"));
        return navigator.locks.request(
          `green-goods:service:${key.buyer.toLowerCase()}`,
          { ifAvailable: true },
          (lock) => {
            if (!lock) throw new Error("Service submission already active in another tab");
            return execute(key, action);
          }
        );
      }
      return execute(key, action);
    },
  };
}
