/**
 * Commitment reasons
 *
 * Why a commitment was withdrawn, disputed, or settled, in the member's own
 * words. The contract stores only a `reasonCID` (`cancelCommitment`,
 * `raiseDispute`, `resolveDispute`), and the timeline reads the document
 * behind it, so the words have to be pinned before the call and the call must
 * carry the address. Sending the sentence itself in the CID slot stores text
 * nothing can ever resolve.
 *
 * One shape, one version, one place: every surface that takes a reason pins it
 * through here, so a reason written on the phone and one written in the console
 * read back the same way. The document follows the metadata v1 convention
 * (`version` required, unknown fields preserved-but-ignored by readers).
 *
 * @module modules/commitment-pooling/reasons
 */

import type { Address } from "../../types/domain";

/** Bumped only for a change old readers cannot understand. */
export const COMMITMENT_REASON_VERSION = 1;

export interface CommitmentReasonV1 {
  version: number;
  /** One paragraph, in the member's words. Never generated from the record. */
  reason: string;
}

export const MAX_REASON = 2000;

function cleanReason(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const collapsed = value.replace(/\s+/g, " ").trim();
  if (collapsed.length === 0) return null;
  return collapsed.slice(0, MAX_REASON);
}

/**
 * Build the document a reason surface writes.
 *
 * Too long is refused rather than trimmed. What gets pinned becomes the
 * on-chain record of why something happened, and silently dropping the tail
 * would store different words than the member read before they confirmed.
 * Reading is the lenient direction; writing is not.
 */
export function buildCommitmentReason(reason: string): CommitmentReasonV1 {
  const cleaned = cleanReason(reason);
  if (!cleaned) throw new Error("A reason is required");
  if (typeof reason === "string" && reason.replace(/\s+/g, " ").trim().length > MAX_REASON) {
    throw new Error(`A reason must be ${MAX_REASON} characters or fewer`);
  }
  return { version: COMMITMENT_REASON_VERSION, reason: cleaned };
}

/**
 * Read whatever is at a reason CID. Null rather than a throw when the document
 * carries no usable reason: the commitment and its state are still real, and a
 * timeline row without its sentence is better than no timeline.
 */
export function parseCommitmentReason(raw: unknown): CommitmentReasonV1 | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const reason = cleanReason(record.reason);
  if (!reason) return null;
  const version =
    typeof record.version === "number" && Number.isFinite(record.version)
      ? record.version
      : COMMITMENT_REASON_VERSION;
  return { version, reason };
}

/**
 * The pin failed, as distinct from the contract refusing the call. A surface
 * that can tell the two apart keeps the reason on screen and offers to try the
 * pin again, instead of reporting a transaction that was never sent.
 */
export class CommitmentReasonPinError extends Error {
  readonly cause: unknown;

  constructor(cause: unknown) {
    super("commitment_reason_unpinned");
    this.name = "CommitmentReasonPinError";
    this.cause = cause;
  }
}

export function isCommitmentReasonPinError(error: unknown): error is CommitmentReasonPinError {
  return error instanceof CommitmentReasonPinError;
}

/**
 * Pin a reason and return its CID.
 *
 * The upload module is imported on demand, the way the queue's metadata publish
 * does it, so a surface that only reads reasons never pays for the pinning
 * client. Content addressing makes a retry cheap: identical words pin to the
 * identical CID.
 */
export async function pinCommitmentReason(input: {
  reason: string;
  gardenAddress?: Address | null;
  /** Which surface is pinning, for upload tracking. */
  source: string;
}): Promise<string> {
  const document = buildCommitmentReason(input.reason);
  try {
    const { uploadJSONToIPFS } = await import("../data/ipfs/upload");
    const { cid } = await uploadJSONToIPFS(document as unknown as Record<string, unknown>, {
      source: `commitment-reason:${input.source}`,
      gardenAddress: input.gardenAddress ?? undefined,
      metadataType: "commitment-reason",
    });
    return cid;
  } catch (error) {
    throw new CommitmentReasonPinError(error);
  }
}
