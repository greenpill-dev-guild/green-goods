import {
  newReview,
  type ReviewContent,
  reviewContentDigest,
} from "@green-goods/shared/modules/agent-reporting";
import {
  advanceLifecycle,
  agentReviewLifecycle,
  type PersistedLifecycle,
  type ReviewLifecycleContext,
  type ReviewLifecycleEvent,
  startLifecycle,
} from "@green-goods/shared/workflows/agent-reporting";
import type { PublishedWorkView } from "./chain";
import type { ReportingCore } from "./runtime";

/**
 * Steward review intents. A decision has its own owner and lifecycle, separate from the report it
 * reviews, but the same compare-and-swap revisions: every content change becomes the next revision
 * and the previous content is kept in sealed history, so what the steward confirmed can always be
 * reconstructed. Reviewers see published work only, never the gardener's private draft material.
 */
const REVIEW_LIFECYCLE_VERSION = 1;

export type ReviewLifecycle = PersistedLifecycle<ReviewLifecycleContext>;

export interface ReviewRecord {
  id: string;
  participantId: string;
  conversationId: string;
  stewardAccountId: string;
  chainId: number;
  workUID: string;
  revision: number;
  lifecycle: ReviewLifecycle;
  content: ReviewContent;
  workTitle: string;
}

interface ReviewRow {
  id: string;
  participant_id: string;
  conversation_id: string;
  steward_account_id: string;
  chain_id: number;
  work_uid: string;
  revision: number;
  machine_snapshot: string;
  content_ciphertext: string | null;
}

/** Thrown inside a commit transaction when another writer changed the review. */
export class StaleReviewError extends Error {
  constructor() {
    super("Review revision changed during the turn");
  }
}

function contentContext(id: string): string {
  return `review_intents.content:${id}`;
}

function toRecord(core: ReportingCore, row: ReviewRow | null): ReviewRecord | null {
  if (!row?.content_ciphertext) return null;
  const sealed = JSON.parse(core.keyring.open(row.content_ciphertext, contentContext(row.id))) as {
    content: ReviewContent;
    workTitle: string;
  };
  return {
    id: row.id,
    participantId: row.participant_id,
    conversationId: row.conversation_id,
    stewardAccountId: row.steward_account_id,
    chainId: row.chain_id,
    workUID: row.work_uid,
    revision: row.revision,
    lifecycle: JSON.parse(row.machine_snapshot) as ReviewLifecycle,
    content: sealed.content,
    workTitle: sealed.workTitle,
  };
}

export function loadReview(core: ReportingCore, id: string): ReviewRecord | null {
  return toRecord(
    core,
    core.db.query("SELECT * FROM review_intents WHERE id = $id").get({ id }) as ReviewRow | null
  );
}

export function openReviewFor(
  core: ReportingCore,
  participantId: string,
  conversationId: string
): ReviewRecord | null {
  return toRecord(
    core,
    core.db
      .query(
        `SELECT * FROM review_intents WHERE participant_id = $participant AND conversation_id = $conversation
         AND lifecycle = 'open' ORDER BY updated_at DESC LIMIT 1`
      )
      .get({ participant: participantId, conversation: conversationId }) as ReviewRow | null
  );
}

export function reviewState(review: Pick<ReviewRecord, "lifecycle">): string {
  const value = review.lifecycle.value;
  return typeof value === "string" ? value : (Object.keys(value)[0] ?? "");
}

function lifecycleColumn(lifecycle: ReviewLifecycle): "open" | "recorded" | "cancelled" {
  return lifecycle.value === "recorded" || lifecycle.value === "cancelled"
    ? lifecycle.value
    : "open";
}

/**
 * Opens (or resumes) this steward's review of one published work. The work is recorded locally as
 * observed chain state so the intent can reference it; nothing about its author's drafts is read.
 */
