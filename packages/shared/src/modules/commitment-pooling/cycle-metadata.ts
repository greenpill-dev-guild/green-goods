import { logger } from "../app/logger";
import { getJsonByHash } from "../data/ipfs";
import { demoDocumentFor } from "./demo/demo-gate";

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
    const metadata = parseCycleMetadata(
      (await demoDocumentFor(metadataCID)) ?? (await getJsonByHash(metadataCID))
    );
    return metadata
      ? { status: "resolved", name: metadata.name }
      : { status: "unavailable", name: null };
  } catch (error) {
    logger.warn("[resolveCycleMetadataName] IPFS read failed", { metadataCID, error });
    return { status: "unavailable", name: null };
  }
}
