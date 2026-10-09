import type { ReportingCatalog } from "../catalog";
import { readControl } from "../controls";
import { inTransaction } from "../database";
import type { ClaimedJob } from "../jobs";
import type { PrivateMediaStore } from "../media-store";
import type { OpenAIConfig } from "../openai-responses";
import type { ReportingCore } from "../runtime";
import type { InboundMediaFetcher, InboundMediaReference } from "../transport";
import type { JobOutcome } from "../worker";
import type { AudioTools } from "./audio";
import { applyProcessedAsset, type Limitation, safeDraft } from "./commit";
import { type DetectedType, detectType } from "./detect";
import type { DocumentTools } from "./documents";
import { extractFromMedia, type MediaExtraction, type MediaSource } from "./extract";
import { ImageRejectedError, sanitizeImage } from "./image";
import { LocalToolError } from "./subprocess";
import { readCsv, readWorkbook } from "./tables";
import { hearVoiceNote } from "./voice";

/**
 * The durable media job. It fetches bounded bytes through the transport, identifies them from the
 * bytes, keeps the original private, adds sanitized photos as candidate evidence and, when model
 * processing is on, proposes field values with exact sources. Each step records its result on the
 * asset so a retry resumes rather than repeats; draft changes commit only on the current revision.
 * Unsupported, encrypted or oversized files get a clear limitation and never cost the draft.
 */
export interface MediaDeps {
  core: ReportingCore;
  media: PrivateMediaStore;
  fetcher: InboundMediaFetcher;
  tools: DocumentTools;
  audio: AudioTools;
  catalog: ReportingCatalog;
  /** `transcriptionModel` is present only when a transcription model is pinned. */
  openai: (OpenAIConfig & { transcriptionModel?: string | null }) | null;
}

interface AssetRow {
  id: string;
  sanitized_object_ciphertext: string | null;
  sanitized_digest: string | null;
  conversation_id: string;
  participant_id: string | null;
  draft_id: string | null;
  source_entry_id: string;
  provider_ref_ciphertext: string | null;
  private_object_ciphertext: string | null;
  state: string;
}

const MAX_BYTES = 10 * 1024 * 1024;
const TERMINAL = new Set(["ready", "failed", "unsupported", "deleted", "needs_clarification"]);
const done: JobOutcome = { status: "done" };

function setAsset(core: ReportingCore, id: string, fields: Record<string, string | number | null>) {
  const columns = Object.keys(fields).map((key) => `${key} = $${key}`);
  core.db
    .query(`UPDATE media_assets SET ${columns.join(", ")}, updated_at = $now WHERE id = $id`)
    .run({ ...fields, id, now: core.clock.now() });
}

async function loadOriginal(deps: MediaDeps, asset: AssetRow): Promise<Uint8Array | Limitation> {
  const { core } = deps;
  if (asset.private_object_ciphertext) {
    const key = core.keyring.open(
      asset.private_object_ciphertext,
      `media_assets.private:${asset.id}`
    );
    return deps.media.get(key, `private:${asset.id}`);
  }
  if (!asset.provider_ref_ciphertext) return "media.fetchFailed";
  const reference = JSON.parse(
    core.keyring.open(asset.provider_ref_ciphertext, `media_assets.provider_ref:${asset.id}`)
  ) as InboundMediaReference & { providerRealm?: string };
  if ((reference.declaredSize ?? 0) > MAX_BYTES) return "media.tooLarge";
  const realm = (
    core.db
      .query("SELECT provider_realm FROM conversations WHERE id = $id")
      .get({ id: asset.conversation_id }) as { provider_realm: string }
  ).provider_realm;
  const { bytes } = await deps.fetcher.fetch(realm, reference, {
    maxBytes: MAX_BYTES,
    timeoutMs: 30_000,
  });
  if (bytes.byteLength > MAX_BYTES) return "media.tooLarge";
  const stored = await deps.media.put(bytes, `private:${asset.id}`);
  inTransaction(core.db, () =>
    setAsset(core, asset.id, {
      private_object_ciphertext: core.keyring.seal(stored.key, `media_assets.private:${asset.id}`),
      source_digest: stored.digest,
      source_size: stored.size,
      state: "inspecting",
    })
  );
  return bytes;
}

