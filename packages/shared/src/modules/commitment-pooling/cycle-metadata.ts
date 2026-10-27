import type { Address } from "../../types/domain";
import { logger } from "../app/logger";
import { commitmentDocumentStore, type CommitmentDocumentStore } from "./document-store";
import { PoolDocumentPinError } from "./pool-charter";

export const CYCLE_METADATA_VERSION = 1;

export interface CycleMetadataV1 {
  version: 1;
  name: string;
  /**
   * A campaign's brief note (PRD-1299, SBrief): how its separate promises fit together, in its
   * stewards' words. Presentation only: the core has no brief object, nothing pays out as a
   * team, and no promise waits on another because of it.
   */
  brief?: string;
}

export type CycleMetadataNameResolution =
  | { status: "missing"; name: null }
  | { status: "resolved"; name: string; brief?: string }
  | { status: "unavailable"; name: null };

/**
 * The longest name a season or campaign can be given, in characters. The
 * admin field stops there and counts toward it; `buildCycleMetadata` refuses
 * anything longer rather than cutting it.
 */
export const CYCLE_NAME_MAX_LENGTH = 120;

/** The longest brief note a campaign reads, in characters; a longer one reads cut to it. */
const CYCLE_BRIEF_MAX_LENGTH = 1000;

/** Each line's whitespace collapsed and trimmed, blank lines dropped; null when nothing is left. */
function collapseCycleBrief(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const lines = value
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  return lines.length > 0 ? lines.join("\n").slice(0, CYCLE_BRIEF_MAX_LENGTH) : null;
}

/** Whitespace collapsed to single spaces, then trimmed; null when nothing is left. */
function collapseCycleName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.replace(/\s+/g, " ").trim();
  return name.length > 0 ? name : null;
}

/**
 * Read a cycle's name document. A name past the limit, written by something
 * other than `buildCycleMetadata`, reads cut to it rather than not at all.
 */
export function parseCycleMetadata(raw: unknown): CycleMetadataV1 | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const name = collapseCycleName(record.name)?.slice(0, CYCLE_NAME_MAX_LENGTH);
  const brief = collapseCycleBrief(record.brief);
  return record.version === CYCLE_METADATA_VERSION && name
    ? { version: CYCLE_METADATA_VERSION, name, ...(brief ? { brief } : {}) }
    : null;
}

/**
 * Build the document a season or campaign is named by. The write side of the
 * same shape `resolveCycleMetadataName` reads, kept here so the console and
 * the rail cannot drift.
 */
export function buildCycleMetadata(input: { name: string }): CycleMetadataV1 {
  const name = collapseCycleName(input.name);
  if (!name) throw new Error("A cycle needs a name");
  if (name.length > CYCLE_NAME_MAX_LENGTH) {
    throw new Error(
      `A cycle's name can be at most ${CYCLE_NAME_MAX_LENGTH} characters; this one has ${name.length}`
    );
  }
  return { version: CYCLE_METADATA_VERSION, name };
}

/**
 * Pin a cycle name and return its CID for `seedCycle`. Pinned before the
 * call; a failure is a `PoolDocumentPinError` so the seeding step stays open
 * with the name typed and offers to pin again, and nothing is sent.
 */
export async function pinCycleMetadata(
  input: {
    name: string;
    gardenAddress?: Address | null;
  },
  store: CommitmentDocumentStore = commitmentDocumentStore
): Promise<string> {
  const document = buildCycleMetadata(input);
  try {
    return await store.pinJson(document as unknown as Record<string, unknown>, {
      source: "commitment-cycle-metadata",
      gardenAddress: input.gardenAddress ?? undefined,
      metadataType: "commitment-cycle",
    });
  } catch (error) {
    throw new PoolDocumentPinError("cycle", error);
  }
}

function isResolvableCycleMetadataCID(cid: string | null | undefined): cid is string {
  if (!cid) return false;
  const value = cid.trim();
  return value.length > 0 && value !== "0" && value !== "-";
}

export async function resolveCycleMetadataName(
  metadataCID: string | null | undefined,
  store: CommitmentDocumentStore = commitmentDocumentStore
): Promise<CycleMetadataNameResolution> {
  if (!isResolvableCycleMetadataCID(metadataCID)) return { status: "missing", name: null };
  try {
    const metadata = parseCycleMetadata(await store.readJson(metadataCID));
    return metadata
      ? {
          status: "resolved",
          name: metadata.name,
          ...(metadata.brief ? { brief: metadata.brief } : {}),
        }
      : { status: "unavailable", name: null };
  } catch (error) {
    logger.warn("[resolveCycleMetadataName] IPFS read failed", { metadataCID, error });
    return { status: "unavailable", name: null };
  }
}
