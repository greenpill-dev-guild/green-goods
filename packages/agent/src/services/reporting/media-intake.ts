import { enqueueJob } from "./jobs";
import type { ReportingCore } from "./runtime";
import type { InboundMediaReference } from "./transport";

/**
 * Records inbound attachments as private assets and schedules their processing. Nothing is
 * downloaded or interpreted here: the processing job fetches bounded bytes, validates the actual
 * format and only then adds sanitized evidence to the draft. The declared type is a hint only.
 */
export type AssetKind =
  | "image"
  | "pdf"
  | "docx"
  | "xlsx"
  | "csv"
  | "audio"
  | "video"
  | "unsupported";

function declaredAssetKind(mime: string | undefined): AssetKind {
  const type = (mime ?? "").toLowerCase().split(";")[0]?.trim() ?? "";
  if (["image/jpeg", "image/png", "image/webp"].includes(type)) return "image";
  if (type === "application/pdf") return "pdf";
  if (type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
    return "docx";
  if (type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") return "xlsx";
  if (type === "text/csv" || type === "text/comma-separated-values") return "csv";
  if (type.startsWith("audio/")) return "audio";
  if (type.startsWith("video/")) return "video";
  return "unsupported";
}

export function recordMediaIntake(
  core: ReportingCore,
  input: {
    conversationId: string;
    participantId: string;
    draftId: string | null;
    sourceEntryId: string;
    media: readonly InboundMediaReference[];
  }
): string[] {
  const now = core.clock.now();
  return input.media.map((reference, ordinal) => {
    const id = core.ids.id();
    core.db
      .query(
        `INSERT OR IGNORE INTO media_assets
           (id, conversation_id, participant_id, draft_id, source_entry_id, ordinal, provider_ref_ciphertext,
            declared_mime, asset_kind, state, created_at, updated_at)
         VALUES ($id, $conversation, $participant, $draft, $source, $ordinal, $ref, $mime, $kind, 'received', $now, $now)`
      )
      .run({
        id,
        conversation: input.conversationId,
        participant: input.participantId,
        draft: input.draftId,
        source: input.sourceEntryId,
        ordinal,
        ref: core.keyring.seal(JSON.stringify(reference), `media_assets.provider_ref:${id}`),
        mime: reference.declaredMime ?? null,
        kind: declaredAssetKind(reference.declaredMime),
        now,
      });
    enqueueJob(core, {
      kind: "process_media",
      subjectId: id,
      dedupeKey: `media:${input.sourceEntryId}:${ordinal}`,
    });
    return id;
  });
}
