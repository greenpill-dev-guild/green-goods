/**
 * Commitment metadata
 *
 * What a commitment is called, in the member's own words. The contract stores
 * only a CID; the words live off-chain, so this module owns the shape written
 * there and the parsing of whatever comes back.
 *
 * The shape is the app-layer contract's metadata JSON v1 (contract-spec §6
 * addendum 2026-08-11): `version` required, every other field optional,
 * unknown fields preserved-but-ignored by readers. The composer's free text is
 * the schema's `note`; an earlier build wrote it as `description`, which the
 * reader still understands.
 *
 * Parsing is deliberately forgiving. A commitment whose metadata is missing,
 * unreachable, or malformed is still a real commitment with real obligations,
 * so it must keep rendering, just without a title. Throwing here would take a
 * screen down over a caption.
 *
 * @module modules/commitment-pooling/metadata
 */

/** Bumped only for a change old readers cannot understand. */
export const COMMITMENT_METADATA_VERSION = 1;

export interface CommitmentMetadataLink {
  url: string;
  label?: string;
}

export interface CommitmentMetadataV1 {
  version: number;
  /** One line, in the member's words. Never generated from the record. */
  title: string;
  /** Optional context. Absent is ordinary, not an error. */
  note?: string;
  /** Web addresses that belong with it. */
  links?: CommitmentMetadataLink[];
}

const MAX_TITLE = 120;
const MAX_NOTE = 2000;
const MAX_LINKS = 10;
const MAX_LINK_LABEL = 120;

function cleanLine(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  // Collapse newlines so a pasted paragraph cannot break a single-line row.
  const collapsed = value.replace(/\s+/g, " ").trim();
  if (collapsed.length === 0) return null;
  return collapsed.slice(0, max);
}

/** Only web addresses travel: anything else is not a link a reader may follow. */
function cleanLink(value: unknown): CommitmentMetadataLink | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (typeof record.url !== "string") return null;
  const url = record.url.trim();
  if (!/^https?:\/\/\S+$/i.test(url)) return null;
  const label = cleanLine(record.label, MAX_LINK_LABEL);
  return label ? { url, label } : { url };
}

function cleanLinks(value: unknown): CommitmentMetadataLink[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(cleanLink)
    .filter((link): link is CommitmentMetadataLink => link !== null)
    .slice(0, MAX_LINKS);
}

/** Build the object the composer writes. */
export function buildCommitmentMetadata(input: {
  title: string;
  note?: string;
  links?: CommitmentMetadataLink[];
}): CommitmentMetadataV1 {
  const title = cleanLine(input.title, MAX_TITLE);
  if (!title) throw new Error("A commitment needs a title");
  const note = cleanLine(input.note, MAX_NOTE);
  const links = cleanLinks(input.links);
  return {
    version: COMMITMENT_METADATA_VERSION,
    title,
    ...(note ? { note } : {}),
    ...(links.length > 0 ? { links } : {}),
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
  // `note` is the schema's word; `description` is what an earlier build wrote.
  const note = cleanLine(record.note, MAX_NOTE) ?? cleanLine(record.description, MAX_NOTE);
  const links = cleanLinks(record.links);
  const version =
    typeof record.version === "number" && Number.isFinite(record.version)
      ? record.version
      : COMMITMENT_METADATA_VERSION;
  return {
    version,
    title,
    ...(note ? { note } : {}),
    ...(links.length > 0 ? { links } : {}),
  };
}

/** A CID worth spending a request on. Empty and placeholder values are not. */
export function isResolvableMetadataCID(cid: string | null | undefined): cid is string {
  if (!cid) return false;
  const trimmed = cid.trim();
  if (trimmed.length === 0) return false;
  return trimmed !== "0" && trimmed !== "-";
}
