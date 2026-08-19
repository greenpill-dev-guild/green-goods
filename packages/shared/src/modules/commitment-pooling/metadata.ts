/**
 * Commitment metadata
 *
 * What a commitment is called, in the member's own words. The contract stores
 * only a CID; the words live off-chain, so this module owns the shape written
 * there and the parsing of whatever comes back.
 *
 * Parsing is deliberately forgiving. A commitment whose metadata is missing,
 * unreachable, or malformed is still a real commitment with real obligations,
 * so it must keep rendering — just without a title. Throwing here would take a
 * screen down over a caption.
 *
 * @module modules/commitment-pooling/metadata
 */

/** Bumped only for a change old readers cannot understand. */
export const COMMITMENT_METADATA_VERSION = 1;

export interface CommitmentMetadataV1 {
  version: number;
  /** One line, in the member's words. Never generated from the record. */
  title: string;
  /** Optional context. Absent is ordinary, not an error. */
  description?: string;
}

const MAX_TITLE = 120;
const MAX_DESCRIPTION = 2000;

function cleanLine(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  // Collapse newlines so a pasted paragraph cannot break a single-line row.
  const collapsed = value.replace(/\s+/g, " ").trim();
  if (collapsed.length === 0) return null;
  return collapsed.slice(0, max);
}

/** Build the object the composer writes. */
export function buildCommitmentMetadata(input: {
  title: string;
  description?: string;
}): CommitmentMetadataV1 {
  const title = cleanLine(input.title, MAX_TITLE);
  if (!title) throw new Error("A commitment needs a title");
  const description = cleanLine(input.description, MAX_DESCRIPTION);
  return {
    version: COMMITMENT_METADATA_VERSION,
    title,
    ...(description ? { description } : {}),
  };
}

/**
 * Read whatever is at the CID.
 *
 * Returns null rather than throwing when there is no usable title, so callers
 * fall back to describing the commitment by its units instead of rendering an
 * empty heading.
 */
export function parseCommitmentMetadata(raw: unknown): CommitmentMetadataV1 | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const title = cleanLine(record.title, MAX_TITLE);
  if (!title) return null;
  const description = cleanLine(record.description, MAX_DESCRIPTION);
  const version =
    typeof record.version === "number" && Number.isFinite(record.version)
      ? record.version
      : COMMITMENT_METADATA_VERSION;
  return { version, title, ...(description ? { description } : {}) };
}

/** A CID worth spending a request on. Empty and placeholder values are not. */
export function isResolvableMetadataCID(cid: string | null | undefined): cid is string {
  if (!cid) return false;
  const trimmed = cid.trim();
  if (trimmed.length === 0) return false;
  return trimmed !== "0" && trimmed !== "-";
}
