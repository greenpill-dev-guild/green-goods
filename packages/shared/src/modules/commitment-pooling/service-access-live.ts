import { keccak256, parseAbi, stringToHex, type Hex } from "viem";
import type { Address } from "../../types/domain";
import { readGardenMembership } from "../../utils/blockchain/garden-role-reads";
import { reconcileTransaction } from "../transactions/confirmation";
import {
  TransactionConfirmationPendingError,
  TransactionReplacementError,
  TransactionRevertedError,
  type TransactionSender,
  type TxResult,
} from "../transactions/types";
import { selectServiceAccessAction, serviceAccessAvailableActions } from "./service-access";
import {
  hydrateLiveVoucherSnapshot,
  serviceLiveChain,
  verifyServiceLiveRoute,
  type ServiceLiveChain,
} from "./service-access-live-chain";
import { serviceCallIdentity, serviceLiveCall } from "./service-access-live-commands";
import { SERVICE_LIVE_ROUTES, type ServiceLiveRoute } from "./service-access-live-config";
import { serviceAddress } from "./service-access-chain-values";
import type {
  ServiceAccessAction,
  ServiceAccessActionResult,
  ServiceAccessAdapter,
  ServiceAccessKey,
  ServiceAccessSnapshot,
} from "./service-access-types";
import { voucherSetupAvailableActions } from "./service-access-voucher";

