import { type Hex, keccak256, parseAbi, stringToHex } from "viem";
import type { Address } from "../../types/domain";
import { reconcileTransaction } from "../transactions/confirmation";
import {
  TransactionConfirmationPendingError,
  TransactionReplacementError,
  TransactionRevertedError,
  type TransactionSender,
  type TxResult,
} from "../transactions/types";
import { selectServiceAccessAction } from "./service-access";
import { serviceAddress } from "./service-access-chain-values";
import type { ServiceLiveSession } from "./service-access-live";
import type { ServiceLiveChain } from "./service-access-live-chain";
import { serviceCallIdentity, serviceLiveCall } from "./service-access-live-commands";
import type { ServiceLiveRoute } from "./service-access-live-config";
import type {
  ServiceAccessAction,
  ServiceAccessActionResult,
  ServiceAccessKey,
  ServiceAccessSnapshot,
} from "./service-access-types";

interface ServiceSubmissionContext {
  session(): ServiceLiveSession;
  storage(): Pick<Storage, "getItem" | "setItem" | "removeItem"> | undefined;
  chain: ServiceLiveChain;
  /** `fresh` proves the route from the chain again instead of reusing a recent proof. */
  read(key: ServiceAccessKey, reconcile?: boolean, fresh?: boolean): Promise<ServiceAccessSnapshot>;
  assertSession(
    key: ServiceAccessKey,
    expected?: string,
    chainId?: number
  ): Promise<TransactionSender>;
}
interface PendingServiceCall {
  version: 1;
  route: string;
  call: string;
  submission?: TxResult;
}

const same = (a: string | null | undefined, b: string | null | undefined) =>
  !!a && !!b && a.toLowerCase() === b.toLowerCase();
const active = new Set<string>();
export function parsePending(
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
export async function verifyWalletExecution(
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
export function sessionIdentity(s: ServiceLiveSession) {
  return `${s.authMode}:${s.address?.toLowerCase()}:${s.profile}:${s.generation}`;
}
export function configIdentity(route: ServiceLiveRoute) {
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

export const hasActiveServiceSubmission = (scope: string) => active.has(scope);

export async function executeLiveServiceCall(
  key: ServiceAccessKey,
  action: ServiceAccessAction,
  route: ServiceLiveRoute | undefined,
  context: ServiceSubmissionContext
): Promise<ServiceAccessActionResult> {
  const { chain, read, assertSession } = context;
  if (!route)
    throw new Error(
      "Service access unavailable: reviewed deployment, chain and signer configuration required"
    );
  const expectedSession = sessionIdentity(context.session());
  const routeHash = configIdentity(route);
  const sender = await assertSession(key, expectedSession);
  let snapshot = await read(key, false);
  const call = serviceLiveCall(snapshot, action, route);
  const identity = serviceCallIdentity(call);
  const scope = `green-goods:service-pending:v1:${call.chainId}:${key.buyer.toLowerCase()}`;
  const storage = context.storage();
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
    if (action.action === "approveVoucherAllowance" || action.action === "revokeVoucherAllowance") {
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
    const assertFresh = async (beforeBroadcast = false) => {
      await assertSession(key, expectedSession, call.chainId);
      if (routeHash !== configIdentity(route)) throw new Error("Service route revision changed");
      const fresh = await read(key, true, beforeBroadcast);
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
      assertOwnership: () => assertFresh(),
      onBeforeBroadcast: async (reference) => {
        try {
          await assertFresh(true);
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
}
