import type { Address } from "../../types/domain";
import { readGardenMembership } from "../../utils/blockchain/garden-role-reads";
import { reconcileTransaction } from "../transactions/confirmation";
import type { TransactionSender } from "../transactions/types";
import { serviceAccessAvailableActions } from "./service-access";
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
import { assertServiceActor } from "./service-actor-session";

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
  chain?: ServiceLiveChain;
  membership?: typeof readGardenMembership;
  storage?: Pick<Storage, "getItem" | "setItem" | "removeItem">;
}
const same = (a: string | null | undefined, b: string | null | undefined) =>
  !!a && !!b && a.toLowerCase() === b.toLowerCase();
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
  const read = async (key: ServiceAccessKey, reconcile = true): Promise<ServiceAccessSnapshot> => {
    const route = routeFor(key);
    if (!route) return deps.readSnapshot(key);
    await verifyServiceLiveRoute(route, chain);
    const s = await deps.readSnapshot(key);
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
    s.eligibleBuyerGardens = (
      await Promise.all(
        route.buyerGardens.map(async (garden) =>
          (await membership(garden.address, key.buyer, key.sourceChainId)) === true ? garden : null
        )
      )
    ).filter((garden) => garden !== null);
    await hydrateLiveVoucherSnapshot(s, route, chain);
    s.complete = true;
    s.capabilities = {
      mutation: "onchain",
      reasons: [],
      sourceBuyer: key.buyer,
      celoDepositor: null,
      gnosisHolder: key.buyer,
      canSignSource: false,
      canSendSource: false,
      canSignCelo: false,
      canSignHolder: false,
      canSendDestination: false,
    };
    try {
      await assertSession(key);
      s.capabilities.canSignSource = s.capabilities.canSendSource = true;
      await assertSession(key, undefined, 100);
      s.capabilities.canSignHolder = s.capabilities.canSendDestination = true;
    } catch {
      s.capabilities.reasons = ["signer-unavailable"];
    }
    const storage = deps.storage ?? globalThis.localStorage;
    for (const chainId of [key.sourceChainId, 100]) {
      const scope = `green-goods:service-pending:v1:${chainId}:${key.buyer.toLowerCase()}`;
      if (!storage || hasActiveServiceSubmission(scope) || !reconcile) continue;
      const record = storage.getItem(scope);
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
        storage.removeItem(scope);
      } else {
        s.capabilities.mutation = "unavailable";
        s.capabilities.reasons = [...s.capabilities.reasons, "submission-pending"];
      }
    }
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
      storage: () => deps.storage ?? globalThis.localStorage,
      chain,
      read,
      assertSession,
    });
  return {
    read,
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
