/**
 * The draft a queued work job becomes when it is sent.
 *
 * Preparation, Upload all and the job executor all encode queued work, and the
 * metadata hash covers every field built here. Building it in one place keeps
 * them from uploading different metadata for the same work.
 *
 * @module modules/work/queued-work-draft
 */

import type { Action, Confidence, WorkApprovalDraft, WorkDraft } from "../../types/domain";
import type { ApprovalJobPayload, Job, WorkJobPayload } from "../../types/job-queue";
import { findActionByUID } from "../../utils/action/parsers";
import { resolveKnownWorkTitle, resolveWorkSubmissionTitle } from "../../utils/work/workTitles";
import { logger } from "../app/logger";

export function buildQueuedWorkDraft(
  payload: WorkJobPayload,
  files: File[],
  title: string
): WorkDraft {
  const audioFiles = files.filter((file) => file.type.startsWith("audio/"));
  const mediaFiles = files.filter((file) => !file.type.startsWith("audio/"));
  return {
    actionUID: payload.actionUID,
    title,
    feedback: payload.feedback,
    media: mediaFiles,
    details: payload.details ?? {},
    location: payload.location,
    timeSpentMinutes: payload.timeSpentMinutes ?? 0,
    ...(payload.tags ? { tags: payload.tags } : {}),
    ...(audioFiles.length > 0 ? { audioNotes: audioFiles } : {}),
  };
}

/** The decision a queued approval job carries, as the encoder and simulation read it. */
export function buildQueuedApprovalDraft(payload: ApprovalJobPayload): WorkApprovalDraft {
  return {
    actionUID: payload.actionUID,
    workUID: payload.workUID,
    approved: payload.approved,
    feedback: payload.feedback,
    confidence: payload.confidence as Confidence,
    verificationMethod: payload.verificationMethod,
    reviewNotesCID: payload.reviewNotesCID,
  };
}

export interface QueuedWorkTitleDependencies {
  loadActions?: (chainId: number) => Promise<Action[]>;
  persist?: (job: Job<WorkJobPayload>) => Promise<void>;
}

/** The actions list the work flow already cached, fetched only when it is missing. */
async function loadCachedActions(chainId: number): Promise<Action[]> {
  const [{ queryClient, STALE_TIMES }, { actionsKeys }, { getActions }] = await Promise.all([
    import("../../config/react-query"),
    import("../../config/query-keys/garden"),
    import("../data/greengoods"),
  ]);
  return queryClient.ensureQueryData({
    queryKey: actionsKeys.byChain(chainId),
    queryFn: () => getActions(),
    staleTime: STALE_TIMES.actions,
  });
}

async function persistQueuedWork(job: Job<WorkJobPayload>): Promise<void> {
  const { jobQueueDB } = await import("../job-queue/db");
  await jobQueueDB.updateJob(job);
}

/**
 * A job queued without its action's title used to be sent as "Action N", and
 * that placeholder became the on-chain title. Look the title up first, and keep
 * it on the job so the next attempt and the dashboard both have it. When the
 * action cannot be found the placeholder is still sent, but never stored.
 */
export async function resolveQueuedWorkTitle(
  job: Job<WorkJobPayload>,
  chainId: number,
  dependencies: QueuedWorkTitleDependencies = {}
): Promise<string> {
  const payload = job.payload;
  const known = resolveKnownWorkTitle({ draftTitle: payload.title, actionUID: payload.actionUID });
  if (known) return known;

  try {
    const actions = await (dependencies.loadActions ?? loadCachedActions)(chainId);
    const actionTitle = resolveKnownWorkTitle({
      actionTitle: findActionByUID(actions, payload.actionUID)?.title,
      actionUID: payload.actionUID,
    });
    if (actionTitle) {
      // Mutated on the caller's job: the queue rewrites this object after the attempt.
      payload.title = actionTitle;
      await (dependencies.persist ?? persistQueuedWork)(job);
      return actionTitle;
    }
    logger.warn("[WorkQueue] Queued work's action is not in the actions list", {
      actionUID: payload.actionUID,
    });
  } catch (error) {
    logger.warn("[WorkQueue] Could not load actions to title queued work", {
      actionUID: payload.actionUID,
      error: error instanceof Error ? error.message : String(error),
    });
  }
  return resolveWorkSubmissionTitle({ actionUID: payload.actionUID });
}
