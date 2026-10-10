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

/**
 * The set a commitment was created in, when a steward created several copies at
 * once. Every copy of a set carries the same id, which is how the pool shows
 * them as one group. It is a display hint and nothing more: each copy is still
 * its own commitment, and the chain never reads this.
 */
export interface CommitmentDisplayGroup {
  version: typeof COMMITMENT_DISPLAY_GROUP_VERSION;
  /** Minted once per set. Opaque: compare it, never parse it. */
  id: string;
}

export const COMMITMENT_DISPLAY_GROUP_VERSION = 1 as const;

/**
 * The reward as the steward set it (PRD-1022 D13): the dollars they typed and
 * the G$ amount those became at the rate read at Create. The chain keeps only
 * the G$ amount, and the G$ price moves, so this is how a reward can still read
 * "$5.00" later. It holds only while the chain's amount is still this one: an
 * Edit Reward changes the amount and not this record. Decimal strings, since
 * the document is JSON.
 */
export interface CommitmentRewardRecord {
  version: typeof COMMITMENT_REWARD_RECORD_VERSION;
  usdCents: string;
  goodDollarWei: string;
}

export const COMMITMENT_REWARD_RECORD_VERSION = 1 as const;

export interface CommitmentMetadataV1 {
  version: number;
  /** One line, in the member's words. Never generated from the record. */
  title: string;
  /** Optional context. Absent is ordinary, not an error. */
  note?: string;
  /** Web addresses that belong with it. */
  links?: CommitmentMetadataLink[];
  /** The set it was created in, when there was one. */
  displayGroup?: CommitmentDisplayGroup;
  /** The reward in the dollars it was set in, when it was set in dollars. */
  reward?: CommitmentRewardRecord;
}

/**
 * The longest title a commitment can be written with, in characters. A promise
 * card cuts a title off at about 34 characters, so 60 leaves room for a real
 * sentence and still ends predictably. Both composers stop there, and
 * `buildCommitmentMetadata` refuses anything longer rather than cutting it.
 */
export const COMMITMENT_TITLE_MAX_LENGTH = 60;

/** The longest note, in characters. Same rule as the title. */
export const COMMITMENT_NOTE_MAX_LENGTH = 280;

/**
 * The longest unit label ("rides", "hours"), in characters. The label is not
 * in this document: the contract stores it on-chain, at any length. It is
 * written beside the title, though, so its limit lives beside theirs, and the
 * composer schema is what holds both composers to it.
 */
export const COMMITMENT_UNIT_LABEL_MAX_LENGTH = 24;

/**
 * The suggestions both composers offer beside their free fields: the units a
 * service is usually counted in, common counts, common hour totals for garden
 * work, and common spans in days. A chip stores the words it shows.
 */
export const COMMITMENT_UNIT_CHOICES = ["hours", "sessions", "rides", "meals", "repairs"] as const;
export const COMMITMENT_COUNT_CHOICES = [1, 2, 3, 4, 6] as const;
export const COMMITMENT_HOUR_CHOICES = [1, 2, 4, 6, 12] as const;
export const COMMITMENT_DAY_CHOICES = [7, 14, 30] as const;

/**
 * Metadata written before the limits could hold a 120-character title and a
 * 2,000-character note. Readers keep that tolerance, so an older commitment
 * still reads in full.
 */
const TITLE_READ_TOLERANCE = 120;
const NOTE_READ_TOLERANCE = 2000;
const MAX_LINKS = 10;
const MAX_LINK_LABEL = 120;

/** Whitespace collapsed to single spaces, then trimmed; null when nothing is left. */
function collapseLine(value: unknown): string | null {
  if (typeof value !== "string") return null;
  // Collapse newlines so a pasted paragraph cannot break a single-line row.
  const collapsed = value.replace(/\s+/g, " ").trim();
  return collapsed.length > 0 ? collapsed : null;
}

function cleanLine(value: unknown, max: number): string | null {
  return collapseLine(value)?.slice(0, max) ?? null;
}

