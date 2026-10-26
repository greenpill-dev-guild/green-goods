import {
  applyReportChanges,
  type FieldChange,
  type ReportContent,
  withEvidence,
} from "@green-goods/shared/modules/agent-reporting";
import {
  commitContentChange,
  EDITABLE_STATES,
  lifecycleState,
  StaleDraftError,
} from "../coordinator/draft-commit";
import { announceGarden, readOwnGardens } from "../coordinator/garden-step";
import { type CatalogView, promptNextStepFor } from "../coordinator/prompting";
import { keepAcceptedPhotos, takeSoleGarden, type Working } from "../coordinator/report-work";
import { createLogger } from "../../logger";
import { inTransaction } from "../database";
import { DraftContentUnavailableError, type DraftRecord, loadDraft } from "../drafts";
import { acknowledgeFiles } from "../media-intake";
import { participantWriter } from "../notify";
import { activeAccount } from "../participants";
import { openPrompt } from "../prompts";
import { findGarden, gardenScope, soleGarden } from "../gardens";
import type { ReportingCore } from "../runtime";
import type { JobOutcome } from "../worker";
import type { MediaExtraction } from "./extract";

/**
 * Applies one processed asset to its draft: the sanitized photo as candidate evidence and any
 * proposed values with their exact sources, committed only on the draft's current revision. A
 * concurrent turn wins and the job resumes from the stored asset. A file that cannot be used is
 * explained and the draft is kept. Files processed together, such as an album, are a batch: its
 * last file says once what the batch added and asks the next question once; after a batch that
 * added nothing, only when the report has no question open.
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
}

const log = createLogger("reporting");

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
  // the ones to read. A file can be processed well after the turn that brought it, so the
  // account's gardens are read again first.
  const account = activeAccount(core, asset.participantId, core.settings.chainId);
  if (account && !garden) await readOwnGardens(core);
  const listed = garden
    ? findGarden(core.gardens, garden.address)
    : soleGarden(gardenScope(core.gardens, account?.address ?? null));
  // Activities that cannot be read must not cost the file: the report says so when it comes to
  // ask for one.
  const activities = listed
    ? await catalogFor(listed).catch((err): CatalogView["result"] => {
        log.warn({ err }, "Could not read a garden's activities for a processed file");
        return { ok: false, reason: "unavailable" };
      })
    : null;
  const catalog: CatalogView = { garden: listed, result: activities };
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

/** Evidence in the order its files were sent: by their message's arrival, then place in it. */
function inSentOrder(core: ReportingCore, draftId: string, content: ReportContent): ReportContent {
  const sent = (
    core.db
      .query(
        `SELECT a.id FROM media_assets a
         JOIN source_entries s ON s.id = a.source_entry_id
         JOIN inbox_events e ON e.id = s.inbox_event_id
         WHERE a.draft_id = $draft ORDER BY e.arrival_seq, a.ordinal`
      )
      .all({ draft: draftId }) as Array<{ id: string }>
  ).map((row) => row.id);
  const place = (assetId: string) => {
    const at = sent.indexOf(assetId);
    return at < 0 ? sent.length : at;
  };
  return {
    ...content,
    evidence: [...content.evidence].sort((a, b) => place(a.assetId) - place(b.assetId)),
  };
}

/** Whether the open question still applies: one about another subject, or about this revision. */
function questionStands(core: ReportingCore, conversationId: string, draft: DraftRecord): boolean {
  const prompt = openPrompt(core, conversationId);
  if (!prompt) return false;
  return prompt.subjectKind !== "draft" || prompt.subjectRevision === draft.revision;
}

/** The draft's other files that are part of this batch, by whether they are still processing. */
function batchOf(core: ReportingCore, asset: ProcessedAsset): { pending: number; used: number } {
  return core.db
    .query(
      `SELECT
         count(*) FILTER (WHERE state IN ('received','quarantined','inspecting','converting','extracting')) AS pending,
         count(*) FILTER (WHERE state = 'ready') AS used
       FROM media_assets WHERE draft_id = $draft AND id <> $id AND acknowledged_at IS NULL`
    )
    .get({ draft: asset.draftId, id: asset.id }) as { pending: number; used: number };
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
  const editable = EDITABLE_STATES.has(lifecycleState(draft));
  const batch = batchOf(core, asset);
  if (result.limitation) {
    writer.say(result.limitation);
    if (!editable) return done;
    // A report that can still change is never left with nothing asked. When the file that could
    // not be used was all it had to go on, its next step is put as it is after one that could.
    // A question still open about the report as it is stays as it is, unless this file ends a
    // batch whose other files were used: the batch's reply comes now. One asked about an earlier
    // revision, such as the question a caption answered or a summary the files reopened, is not
    // left standing: the next step is put again.
    const stands = questionStands(core, asset.conversationId, draft);
    if (stands && (batch.pending > 0 || batch.used === 0)) {
      if (batch.pending === 0) acknowledgeFiles(core, writer, draft);
      return done;
    }
  } else if (!editable) {
    writer.say("media.late");
    return done;
  }
  const used = result.limitation === null;
  let content = draft.content;
  if (result.evidence) {
    const added = withEvidence(content, {
      assetId: asset.id,
      sanitizedDigest: result.evidence.digest,
      mime: "image/jpeg",
    });
    // An album's photos finish one by one and a download may be retried, so each takes its place
    // in the order sent. One past the activity's limit in that order finds no room, and the batch's
    // reply says so.
    const placed: Working = {
      content: added === content ? content : inSentOrder(core, asset.draftId, added),
      snapshot: draft.snapshot,
      changed: false,
    };
    keepAcceptedPhotos(placed);
    if (placed.content.evidence.some((photo) => photo.assetId === asset.id))
      content = placed.content;
  }
  // A photo the report did not keep, a repeat or one past the limit, gives it nothing the model
  // read from it either.
  const keptOut = result.evidence !== null && !content.evidence.some((p) => p.assetId === asset.id);
  let changes = keptOut ? [] : changesFrom(asset, result);
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
    // A file that could not be used adds nothing to the report, and nor does a photo that found
    // no room or repeats one already there, so none of them writes a revision.
    content:
      used && changes.length > 0
        ? applyReportChanges(content, changes, draft.snapshot).content
        : content,
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
  if (used && result.warnings.includes("hidden_content_excluded"))
    writer.say("media.hiddenExcluded");
  if (result.extraction && result.warnings.includes("docx_visuals_not_read"))
    writer.say("media.wordNative");
  if (result.extraction && result.warnings.includes("spreadsheet_visuals_not_read"))
    writer.say("media.spreadsheetNative");
  if (
    used &&
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
  // One reply after the last file of a batch, not one per photo, and then one question.
  if (batch.pending === 0) {
    acknowledgeFiles(core, writer, next);
    promptNextStepFor(writer, next, catalog, account?.address ?? null);
  }
  return done;
}
