import type { Address } from "../../types/domain";
import { logger } from "../app/logger";
import { getJsonByHash } from "../data/ipfs";
import { PoolDocumentPinError } from "./pool-charter";

export const CYCLE_METADATA_VERSION = 1;

export interface CycleMetadataV1 {
  version: 1;
  name: string;
}

export type CycleMetadataNameResolution =
  | { status: "missing"; name: null }
  | { status: "resolved"; name: string }
  | { status: "unavailable"; name: null };

const MAX_CYCLE_NAME_LENGTH = 120;

function cleanCycleName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.replace(/\s+/g, " ").trim();
  return name.length > 0 ? name.slice(0, MAX_CYCLE_NAME_LENGTH) : null;
}

export function parseCycleMetadata(raw: unknown): CycleMetadataV1 | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const name = cleanCycleName(record.name);
  return record.version === CYCLE_METADATA_VERSION && name
    ? { version: CYCLE_METADATA_VERSION, name }
    : null;
}

/**
 * Build the document a season or campaign is named by. The write side of the
 * same shape `resolveCycleMetadataName` reads, kept here so the console and
 * the rail cannot drift.
 */
export function buildCycleMetadata(input: { name: string }): CycleMetadataV1 {
  const name = cleanCycleName(input.name);
  if (!name) throw new Error("A cycle needs a name");
  return { version: CYCLE_METADATA_VERSION, name };
}

/**
 * Pin a cycle name and return its CID for `seedCycle`. Pinned before the
 * call; a failure is a `PoolDocumentPinError` so the seeding step stays open
 * with the name typed and offers to pin again, and nothing is sent.
 */
export async function pinCycleMetadata(input: {
  name: string;
  gardenAddress?: Address | null;
}): Promise<string> {
  const document = buildCycleMetadata(input);
  try {
    const { uploadJSONToIPFS } = await import("../data/ipfs/upload");
    const { cid } = await uploadJSONToIPFS(document as unknown as Record<string, unknown>, {
      source: "commitment-cycle-metadata",
      gardenAddress: input.gardenAddress ?? undefined,
      metadataType: "commitment-cycle",
    });
    return cid;
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
  metadataCID: string | null | undefined
): Promise<CycleMetadataNameResolution> {
  if (!isResolvableCycleMetadataCID(metadataCID)) return { status: "missing", name: null };
  try {
    const metadata = parseCycleMetadata(await getJsonByHash(metadataCID));
    return metadata
      ? { status: "resolved", name: metadata.name }
      : { status: "unavailable", name: null };
  } catch (error) {
    logger.warn("[resolveCycleMetadataName] IPFS read failed", { metadataCID, error });
    return { status: "unavailable", name: null };
  }
}