export interface ServiceLiveSession {
  address: Address | null;
  authMode: "passkey" | "wallet" | "embedded" | null;
  profile: string | null;
  generation: number;
  online: boolean;
}
interface PendingServiceCall {
  version: 1;
  route: string;
  call: string;
  submission?: TxResult;
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
const active = new Set<string>();
function parsePending(
  record: string,
  chainId: number,
  buyer: Address,
  route: string
): PendingServiceCall {
  const value = JSON.parse(record) as PendingServiceCall;
  const prefix = `${chainId}:${buyer.toLowerCase()}:`;
  if (
    value.version !== 1 ||
    value.route !== route ||
    typeof value.call !== "string" ||
    !value.call.startsWith(prefix)
  )
    throw new Error("Stored service submission needs operator reconciliation");
  if (value.submission) {
    const reference = value.submission.broadcastReference;
    if (
      !/^0x[0-9a-f]{64}$/i.test(value.submission.hash) ||
      (reference &&
        (!/^0x[0-9a-f]{64}$/i.test(reference.hash) ||
          reference.chainId !== chainId ||
          !["transaction", "user-operation"].includes(reference.kind) ||
          (reference.kind === "transaction" && !same(reference.account, buyer))))
    )
      throw new Error("Stored service reference has the wrong account or chain");
  }
  return value;
}
async function verifyWalletExecution(
  chain: ServiceLiveChain,
  chainId: number,
  hash: Hex,
  call: string
) {
  const tx = await chain.transaction(chainId, hash);
  const identity = `${chainId}:${tx.from.toLowerCase()}:${tx.to?.toLowerCase()}:${tx.value}:${tx.input.toLowerCase()}`;
  if (identity !== call.toLowerCase())
    throw new Error("Service execution transaction does not match the reviewed call");
}
function sessionIdentity(s: ServiceLiveSession) {
  return `${s.authMode}:${s.address?.toLowerCase()}:${s.profile}:${s.generation}`;
}
function configIdentity(route: ServiceLiveRoute) {
  return keccak256(
    stringToHex(
      JSON.stringify(route, (_, value) => (typeof value === "bigint" ? value.toString() : value))
    )
  );
}
function rejected(error: unknown): boolean {
  let current = error;
  const seen = new Set<unknown>();
  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    const link = current as { code?: number; name?: string; cause?: unknown };
    if (link.code === 4001 || link.name === "UserRejectedRequestError") return true;
    current = link.cause;
  }
  return false;
}

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
    const session = deps.session();
    const sender = deps.sender();
    if (!session.online) throw new Error("Service actions require an online connection");
    if (
      !sender ||
      !sender.assertOwnership ||
      !same(session.address, key.buyer) ||
      sender.authMode !== session.authMode ||
      (session.authMode !== "wallet" &&
        !(session.authMode === "passkey" && session.profile === "kernel-0.3.3-pilot")) ||
      (expected && sessionIdentity(session) !== expected)
    )
      throw new Error("Service account or session changed; review again");
    await sender.assertOwnership(key.buyer, chainId ?? key.sourceChainId);
    if (session.authMode === "wallet") {
      const codes = await Promise.all([
        chain.code(key.sourceChainId, key.buyer),
        chain.code(100, key.buyer),
      ]);
      if (codes.some((code) => code !== "0x"))
        throw new Error("The pilot wallet fallback requires the selected member-owned EOA");
    }
    if (sessionIdentity(deps.session()) !== sessionIdentity(session))
      throw new Error("Service account or session changed; review again");
    return sender;
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
      if (!storage || active.has(scope) || !reconcile) continue;
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
  const execute = async (
    key: ServiceAccessKey,
    action: ServiceAccessAction
  ): Promise<ServiceAccessActionResult> => {
    const route = routeFor(key);
    if (!route)
      throw new Error(
        "Service access unavailable: reviewed deployment, chain and signer configuration required"
      );
    const expectedSession = sessionIdentity(deps.session());
    const routeHash = configIdentity(route);
    const sender = await assertSession(key, expectedSession);
    let snapshot = await read(key, false);
    const call = serviceLiveCall(snapshot, action, route);
    const identity = serviceCallIdentity(call);
    const scope = `green-goods:service-pending:v1:${call.chainId}:${key.buyer.toLowerCase()}`;
    const storage = deps.storage ?? globalThis.localStorage;
    if (!storage) throw new Error("Durable service receipt storage unavailable");
    if (active.has(scope)) throw new Error("Service submission already active");
    active.add(scope);
    let pending: PendingServiceCall | undefined;
    let beforeFailed = false;
    const persist = () => storage.setItem(scope, JSON.stringify(pending));
    const clear = () => {
      storage.removeItem(scope);
      pending = undefined;
    };
    const readback = async (transactionHash: Hex) => {
      if (sender.authMode === "wallet") {
        await verifyWalletExecution(chain, call.chainId!, transactionHash, identity);
      }
      // A mined transfer can leave an intentionally retryable escrow leg. Surface that state as recorded.
      snapshot = await read(key);
      if (
        action.action === "approveVoucherAllowance" ||
        action.action === "revokeVoucherAllowance"
      ) {
        const row = snapshot.voucherSetups.find(
          (v) => "setupId" in action && v.setupId === action.setupId
        );
        const expected =
          action.action === "revokeVoucherAllowance" ? 0n : row?.authorization.voucherUnits;
        if (!row || row.destination?.allowance !== expected)
          throw new Error("Voucher allowance receipt needs reconciliation");
      }
      clear();
      return {
        kind: "onchain" as const,
        observationId: `${call.chainId}:${transactionHash}`,
        transactionHash,
        snapshot,
      };
    };
    try {
      const stored = storage.getItem(scope);
      if (stored) {
        const parsed = parsePending(stored, call.chainId!, key.buyer, routeHash);
        pending = parsed;
        if (!pending.submission) throw new TransactionConfirmationPendingError();
        const result = await reconcileTransaction(sender, pending.submission, async (hash) => {
          const receipt = await chain.receipt(call.chainId!, hash);
          return {
            status: receipt.status === "success" ? "success" : "reverted",
            transactionHash: receipt.transactionHash,
          };
        });
        if (result.status !== "confirmed") {
          if (result.status === "reverted") {
            clear();
            throw new TransactionRevertedError(parsed.submission!.hash);
          }
          throw new TransactionConfirmationPendingError(pending.submission);
        }
        if (parsed.call !== identity)
          throw new Error(
            "A previous service transaction must be reconciled by refreshing before this action"
          );
        return await readback(result.transactionHash);
      }
      const choice = selectServiceAccessAction(snapshot, action);
      if (!choice.allowed) throw new Error(choice.reason ?? "Service action unavailable");
      const assertFresh = async () => {
        await assertSession(key, expectedSession, call.chainId);
        if (routeHash !== configIdentity(route)) throw new Error("Service route revision changed");
        const fresh = await read(key);
        const eligibility = selectServiceAccessAction(fresh, action);
        if (
          !eligibility.allowed ||
          serviceCallIdentity(serviceLiveCall(fresh, action, route)) !== identity
        )
          throw new Error(eligibility.reason ?? "Service state changed; review again");
        if (["approveVoucherAllowance", "presentVoucherSetup"].includes(action.action)) {
          const row = fresh.voucherSetups.find(
            (v) => "setupId" in action && v.setupId === action.setupId
          )!;
          const owner = await chain.read({
            chainId: 100,
            address: row.authorization.token,
            abi: parseAbi(["function owner() view returns (address)"]),
            functionName: "owner",
          });
          if (!same(serviceAddress(owner), row.authorization.issuer))
            throw new Error("Voucher issuer changed");
        }
        if (
          sender.authMode === "wallet" &&
          (await chain.balance(call.chainId!, key.buyer)) <= (call.value ?? 0n)
        )
          throw new Error("The selected member wallet needs native gas on the execution chain");
        await assertSession(key, expectedSession, call.chainId);
      };
      await assertFresh();
      const result = await sender.sendContractCall(call, {
        assertOwnership: assertFresh,
        onBeforeBroadcast: async (reference) => {
          try {
            await assertFresh();
            pending = {
              version: 1,
              route: routeHash,
              call: identity,
              ...(reference
                ? {
                    submission: {
                      hash: reference.hash,
                      sponsored: sender.supportsSponsorship,
                      confirmation: "pending",
                      broadcastReference: reference,
                    },
                  }
                : {}),
            };
            persist();
          } catch (error) {
            beforeFailed = true;
            throw error;
          }
        },
        onBroadcastReference: async (reference) => {
          pending = {
            version: 1,
            route: routeHash,
            call: identity,
            submission: {
              hash: reference.hash,
              sponsored: sender.supportsSponsorship,
              confirmation: "pending",
              broadcastReference: reference,
            },
          };
          persist();
        },
      });
      pending = {
        version: 1,
        route: routeHash,
        call: identity,
        submission: {
          ...result,
          broadcastReference: pending?.submission?.broadcastReference ?? result.broadcastReference,
        },
      };
      persist();
      if (result.confirmation === "pending") throw new TransactionConfirmationPendingError(result);
      const receipt = await chain.receipt(call.chainId!, result.hash);
      if (!same(receipt.transactionHash, result.hash))
        throw new Error("Service receipt transaction identity mismatch");
      if (receipt.status !== "success") throw new TransactionRevertedError(result.hash);
      return await readback(result.hash);
    } catch (error) {
      if (
        beforeFailed ||
        (rejected(error) && !pending?.submission) ||
        error instanceof TransactionRevertedError ||
        error instanceof TransactionReplacementError
      )
        clear();
      throw error;
    } finally {
      active.delete(scope);
    }
  };
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