export function openReviewIntent(
  core: ReportingCore,
  input: {
    participantId: string;
    conversationId: string;
    stewardAccountId: string;
    chainId: number;
    work: PublishedWorkView;
  }
): ReviewRecord {
  const now = core.clock.now();
  const { work } = input;
  core.db
    .query(
      `INSERT OR IGNORE INTO work_records (chain_id, work_uid, garden_address, action_uid, attester, observed_at)
       VALUES ($chain, $uid, $garden, $action, $attester, $now)`
    )
    .run({
      chain: input.chainId,
      uid: work.workUID,
      garden: work.gardenAddress.toLowerCase(),
      action: String(work.actionUID),
      attester: work.gardenerAddress.toLowerCase(),
      now,
    });
  const existing = core.db
    .query(
      `SELECT * FROM review_intents WHERE chain_id = $chain AND work_uid = $uid
       AND steward_account_id = $steward AND lifecycle = 'open'`
    )
    .get({
      chain: input.chainId,
      uid: work.workUID,
      steward: input.stewardAccountId,
    }) as ReviewRow | null;
  if (existing) return toRecord(core, existing) as ReviewRecord;

  const id = core.ids.id();
  const content = newReview({
    chainId: input.chainId,
    gardenAddress: work.gardenAddress,
    workUID: work.workUID,
    actionUID: work.actionUID,
    gardenerAddress: work.gardenerAddress,
  });
  const lifecycle = startLifecycle<ReviewLifecycleContext>(
    agentReviewLifecycle,
    REVIEW_LIFECYCLE_VERSION
  );
  core.db
    .query(
      `INSERT INTO review_intents
         (id, chain_id, work_uid, participant_id, conversation_id, steward_account_id, revision,
          content_ciphertext, content_digest, machine_snapshot, machine_version, lifecycle, created_at, updated_at)
       VALUES ($id, $chain, $uid, $participant, $conversation, $steward, 1, $content, $digest, $machine,
               $version, 'open', $now, $now)`
    )
    .run({
      id,
      chain: input.chainId,
      uid: work.workUID,
      participant: input.participantId,
      conversation: input.conversationId,
      steward: input.stewardAccountId,
      content: core.keyring.seal(
        JSON.stringify({ content, workTitle: work.title }),
        contentContext(id)
      ),
      digest: reviewContentDigest(content),
      machine: JSON.stringify(lifecycle),
      version: REVIEW_LIFECYCLE_VERSION,
      now,
    });
  return loadReview(core, id) as ReviewRecord;
}

function applyEvents(
  lifecycle: ReviewLifecycle,
  events: readonly ReviewLifecycleEvent[]
): { lifecycle: ReviewLifecycle; refused: ReviewLifecycleEvent[] } {
  let current = lifecycle;
  const refused: ReviewLifecycleEvent[] = [];
  for (const event of events) {
    const result = advanceLifecycle<ReviewLifecycleContext, ReviewLifecycleEvent>(
      agentReviewLifecycle,
      REVIEW_LIFECYCLE_VERSION,
      current,
      event
    );
    if (result.handled) current = result.next;
    else refused.push(event);
  }
  return { lifecycle: current, refused };
}

/**
 * Commits lifecycle events and, optionally, new content as the next revision. The previous content
 * joins the sealed history before it is replaced. Throws StaleReviewError when the revision moved.
 */
export function commitReview(
  core: ReportingCore,
  review: ReviewRecord,
  events: readonly ReviewLifecycleEvent[],
  content?: ReviewContent
): { review: ReviewRecord; refused: ReviewLifecycleEvent[] } {
  const revision = content ? review.revision + 1 : review.revision;
  const withRevision: ReviewLifecycleEvent[] = content
    ? [{ type: "REVISED", revision }, ...events]
    : [...events];
  const { lifecycle, refused } = applyEvents(review.lifecycle, withRevision);
  if (content && refused.some((event) => event.type === "REVISED")) {
    return { review, refused };
  }
  if (!content && refused.length === events.length) return { review, refused };
  const history = content ? appendHistory(core, review) : null;
  const next = content ?? review.content;
  const result = core.db
    .query(
      `UPDATE review_intents
       SET revision = $revision, machine_snapshot = $machine, lifecycle = $lifecycle,
           content_ciphertext = $content, content_digest = $digest,
           history_ciphertext = COALESCE($history, history_ciphertext), updated_at = $now
       WHERE id = $id AND revision = $expected`
    )
    .run({
      id: review.id,
      expected: review.revision,
      revision,
      machine: JSON.stringify(lifecycle),
      lifecycle: lifecycleColumn(lifecycle),
      content: core.keyring.seal(
        JSON.stringify({ content: next, workTitle: review.workTitle }),
        contentContext(review.id)
      ),
      digest: reviewContentDigest(next),
      history,
      now: core.clock.now(),
    });
  if (result.changes !== 1) throw new StaleReviewError();
  return { review: loadReview(core, review.id) as ReviewRecord, refused };
}

function appendHistory(core: ReportingCore, review: ReviewRecord): string {
  const row = core.db
    .query("SELECT history_ciphertext FROM review_intents WHERE id = $id")
    .get({ id: review.id }) as { history_ciphertext: string | null } | null;
  const context = `review_intents.history:${review.id}`;
  const history = row?.history_ciphertext
    ? (JSON.parse(core.keyring.open(row.history_ciphertext, context)) as unknown[])
    : [];
  history.push({ revision: review.revision, content: review.content });
  return core.keyring.seal(JSON.stringify(history), context);
}