/** The collapsed text, refused rather than cut when it runs past `max`. */
function lineWithin(value: unknown, max: number, what: string): string | null {
  const line = collapseLine(value);
  if (line && line.length > max) {
    throw new Error(
      `A commitment's ${what} can be at most ${max} characters; this one has ${line.length}`
    );
  }
  return line;
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

/** What a set's id may look like: a UUID fits, and nothing a reader could take for markup. */
const DISPLAY_GROUP_ID = /^[A-Za-z0-9_-]{8,64}$/;

/**
 * A display group this reader understands, or null. A later version is read as
 * no group at all, so its copies show as ordinary commitments rather than being
 * grouped by rules this build doesn't know.
 */
function cleanDisplayGroup(value: unknown): CommitmentDisplayGroup | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (record.version !== COMMITMENT_DISPLAY_GROUP_VERSION) return null;
  if (typeof record.id !== "string" || !DISPLAY_GROUP_ID.test(record.id)) return null;
  return { version: COMMITMENT_DISPLAY_GROUP_VERSION, id: record.id };
}

/** A positive whole number, as a decimal string without a sign or leading zeros. */
const POSITIVE_WHOLE = /^[1-9]\d{0,77}$/;

/** A reward record this reader understands, or null; a later version reads as none. */
function cleanRewardRecord(value: unknown): CommitmentRewardRecord | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (record.version !== COMMITMENT_REWARD_RECORD_VERSION) return null;
  const { usdCents, goodDollarWei } = record;
  if (typeof usdCents !== "string" || !POSITIVE_WHOLE.test(usdCents)) return null;
  if (typeof goodDollarWei !== "string" || !POSITIVE_WHOLE.test(goodDollarWei)) return null;
  return { version: COMMITMENT_REWARD_RECORD_VERSION, usdCents, goodDollarWei };
}

/**
 * The cents a reward was set in, while the chain still holds the G$ amount they
 * became; null once it doesn't (after an Edit Reward) or when it was never set
 * in dollars. The caller then shows today's rate, as an estimate.
 */
export function rewardCentsAsSet(
  metadata: Pick<CommitmentMetadataV1, "reward"> | null | undefined,
  goodDollarWei: bigint | null | undefined
): bigint | null {
  const reward = metadata?.reward;
  if (!reward || goodDollarWei === null || goodDollarWei === undefined) return null;
  return BigInt(reward.goodDollarWei) === goodDollarWei ? BigInt(reward.usdCents) : null;
}

/** Build the object the composer writes. */
export function buildCommitmentMetadata(input: {
  title: string;
  note?: string;
  links?: CommitmentMetadataLink[];
  displayGroup?: CommitmentDisplayGroup;
  reward?: CommitmentRewardRecord;
}): CommitmentMetadataV1 {
  const title = lineWithin(input.title, COMMITMENT_TITLE_MAX_LENGTH, "title");
  if (!title) throw new Error("A commitment needs a title");
  const note = lineWithin(input.note, COMMITMENT_NOTE_MAX_LENGTH, "note");
  const links = cleanLinks(input.links);
  const displayGroup = input.displayGroup ? cleanDisplayGroup(input.displayGroup) : null;
  // Refused rather than dropped: a copy written without its group would show
  // on its own, apart from the set it was made with.
  if (input.displayGroup && !displayGroup) throw new Error("That display group id is not valid");
  const reward = input.reward ? cleanRewardRecord(input.reward) : null;
  if (input.reward && !reward) throw new Error("That reward record is not valid");
  return {
    version: COMMITMENT_METADATA_VERSION,
    title,
    ...(note ? { note } : {}),
    ...(links.length > 0 ? { links } : {}),
    ...(displayGroup ? { displayGroup } : {}),
    ...(reward ? { reward } : {}),
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
  const title = cleanLine(record.title, TITLE_READ_TOLERANCE);
  if (!title) return null;
  // `note` is the schema's word; `description` is what an earlier build wrote.
  const note =
    cleanLine(record.note, NOTE_READ_TOLERANCE) ??
    cleanLine(record.description, NOTE_READ_TOLERANCE);
  const links = cleanLinks(record.links);
  const displayGroup = cleanDisplayGroup(record.displayGroup);
  const reward = cleanRewardRecord(record.reward);
  const version =
    typeof record.version === "number" && Number.isFinite(record.version)
      ? record.version
      : COMMITMENT_METADATA_VERSION;
  return {
    version,
    title,
    ...(note ? { note } : {}),
    ...(links.length > 0 ? { links } : {}),
    ...(displayGroup ? { displayGroup } : {}),
    ...(reward ? { reward } : {}),
  };
}

/** A CID worth spending a request on. Empty and placeholder values are not. */
export function isResolvableMetadataCID(cid: string | null | undefined): cid is string {
  if (!cid) return false;
  const trimmed = cid.trim();
  if (trimmed.length === 0) return false;
  return trimmed !== "0" && trimmed !== "-";
}