function limitationFor(core: ReportingCore, detected: DetectedType): Limitation | null {
  if (detected.kind === "unsupported") {
    // Known containers that are protected, active or oversized are named as unreadable files.
    return detected.reason === "unknown_format" || detected.reason === "legacy_office"
      ? "media.unsupported"
      : "media.unreadable";
  }
  if (detected.kind === "video") return "media.unsupported";
  if (detected.kind === "audio")
    return readControl(core, "voice").enabled ? null : "media.voiceOff";
  if (
    (detected.kind === "pdf" || detected.kind === "docx") &&
    !readControl(core, "documents").enabled
  )
    return "media.documentsOff";
  return null;
}

/** Prepares bounded Office/PDF content while keeping spreadsheet values anchored to native cells. */
async function sourceFor(
  deps: MediaDeps,
  detected: DetectedType,
  bytes: Uint8Array,
  warnings: string[]
): Promise<MediaSource | Limitation> {
  if (detected.kind === "xlsx" || detected.kind === "csv") {
    const read = detected.kind === "xlsx" ? await readWorkbook(bytes) : readCsv(bytes);
    if (!read.ok)
      return read.reason === "unreadable" || read.reason === "empty"
        ? "media.unreadable"
        : "media.tooLarge";
    const { excluded } = read.table;
    if (excluded.hiddenSheets.length || excluded.hiddenRows || excluded.hiddenColumns)
      warnings.push("hidden_content_excluded");
    warnings.push(...read.table.warnings);
    if (
      detected.kind === "xlsx" &&
      deps.openai &&
      readControl(deps.core, "model_processing").enabled
    ) {
      // PDF charts can reveal values from hidden cells even when those cells are not printed.
      // Keep native visible-cell reading whenever hidden content exists or documents are paused.
      if (
        readControl(deps.core, "documents").enabled &&
        !warnings.includes("hidden_content_excluded")
      ) {
        try {
          const pdf = await deps.tools.convertToPdf(bytes, "xlsx");
          const inspected = await deps.tools.inspectPdf(pdf);
          if (inspected.ok) {
            warnings.push("converted_from_xlsx");
            return {
              kind: "table",
              table: read.table,
              preview: { bytes: pdf, pages: inspected.pages },
            };
          }
        } catch (error) {
          if (!(error instanceof LocalToolError)) throw error;
        }
      }
      warnings.push("spreadsheet_visuals_not_read");
    }
    return { kind: "table", table: read.table };
  }
  let pdf = detected.kind === "pdf" ? bytes : null;
  if (detected.kind === "docx") {
    try {
      pdf = await deps.tools.convertToPdf(bytes, "docx");
      warnings.push("converted_from_docx");
    } catch (error) {
      // Without LibreOffice in the image the file is read below as native Word text instead.
      if (!(error instanceof LocalToolError && error.reason === "unavailable")) throw error;
    }
  }
  if (pdf) {
    const inspected = await deps.tools.inspectPdf(pdf);
    if (!inspected.ok)
      return inspected.reason === "too_many_pages" ? "media.pdfTooLong" : "media.unreadable";
    return {
      kind: "document",
      bytes: pdf,
      filename: "attachment.pdf",
      mime: "application/pdf",
      pages: inspected.pages,
    };
  }
  // Native Word text only: embedded pictures and charts are not read on this path.
  warnings.push("docx_visuals_not_read");
  return {
    kind: "document",
    bytes,
    filename: "attachment.docx",
    mime: detected.kind === "docx" ? detected.mime : "",
    pages: null,
  };
}

