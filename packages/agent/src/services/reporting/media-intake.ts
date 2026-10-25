import type { ConversationWriter } from "./coordinator/writer";
import type { DraftRecord } from "./drafts";
import { enqueueJob } from "./jobs";
import type { ReportingCore } from "./runtime";
import type { InboundMediaReference } from "./transport";

/**
 * Records inbound attachments as private assets and schedules their processing, and answers each
 * batch of them once it is processed. Nothing is downloaded or interpreted here: the processing
 * job fetches bounded bytes, validates the actual format and only then adds sanitized evidence to
 * the draft. The declared type is a hint only.
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

/**
 * Whether files sent for a draft are still being processed: received, with their processing job
 * still to run. A voice note held for its own consent is not, and nor is a file whose processing
 * gave up, so neither can keep a report from its summary for good.
 */
export function filesInProgress(core: ReportingCore, draftId: string): boolean {
  return (
    core.db
      .query(
        `SELECT 1 FROM processing_jobs j JOIN media_assets a ON a.id = j.subject_id
         WHERE j.state IN ('pending','leased') AND j.kind = 'process_media' AND a.draft_id = $draft
           AND a.state IN ('received','inspecting','converting','extracting')
         LIMIT 1`
      )
      .get({ draft: draftId }) !== null
  );
}

/**
 * The one acknowledgement for a batch of files, said once none of the draft's files is still to
 * be processed: how many photos the report took, the activity's limit when it had no room for
 * some, and whether other files were read or only kept. Every file it covers is marked answered.
 */
export function acknowledgeFiles(
  core: ReportingCore,
  writer: ConversationWriter,
  draft: DraftRecord
): void {
  const files = core.db
    .query(
      `SELECT id, asset_kind, state, sanitized_digest, processing_manifest FROM media_assets
       WHERE draft_id = $draft AND acknowledged_at IS NULL`
    )
    .all({ draft: draft.id }) as Array<{
    id: string;
    asset_kind: string;
    state: string;
    sanitized_digest: string | null;
    processing_manifest: string;
  }>;
  core.db
    .query(
      "UPDATE media_assets SET acknowledged_at = $now WHERE draft_id = $draft AND acknowledged_at IS NULL"
    )
    .run({ draft: draft.id, now: core.clock.now() });
  const used = files.filter((file) => file.state === "ready");
  const photos = used.filter((file) => file.asset_kind === "image");
  const added = photos.filter((photo) =>
    draft.content.evidence.some((item) => item.assetId === photo.id)
  ).length;
  // A photo already in the report under another file is a repeat, not one left out.
  const leftOut = photos.some(
    (photo) =>
      photo.sanitized_digest !== null &&
      !draft.content.evidence.some((item) => item.sanitizedDigest === photo.sanitized_digest)
  );
  const maximum = draft.snapshot?.definition.media.maxImageCount ?? null;
  const said = [
    ...(added === 1 ? [writer.text("media.photoAdded")] : []),
    ...(added > 1 ? [writer.text("media.photosAdded", { count: added })] : []),
    ...(leftOut && maximum !== null ? [writer.text("report.photosKept", { maximum })] : []),
  ];
  if (said.length > 0) writer.reply({ text: said.join(" ") }, "media.photosAdded");
  // A voice note's words were shown back as it was heard.
  const documents = used.filter((file) => !["image", "audio"].includes(file.asset_kind));
  if (documents.length > 0) {
    // Without an extraction (model processing off or unavailable) a file was only kept.
    const read = documents.some(
      (file) => (JSON.parse(file.processing_manifest) as { model?: string | null }).model
    );
    writer.say(read ? "media.fileRead" : "media.fileKept");
  }
}

/**
 * Answers a batch whose last waiting file was settled outside the media job, as a voice note is
 * when its transcription is declined, once no file of the draft is still to be processed.
 */
export function settleFileBatch(
  core: ReportingCore,
  writer: ConversationWriter,
  draft: DraftRecord
): void {
  const waiting = core.db
    .query(
      `SELECT 1 FROM media_assets WHERE draft_id = $draft
       AND state IN ('received','quarantined','inspecting','converting','extracting') LIMIT 1`
    )
    .get({ draft: draft.id });
  if (!waiting) acknowledgeFiles(core, writer, draft);
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
