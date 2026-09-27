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
import { type CatalogView, promptNextStepFor } from "../coordinator/prompting";
import { inTransaction } from "../database";
import { DraftContentUnavailableError, loadDraft } from "../drafts";
import { participantWriter } from "../notify";
import { activeAccount } from "../participants";
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
  warnings: string[];
  sourceKind: MediaSource["kind"] | null;
}

const done: JobOutcome = { status: "done" };

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
  const configured =
    core.settings.gardens.find(
      (candidate) => candidate.address.toLowerCase() === garden?.address.toLowerCase()
    ) ?? null;
  const catalog: CatalogView = {
    garden: configured,
    result: configured ? await catalogFor(configured) : null,
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
  content = applyReportChanges(content, changesFrom(asset, result), draft.snapshot).content;
  const next =
    content === draft.content
      ? draft
      : commitContentChange(core, draft, {
          content,
          cause: `media:${asset.id}`,
          sourceEventId: asset.sourceEventId,
        });
  if (result.warnings.includes("hidden_content_excluded")) writer.say("media.hiddenExcluded");
  if (result.warnings.some((warning) => warning !== "hidden_content_excluded"))
    writer.say("media.partial");
  const pending = core.db
    .query(
      `SELECT count(*) AS n FROM media_assets WHERE draft_id = $draft AND id <> $id
       AND state IN ('received','quarantined','inspecting','converting','extracting')`
    )
    .get({ draft: asset.draftId, id: asset.id }) as { n: number };
  // One reply after the last file of a batch, not one question per photo.
  if (pending.n === 0) {
    writer.say(result.sourceKind === "image" ? "media.photoAdded" : "media.fileRead");
    const account = activeAccount(core, asset.participantId, core.settings.chainId);
    promptNextStepFor(writer, next, catalog, account?.address ?? null);
  }
  return done;
}
