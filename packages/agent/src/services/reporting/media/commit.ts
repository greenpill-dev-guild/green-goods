import {
  applyReportChanges,
  type FieldChange,
  withEvidence,
} from "@green-goods/shared/modules/agent-reporting";
import {
  commitContentChange,
  EDITABLE_STATES,
  lifecycleState,
  StaleDraftError,
} from "../coordinator/draft-commit";
import { announceGarden } from "../coordinator/garden-step";
import { type CatalogView, promptNextStepFor } from "../coordinator/prompting";
import { takeSoleGarden, type Working } from "../coordinator/report-work";
import { inTransaction } from "../database";
import { DraftContentUnavailableError, loadDraft } from "../drafts";
import { participantWriter } from "../notify";
import { activeAccount } from "../participants";
import { findGarden, gardenScope, soleGarden } from "../gardens";
import type { ReportingCore } from "../runtime";
import type { JobOutcome } from "../worker";
import type { MediaExtraction, MediaSource } from "./extract";

/**
 * Applies one processed asset to its draft: the sanitized photo as candidate evidence and any
 * proposed values with their exact sources, committed only on the draft's current revision. A
 * concurrent turn wins and the job resumes from the stored asset. Limitations are explained and
 * the draft is kept; the next question is asked once, after the last file of a batch.
 */
export type Limitation =
  | "media.tooLarge"
  | "media.unsupported"
  | "media.unreadable"
  | "media.pdfTooLong"
  | "media.voiceOff"
  | "media.voicePaused"
  | "media.voiceTooLong"
  | "media.voiceEmpty"
  | "media.voiceFailed"
  | "media.documentsOff"
  | "media.fetchFailed";

export interface ProcessedAsset {
  id: string;
  conversationId: string;
  participantId: string;
  draftId: string;
  sourceEntryId: string;
  /** The inbound event that carried the file; revisions record it as their cause. */
  sourceEventId: string;
}

export interface ProcessingResult {
  limitation: Limitation | null;
  evidence: { digest: string } | null;
  extraction: MediaExtraction | null;
  /** What a voice note said, shown back to the gardener to check. */
  transcript: { text: string; model: string } | null;
  warnings: string[];
  sourceKind: MediaSource["kind"] | null;
}

const done: JobOutcome = { status: "done" };

function clip(text: string): string {
  return text.length > 600 ? `${text.slice(0, 600)}…` : text;
}

export function safeDraft(core: ReportingCore, draftId: string) {
  try {
    return loadDraft(core, draftId);
  } catch (error) {
    if (error instanceof DraftContentUnavailableError) return null;
    throw error;
  }
}

export async function applyProcessedAsset(
  core: ReportingCore,
  catalogFor: (garden: CatalogView["garden"]) => Promise<CatalogView["result"]>,
  asset: ProcessedAsset,
  result: ProcessingResult
): Promise<JobOutcome> {
  const garden = safeDraft(core, asset.draftId)?.content.garden;
  // A report with no garden yet takes its chat's only one below, so that garden's activities are
  // the ones to read.
  const account = activeAccount(core, asset.participantId, core.settings.chainId);
  const listed = garden
    ? findGarden(core.gardens, garden.address)
    : soleGarden(gardenScope(core.gardens, account?.address ?? null));
  const catalog: CatalogView = {
    garden: listed,
    result: listed ? await catalogFor(listed) : null,
  };
  try {
    return inTransaction(core.db, () => commitInTransaction(core, asset, result, catalog));
  } catch (error) {
    // Another turn changed the draft first: resume from the stored asset on the new revision.
    if (error instanceof StaleDraftError)
      return { status: "retry", errorCode: "stale_revision", delayMs: 1_000 };
    throw error;
  }
}

function changesFrom(asset: ProcessedAsset, result: ProcessingResult): FieldChange[] {
  return (result.extraction?.facts ?? []).map((fact) => ({
    field: fact.field,
    value: fact.value,
    provenance: {
      kind: fact.kind,
      origin: "model",
      sources: [
        {
          sourceEntryId: asset.sourceEntryId,
          assetId: asset.id,
          ...(result.evidence ? { assetDigest: result.evidence.digest } : {}),
          ...(fact.location ? { location: fact.location } : {}),
        },
      ],
      ...(fact.original ? { original: fact.original } : {}),
      ...(fact.unit ? { originalUnit: fact.unit } : {}),
      model: result.extraction?.model ?? "",
      gardenerStated: false,
    },
  }));
}

