import { parseContractError } from "../../utils/errors/contract-errors";
import { WorkSubmissionError } from "./wallet-submission/types";
import { connectivityStore } from "../../stores/connectivity";
import type { Hex } from "viem";
import type { BroadcastReference } from "../transactions/types";
import { getTransactionReceipt } from "@wagmi/core";
import { getWagmiConfig } from "../../config/appkit";
import { claimWorkJobs } from "./execution-state";

type WorkConfirmation = "confirmed" | "reverted" | "unresolved";
export class AwaitingWorkConfirmation extends Error {
  constructor(readonly hash: Hex) {
    super("awaiting-confirmation");
  }
}
export class WorkTransactionReverted extends Error {
  constructor(readonly hash: Hex) {
    super("work-transaction-reverted");
  }
}

/** Missing receipts and opaque wallet IDs never establish successful Work. */
export async function reconcileWorkTransaction(
  hash: Hex,
  chainId: number,
  read: () => Promise<{ status: string }> = () =>
    getTransactionReceipt(getWagmiConfig(), { hash, chainId })
): Promise<WorkConfirmation> {
  if (!/^0x[\da-f]{64}$/i.test(hash)) return "unresolved";
  if (typeof navigator !== "undefined" && !connectivityStore.getSnapshot()) return "unresolved";
  try {
    const receipt = await read();
    return receipt.status === "success"
      ? "confirmed"
      : receipt.status === "reverted"
        ? "reverted"
        : "unresolved";
  } catch {
    return "unresolved";
  }
}

// Retain a broadcast when storage rejects its checkpoint. Never let an in-session retry resend it.
const broadcasts = new Map<string, BroadcastReference>();
export function rememberWorkBroadcast(id: string, reference: Hex | BroadcastReference) {
  broadcasts.set(
    id,
    typeof reference === "string" ? { kind: "transaction", hash: reference } : reference
  );
}
export function retainedWorkBroadcast(id: string) {
  return broadcasts.get(id)?.hash;
}
export function retainedWorkBroadcastReference(id: string) {
  return broadcasts.get(id);
}
export function forgetWorkBroadcast(id: string) {
  broadcasts.delete(id);
}

export { claimWorkJobs } from "./execution-state";

/** Cross-tab claims share the queue database; a persisted signing intent handles crash ambiguity. */
export async function acquireWorkJobs(ids: string[]): Promise<{
  assertOwned: () => Promise<void>;
  release: () => Promise<void>;
} | null> {
  const localRelease = claimWorkJobs(ids);
  if (!localRelease) return null;
  const { jobQueueDB } = await import("../job-queue/db");
  const token = crypto.randomUUID();
  try {
    if (!(await jobQueueDB.acquireExecutionClaim(ids, token))) {
      localRelease();
      return null;
    }
  } catch (error) {
    localRelease();
    throw error;
  }
  return {
    assertOwned: async () => {
      if (!(await jobQueueDB.renewExecutionClaim(ids, token)))
        throw new Error("submission-ownership-changed");
    },
    release: async () => {
      localRelease();
      await jobQueueDB.releaseExecutionClaim(ids, token);
    },
  };
}

/** Legacy passkey hashes need both an exact Work identity and its event in this receipt. */
export async function reconcileLegacyPasskeyWork(
  hash: Hex,
  job: import("../../types/job-queue").Job<import("../../types/job-queue").WorkJobPayload>,
  chainId: number
): Promise<WorkConfirmation> {
  try {
    const receipt = await getTransactionReceipt(getWagmiConfig(), { hash, chainId });
    if (receipt.status === "reverted") return "reverted";
    if (receipt.status !== "success" || !job.payload.clientWorkId) return "unresolved";
    const { resolveDeferredWorkIdentity } = await import("../commitment-pooling/work-identity");
    const identity = await resolveDeferredWorkIdentity({
      clientWorkId: job.payload.clientWorkId,
      chainId,
      garden: job.payload.gardenAddress,
      caller: job.userAddress,
    });
    if (identity.status !== "resolved") return "unresolved";
    const { getEASConfig } = await import("../../config/blockchain");
    const { decodeEventLog, parseAbiItem } = await import("viem");
    const config = getEASConfig(chainId);
    return receipt.logs.some((log) => {
      if (log.address.toLowerCase() !== config.EAS.address.toLowerCase()) return false;
      try {
        const { args } = decodeEventLog({
          abi: [
            parseAbiItem(
              "event Attested(address indexed recipient, address indexed attester, bytes32 uid, bytes32 indexed schemaUID)"
            ),
          ],
          data: log.data,
          topics: log.topics,
        });
        return (
          args.uid === identity.workUID &&
          args.schemaUID === config.WORK.uid &&
          args.recipient.toLowerCase() === job.payload.gardenAddress.toLowerCase() &&
          args.attester.toLowerCase() === job.userAddress.toLowerCase()
        );
      } catch {
        return false;
      }
    })
      ? "confirmed"
      : "unresolved";
  } catch {
    return "unresolved";
  }
}

/** Wallet adapters often wrap a rejection several causes deep. */
export function isWorkSubmissionCancelled(error: unknown): boolean {
  const seen = new Set<object>();
  let cause = error;
  while (cause && typeof cause === "object" && !seen.has(cause)) {
    seen.add(cause);
    if (
      ("code" in cause && Number(cause.code) === 4001) ||
      ("name" in cause &&
        (cause.name === "AbortError" || cause.name === "UserRejectedRequestError"))
    )
      return true;
    cause = "cause" in cause ? cause.cause : undefined;
  }
  return false;
}

/** Genuine connectivity failures may fall back to the durable queue. */
export function isNetworkError(error: unknown): boolean {
  const reason = error instanceof Error && error.cause ? error.cause : error;
  if (
    reason &&
    typeof reason === "object" &&
    (("name" in reason && reason.name === "AbortError") ||
      ("code" in reason && reason.code === 4001))
  )
    return false;
  if (error instanceof WorkSubmissionError && error.phase === "upload") {
    const cause = error.cause;
    const status =
      cause && typeof cause === "object" && "status" in cause ? Number(cause.status) : 0;
    const message =
      cause instanceof Error ? cause.message.toLowerCase() : error.message.toLowerCase();
    return (
      [408, 429].includes(status) ||
      status >= 500 ||
      /network|fetch|timeout|timed out|socket|connection|gateway|\b408\b|\b429\b|\b5\d\d\b/.test(
        message
      )
    );
  }

  const originalError =
    error instanceof Error && error.cause instanceof Error ? error.cause : error;
  if (parseContractError(originalError).name === "WalletRequestExpired") {
    return false;
  }

  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    message.includes("network") ||
    message.includes("fetch") ||
    message.includes("timeout") ||
    message.includes("socket") ||
    message.includes("connection") ||
    message.includes("gateway")
  );
}