export async function processMedia(deps: MediaDeps, job: ClaimedJob): Promise<JobOutcome> {
  const { core } = deps;
  const asset = core.db
    .query("SELECT * FROM media_assets WHERE id = $id")
    .get({ id: job.subjectId }) as AssetRow | null;
  if (!asset || TERMINAL.has(asset.state) || !asset.draft_id || !asset.participant_id) return done;

  let bytes: Uint8Array | Limitation;
  try {
    bytes = await loadOriginal(deps, asset);
  } catch {
    if (job.attempts < job.maxAttempts)
      return { status: "retry", errorCode: "media_fetch", delayMs: 20_000 };
    bytes = "media.fetchFailed";
  }
  const detected = typeof bytes === "string" ? null : detectType(bytes);
  const warnings: string[] = [];
  let limitation: Limitation | null =
    typeof bytes === "string" ? bytes : limitationFor(core, detected as DetectedType);
  let evidence: { digest: string } | null = null;
  let source: MediaSource | null = null;
  let transcript: { text: string; model: string } | null = null;

  if (!limitation && detected && typeof bytes !== "string") {
    try {
      if (
        detected.kind === "image" &&
        asset.sanitized_object_ciphertext &&
        asset.sanitized_digest
      ) {
        // A retry after a concurrent draft change reuses the image it already sanitized.
        const key = core.keyring.open(
          asset.sanitized_object_ciphertext,
          `media_assets.sanitized:${asset.id}`
        );
        evidence = { digest: asset.sanitized_digest };
        source = {
          kind: "image",
          bytes: await deps.media.get(key, `sanitized:${asset.id}`),
          mime: "image/jpeg",
        };
      } else if (detected.kind === "image") {
        const clean = await sanitizeImage(bytes);
        const stored = await deps.media.put(clean.bytes, `sanitized:${asset.id}`);
        inTransaction(core.db, () =>
          setAsset(core, asset.id, {
            sanitized_object_ciphertext: core.keyring.seal(
              stored.key,
              `media_assets.sanitized:${asset.id}`
            ),
            sanitized_digest: stored.digest,
            sanitized_mime: clean.mime,
            detected_type: detected.mime,
            asset_kind: "image",
          })
        );
        evidence = { digest: stored.digest };
        source = { kind: "image", bytes: clean.bytes, mime: clean.mime };
      } else if (detected.kind === "audio") {
        inTransaction(core.db, () =>
          setAsset(core, asset.id, { detected_type: detected.mime, asset_kind: "audio" })
        );
        const heard = await hearVoiceNote(
          deps,
          {
            id: asset.id,
            conversationId: asset.conversation_id,
            participantId: asset.participant_id,
            sourceEntryId: asset.source_entry_id,
          },
          {
            bytes,
            mime: detected.mime,
            locale: participantLocale(core, asset.participant_id),
            lastAttempt: job.attempts >= job.maxAttempts,
          }
        );
        // A held note waits for the voice consent answer, which requeues it.
        if (heard.kind === "held") return done;
        if (heard.kind === "retry")
          return { status: "retry", errorCode: "transcription", delayMs: 30_000 };
        if (heard.kind === "limitation") limitation = heard.limitation;
        else {
          transcript = { text: heard.text, model: heard.model };
          source = { kind: "transcript", text: heard.text };
        }
      } else {
        const prepared = await sourceFor(deps, detected, bytes, warnings);
        if (typeof prepared === "string") limitation = prepared;
        else source = prepared;
        inTransaction(core.db, () =>
          setAsset(core, asset.id, {
            detected_type: "mime" in detected ? detected.mime : detected.kind,
            asset_kind: detected.kind,
          })
        );
      }
    } catch (error) {
      if (error instanceof ImageRejectedError) limitation = "media.unreadable";
      else if (error instanceof LocalToolError)
        limitation = error.reason === "unavailable" ? "media.documentsOff" : "media.unreadable";
      else throw error;
    }
  }

  const modelOn = Boolean(deps.openai) && readControl(core, "model_processing").enabled;
  let extraction: MediaExtraction | null = null;
  if (!limitation && source && modelOn && deps.openai) {
    const draft = safeDraft(core, asset.draft_id);
    const inputs = draft?.snapshot?.definition.inputs ?? [];
    try {
      extraction = await extractFromMedia(
        deps.openai,
        source,
        {
          locale: participantLocale(core, asset.participant_id),
          actionTitle: draft?.snapshot?.definition.title ?? null,
          inputs,
        },
        AbortSignal.timeout(45_000)
      );
    } catch {
      // A transcript is used in full even when no details could be proposed from it.
      if (source.kind !== "transcript") warnings.push("extraction_unavailable");
    }
  }
  const cause = core.db
    .query("SELECT inbox_event_id FROM source_entries WHERE id = $id")
    .get({ id: asset.source_entry_id }) as { inbox_event_id: string };
  return applyProcessedAsset(
    core,
    async (garden) => (garden ? deps.catalog.eligibleActions(garden, core.clock.now()) : null),
    {
      id: asset.id,
      conversationId: asset.conversation_id,
      participantId: asset.participant_id,
      draftId: asset.draft_id,
      sourceEntryId: asset.source_entry_id,
      sourceEventId: cause.inbox_event_id,
    },
    { limitation, evidence, extraction, transcript, warnings, sourceKind: source?.kind ?? null }
  );
}

function participantLocale(core: ReportingCore, participantId: string): string {
  const row = core.db
    .query("SELECT locale FROM participants WHERE id = $id")
    .get({ id: participantId }) as { locale: string | null } | null;
  return row?.locale ?? "en";
}
