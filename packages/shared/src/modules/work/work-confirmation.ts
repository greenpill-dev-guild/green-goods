import { parseContractError } from "../../utils/errors/contract-errors";
import { WorkSubmissionError } from "./wallet-submission/types";
import { connectivityStore } from "../../stores/connectivity";
import { parseEventLogs, type Hex, type Log } from "viem";
import type { BroadcastReference } from "../transactions/types";
import { getTransactionReceipt, readContract } from "@wagmi/core";
import { getEASConfig, type EASConfig } from "../../config/blockchain";
import { EASABI } from "../../utils/blockchain/contracts";
import type { Work } from "../../types/domain";
import type { Job, WorkJobPayload } from "../../types/job-queue";
import { getWagmiConfig } from "../../config/appkit";
import { claimWorkJobs, type WorkClaimOptions } from "./execution-state";

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

interface ConfirmedAttestation {
  uid: Hex;
  schema: Hex;
  recipient: string;
  attester: string;
  data: Hex;
  time: bigint;
}

interface ConfirmedWorkReads {
  easConfig?: EASConfig;
  receipt?: (hash: Hex, chainId: number) => Promise<{ status: string; logs: Log[] }>;
  attestation?: (uid: Hex, chainId: number) => Promise<ConfirmedAttestation>;
}

/**
 * A card belongs to the exact uploaded bytes in a successful receipt. Matching
 * only garden/schema would assign the wrong UID when Upload all batches work.
 */
export async function readConfirmedWork(
  job: Job<WorkJobPayload>,
  hash: Hex,
  chainId: number,
  reads: ConfirmedWorkReads = {}
): Promise<Work | undefined> {
  const published = job.payload.uploadCheckpoint?.published;
  if (!published) return undefined; // Older jobs wait for their indexed row.
  if (
    (job.chainId !== undefined && job.chainId !== chainId) ||
    (job.payload.clientWorkId && published.metadata.clientWorkId !== job.payload.clientWorkId)
  )
    throw new AwaitingWorkConfirmation(hash);

  const eas = reads.easConfig ?? getEASConfig(chainId);
  try {
    const receipt = await (
      reads.receipt ??
      ((hash, chainId) => getTransactionReceipt(getWagmiConfig(), { hash, chainId }))
    )(hash, chainId);
    if (receipt.status === "reverted") throw new WorkTransactionReverted(hash);
    if (receipt.status !== "success") throw new AwaitingWorkConfirmation(hash);
    const events = parseEventLogs({ abi: EASABI, eventName: "Attested", logs: receipt.logs });
    const candidates = events.filter((event) => {
      const args = event.args as { recipient: string; attester: string; schemaUID: string };
      return (
        event.address.toLowerCase() === eas.EAS.address.toLowerCase() &&
        args.recipient.toLowerCase() === job.payload.gardenAddress.toLowerCase() &&
        args.attester.toLowerCase() === job.userAddress.toLowerCase() &&
        args.schemaUID.toLowerCase() === eas.WORK.uid.toLowerCase()
      );
    });
    const matches = await Promise.all(
      candidates.map(async (event) => {
        const uid = (event.args as { uid: Hex }).uid;
        const attestation = await (
          reads.attestation ??
          (async (uid, chainId) =>
            (await readContract(getWagmiConfig(), {
              chainId,
              address: eas.EAS.address as `0x${string}`,
              abi: EASABI,
              functionName: "getAttestation",
              args: [uid],
            })) as ConfirmedAttestation)
        )(uid, chainId);
        return attestation.uid.toLowerCase() === uid.toLowerCase() &&
          attestation.data.toLowerCase() === published.data.toLowerCase() &&
          attestation.schema.toLowerCase() === eas.WORK.uid.toLowerCase() &&
          attestation.recipient.toLowerCase() === job.payload.gardenAddress.toLowerCase() &&
          attestation.attester.toLowerCase() === job.userAddress.toLowerCase()
          ? attestation
          : undefined;
      })
    );
    const exact = matches.filter((row): row is ConfirmedAttestation => row !== undefined);
    if (exact.length !== 1) throw new AwaitingWorkConfirmation(hash);
    const attestation = exact[0];
    return {
      id: attestation.uid.toLowerCase(),
      gardenerAddress: job.userAddress,
      gardenAddress: job.payload.gardenAddress,
      actionUID: job.payload.actionUID,
      title:
        typeof published.metadata.title === "string"
          ? published.metadata.title
          : (job.payload.title ?? ""),
      feedback: job.payload.feedback,
      metadata: JSON.stringify(published.metadata),
      media: published.media,
      createdAt: Number(attestation.time),
      status: "pending",
    };
  } catch (error) {
    if (error instanceof WorkTransactionReverted) throw error;
    // The send already landed or may have landed. Keep its job for a receipt
    // reprobe; a failed read must neither erase the preview nor resend it.
    throw new AwaitingWorkConfirmation(hash);
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
  replacements.delete(id);
}

// A replaced transaction, remembered before its mark is written, so storage
// that refuses the mark does not leave the send waiting for good this session.
const replacements = new Set<string>();
export function rememberTransactionReplaced(id: string) {
  replacements.add(id);
}
export function retainedTransactionReplaced(id: string) {
  return replacements.has(id);
}

export { claimWorkJobs } from "./execution-state";

/** Cross-tab claims share the queue database; a persisted signing intent handles crash ambiguity. */
export async function acquireWorkJobs(
  ids: string[],
  options: WorkClaimOptions = {}
): Promise<{
  token: string;
  assertOwned: () => Promise<void>;
  release: () => Promise<void>;
} | null> {
  const localRelease = claimWorkJobs(ids, options);
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
    token,
    assertOwned: async () => {
      if (!(await jobQueueDB.renewExecutionClaim(ids, token)))
        throw new Error("submission-ownership-changed");
    },
    // The stored claim goes first. The in-memory one is what holds back an app update, and a
    // restart that landed while the stored claim was still on disk would leave it to shut this
    // job out of the next page until it expired.
    release: async () => {
      try {
        await jobQueueDB.releaseExecutionClaim(ids, token);
      } finally {
        localRelease();
      }
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

/**
 * Wallet adapters often wrap a rejection several causes deep. A dismissed
 * passkey prompt surfaces as WebAuthn's `NotAllowedError`, which the spec also
 * uses for a timed-out prompt: either way nothing was signed.
 */
export function isWorkSubmissionCancelled(error: unknown): boolean {
  const seen = new Set<object>();
  let cause = error;
  while (cause && typeof cause === "object" && !seen.has(cause)) {
    seen.add(cause);
    if (
      ("code" in cause && Number(cause.code) === 4001) ||
      ("name" in cause &&
        (cause.name === "AbortError" ||
          cause.name === "NotAllowedError" ||
          cause.name === "UserRejectedRequestError"))
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
