import type { ApproximateWorkLocation, Domain } from "../../types/domain";

export interface WorkMetadataPayloadInput {
  title: string;
  feedback: string;
  actionUID: number;
  timeSpentMinutes?: number;
  details?: Record<string, unknown>;
  /** Already rounded to the published precision. */
  location?: ApproximateWorkLocation;
  tags?: string[];
  audioNoteCids: string[];
  submittedAt: string;
  attachments: Array<{ cid: string; type: string }>;
  clientWorkId?: string;
  /** Identity carried on a legacy draft; v2 metadata falls back to it. */
  draftClientWorkId?: string;
  domain?: Domain | null;
  actionSlug?: string;
}

export type WorkMetadataVersion = "work_metadata_v2" | "work_metadata";

/**
 * The Work metadata JSON exactly as publication uploads it: v2 when a known domain and Action slug
 * are supplied, the legacy shape otherwise. Key order is part of the contract because uploaders
 * hash the serialized payload to decide whether an earlier upload can be reused.
 */
export function buildWorkMetadataPayload(input: WorkMetadataPayloadInput): {
  payload: Record<string, unknown>;
  version: WorkMetadataVersion;
} {
  const details = Object.fromEntries(
    Object.entries(input.details ?? {}).filter(([key]) => key !== "_location")
  );
  const optional = {
    ...(input.location ? { location: input.location } : {}),
  };
  const isV2 =
    input.domain !== null && input.domain !== undefined && input.actionSlug !== undefined;
  const payload: Record<string, unknown> = isV2
    ? {
        schemaVersion: "work_metadata_v2" as const,
        domain: input.domain,
        actionSlug: input.actionSlug,
        timeSpentMinutes: input.timeSpentMinutes ?? 0,
        details,
        ...optional,
        ...(input.tags && input.tags.length > 0 ? { tags: input.tags } : {}),
        ...(input.audioNoteCids.length > 0 ? { audioNoteCids: input.audioNoteCids } : {}),
        clientWorkId: input.clientWorkId ?? input.draftClientWorkId,
        submittedAt: input.submittedAt,
      }
    : {
        details,
        ...optional,
        timeSpentMinutes: input.timeSpentMinutes,
        ...(input.tags && input.tags.length > 0 ? { tags: input.tags } : {}),
        ...(input.audioNoteCids.length > 0 ? { audioNoteCids: input.audioNoteCids } : {}),
        ...(input.clientWorkId ? { clientWorkId: input.clientWorkId } : {}),
      };
  Object.assign(payload, {
    title: input.title,
    feedback: input.feedback,
    actionUID: input.actionUID,
    submittedAt: input.submittedAt,
    attachments: input.attachments,
  });
  return { payload, version: isV2 ? "work_metadata_v2" : "work_metadata" };
}
