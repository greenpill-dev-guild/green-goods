import {
  type ActionDefinitionSnapshot,
  outstandingRequirements,
  type ReportContent,
} from "@green-goods/shared/modules/agent-reporting";
import {
  advanceLifecycle,
  agentReportLifecycle,
  type ReportLifecycleContext,
  type ReportLifecycleEvent,
} from "@green-goods/shared/workflows/agent-reporting";
import {
  commitDraft,
  type DraftRecord,
  REPORT_LIFECYCLE_VERSION,
  type ReportLifecycle,
} from "../drafts";

/** Thrown inside a commit transaction to roll it back when another writer changed the draft. */
export class StaleDraftError extends Error {
  constructor() {
    super("Draft revision changed during the turn");
  }
}

export function applyLifecycle(
  lifecycle: ReportLifecycle,
  events: readonly ReportLifecycleEvent[]
): { lifecycle: ReportLifecycle; refused: ReportLifecycleEvent[] } {
  let current = lifecycle;
  const refused: ReportLifecycleEvent[] = [];
  for (const event of events) {
    const result = advanceLifecycle<ReportLifecycleContext, ReportLifecycleEvent>(
      agentReportLifecycle,
      REPORT_LIFECYCLE_VERSION,
      current,
      event
    );
    if (result.handled) current = result.next;
    else refused.push(event);
  }
  return { lifecycle: current, refused };
}

export function lifecycleState(draft: Pick<DraftRecord, "lifecycle">): string {
  return typeof draft.lifecycle.value === "string"
    ? draft.lifecycle.value
    : (Object.keys(draft.lifecycle.value)[0] ?? "");
}

/** States in which a material edit is still allowed to replace the confirmed revision. */
export const EDITABLE_STATES = new Set([
  "collecting",
  "review",
  "authority",
  "grantChoice",
  "preparing",
  "preparationFailed",
  "awaitingWallet",
  "delegatedPreflight",
]);

/**
 * Commits a content change as the next revision and moves the lifecycle to review when nothing
 * is missing. Throws StaleDraftError so the whole turn transaction rolls back and is replanned.
 */
export function commitContentChange(
  core: Parameters<typeof commitDraft>[0],
  draft: DraftRecord,
  change: {
    content: ReportContent;
    snapshot?: ActionDefinitionSnapshot | null;
    cause: string;
    sourceEventId: string;
  }
): DraftRecord {
  const snapshot = change.snapshot === undefined ? draft.snapshot : change.snapshot;
  const nextRevision = draft.revision + 1;
  const events: ReportLifecycleEvent[] = [{ type: "REVISED", revision: nextRevision }];
  if (outstandingRequirements(change.content, snapshot).length === 0) {
    events.push({ type: "READY_FOR_REVIEW", revision: nextRevision });
  }
  const { lifecycle, refused } = applyLifecycle(draft.lifecycle, events);
  if (refused.some((event) => event.type === "REVISED")) {
    // Callers check editability first; reaching here would split content from lifecycle.
    throw new Error(`Draft ${draft.id} is frozen in ${lifecycleState(draft)}`);
  }
  const committed = commitDraft(core, {
    draftId: draft.id,
    expectedRevision: draft.revision,
    lifecycle,
    content: change.content,
    snapshot,
    cause: change.cause,
    sourceEventId: change.sourceEventId,
    participantAction: true,
  });
  if (committed === "stale") throw new StaleDraftError();
  return committed;
}

/** Commits lifecycle-only events at the current revision. */
export function commitLifecycle(
  core: Parameters<typeof commitDraft>[0],
  draft: DraftRecord,
  events: readonly ReportLifecycleEvent[],
  options: { participantAction: boolean; authorAccountId?: string | null }
): { draft: DraftRecord; refused: ReportLifecycleEvent[] } {
  const { lifecycle, refused } = applyLifecycle(draft.lifecycle, events);
  if (refused.length === events.length) return { draft, refused };
  const committed = commitDraft(core, {
    draftId: draft.id,
    expectedRevision: draft.revision,
    lifecycle,
    participantAction: options.participantAction,
    authorAccountId: options.authorAccountId,
  });
  if (committed === "stale") throw new StaleDraftError();
  return { draft: committed, refused };
}