function commitInTransaction(
  core: ReportingCore,
  asset: ProcessedAsset,
  result: ProcessingResult,
  catalog: CatalogView
): JobOutcome {
  const draft = safeDraft(core, asset.draftId);
  core.db
    .query(
      "UPDATE media_assets SET state = $state, processing_manifest = $manifest, updated_at = $now WHERE id = $id"
    )
    .run({
      id: asset.id,
      state: result.limitation ? "unsupported" : "ready",
      manifest: JSON.stringify({
        warnings: result.warnings.slice(0, 20),
        model: result.extraction?.model ?? null,
        observations: result.extraction?.observations ?? [],
        uncertain: result.extraction?.uncertain ?? [],
      }),
      now: core.clock.now(),
    });
  const writer = participantWriter(core, {
    participantId: asset.participantId,
    conversationId: asset.conversationId,
    dedupePrefix: `media:${asset.id}`,
  });
  if (!draft || !writer) return done;
  if (result.limitation) {
    writer.say(result.limitation);
    return done;
  }
  if (!EDITABLE_STATES.has(lifecycleState(draft))) {
    writer.say("media.late");
    return done;
  }
  let content = draft.content;
  if (result.evidence) {
    content = withEvidence(content, {
      assetId: asset.id,
      sanitizedDigest: result.evidence.digest,
      mime: "image/jpeg",
    });
  }
  let changes = changesFrom(asset, result);
  if (result.transcript && !content.feedback) {
    // The recording's words become the description, marked transcribed rather than typed.
    changes = [
      {
        field: "feedback",
        value: result.transcript.text,
        provenance: {
          kind: "transcribed",
          origin: "model",
          sources: [
            { sourceEntryId: asset.sourceEntryId, assetId: asset.id, location: "voice note" },
          ],
          model: result.transcript.model,
          gardenerStated: false,
        },
      },
      ...changes.filter((change) => change.field !== "feedback"),
    ];
  }
  const account = activeAccount(core, asset.participantId, core.settings.chainId);
  const work: Working = {
    content: applyReportChanges(content, changes, draft.snapshot).content,
    snapshot: draft.snapshot,
    changed: false,
  };
  takeSoleGarden(
    work,
    gardenScope(core.gardens, account?.address ?? null),
    () => asset.sourceEntryId
  );
  const next =
    work.content === draft.content
      ? draft
      : commitContentChange(core, draft, {
          content: work.content,
          cause: `media:${asset.id}`,
          sourceEventId: asset.sourceEventId,
        });
  // Said with the file that caused it: the question that follows waits for the batch's last file.
  if (work.taken) announceGarden(writer, work.taken);
  if (result.transcript) writer.say("voice.heard", { transcript: clip(result.transcript.text) });
  if (result.warnings.includes("hidden_content_excluded")) writer.say("media.hiddenExcluded");
  if (result.extraction && result.warnings.includes("docx_visuals_not_read"))
    writer.say("media.wordNative");
  if (result.extraction && result.warnings.includes("spreadsheet_visuals_not_read"))
    writer.say("media.spreadsheetNative");
  if (
    result.warnings.some(
      (warning) =>
        ![
          "hidden_content_excluded",
          "converted_from_docx",
          "converted_from_xlsx",
          "docx_visuals_not_read",
          "spreadsheet_visuals_not_read",
        ].includes(warning)
    )
  )
    writer.say("media.partial");
  const pending = core.db
    .query(
      `SELECT count(*) AS n FROM media_assets WHERE draft_id = $draft AND id <> $id
       AND state IN ('received','quarantined','inspecting','converting','extracting')`
    )
    .get({ draft: asset.draftId, id: asset.id }) as { n: number };
  // One reply after the last file of a batch, not one question per photo.
  if (pending.n === 0) {
    // Without an extraction (model processing off or unavailable) the file was only kept.
    if (!result.transcript)
      writer.say(
        result.sourceKind === "image"
          ? "media.photoAdded"
          : result.extraction
            ? "media.fileRead"
            : "media.fileKept"
      );
    promptNextStepFor(writer, next, catalog, account?.address ?? null);
  }
  return done;
}
