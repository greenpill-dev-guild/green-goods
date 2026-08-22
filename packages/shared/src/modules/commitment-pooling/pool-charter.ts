/**
 * Pool charter
 *
 * What a pool is for, in the steward's own sentence. The contract stores only a
 * `charterCID` (`setPoolCharter`), the pool card reads the sentence behind it,
 * and readiness requires one to exist (`OpenCommitmentCapRequired` is the
 * cap's half of the same gate). So the words are pinned before the call and
 * the call carries the address.
 *
 * One shape, one version, one place: every surface that writes a charter pins
 * it through here. The document follows the metadata v1 convention (`version`
 * required, unknown fields preserved-but-ignored by readers), the way
 * commitment metadata, cycle metadata and reasons do.
 *
 * @module modules/commitment-pooling/pool-charter
 */

import type { Address } from "../../types/domain";

/** Bumped only for a change old readers cannot understand. */
export const POOL_CHARTER_VERSION = 1;

export interface PoolCharterV1 {
  version: number;
  /** One paragraph: what this pool is for. Never generated from the record. */
  purpose: string;
}

const MAX_PURPOSE = 2000;

function cleanPurpose(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const collapsed = value.replace(/\s+/g, " ").trim();
  if (collapsed.length === 0) return null;
  return collapsed.slice(0, MAX_PURPOSE);
}

/** Build the document a charter surface writes. */
export function buildPoolCharter(input: { purpose: string }): PoolCharterV1 {
  const purpose = cleanPurpose(input.purpose);
  if (!purpose) throw new Error("A charter needs a purpose");
  return { version: POOL_CHARTER_VERSION, purpose };
}

/**
 * Read whatever is at a charter CID. Null rather than a throw when the
 * document carries no usable purpose: the pool and its state are still real,
 * and a card without its sentence is better than no card.
 */
export function parsePoolCharter(raw: unknown): PoolCharterV1 | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const purpose = cleanPurpose(record.purpose);
  if (!purpose) return null;
  const version =
    typeof record.version === "number" && Number.isFinite(record.version)
      ? record.version
      : POOL_CHARTER_VERSION;
  return { version, purpose };
}

/**
 * The pin failed, as distinct from the contract refusing the call. A setup
 * flow that can tell the two apart keeps the step open with what was typed and
 * offers to pin again, instead of reporting a transaction that was never sent.
 * Shared by the charter and the cycle-name document so one flow handles both.
 */
export class PoolDocumentPinError extends Error {
  readonly cause: unknown;
  readonly document: "charter" | "cycle";

  constructor(document: "charter" | "cycle", cause: unknown) {
    super(`commitment_pool_document_unpinned:${document}`);
    this.name = "PoolDocumentPinError";
    this.document = document;
    this.cause = cause;
  }
}

export function isPoolDocumentPinError(error: unknown): error is PoolDocumentPinError {
  return error instanceof PoolDocumentPinError;
}

/**
 * Pin a charter and return its CID.
 *
 * The upload module is imported on demand, the way reasons and the queue's
 * metadata publish do it, so a surface that only reads charters never pays
 * for the pinning client. Content addressing makes a retry cheap: identical
 * words pin to the identical CID.
 */
export async function pinPoolCharter(input: {
  purpose: string;
  gardenAddress?: Address | null;
}): Promise<string> {
  const document = buildPoolCharter(input);
  try {
    const { uploadJSONToIPFS } = await import("../data/ipfs/upload");
    const { cid } = await uploadJSONToIPFS(document as unknown as Record<string, unknown>, {
      source: "commitment-pool-charter",
      gardenAddress: input.gardenAddress ?? undefined,
      metadataType: "commitment-pool-charter",
    });
    return cid;
  } catch (error) {
    throw new PoolDocumentPinError("charter", error);
  }
}
