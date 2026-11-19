import { issueContinuation, requestById, watchLinkExpiry } from "./continuations";
import type { ConversationWriter } from "./coordinator/writer";
import { lifecycleState } from "./coordinator/draft-commit";
import { inTransaction } from "./database";
import { DraftContentUnavailableError, type DraftRecord, loadDraft } from "./drafts";
import type { ClaimedJob } from "./jobs";
import { conversationRealm, participantWriter } from "./notify";
import type { OperationRecord } from "./operations";
import { openPrompt } from "./prompts";
import { type AccountBinding, accountById, participantEpoch } from "./participants";
import { loadReview, type ReviewRecord, reviewState } from "./reviews";
import type { ReportingCore } from "./runtime";
import type { JobOutcome } from "./worker";

/**
 * The pages where a report is signed: owner signing for this report alone, or the chat reporting
 * permission together with its first report. A steward's decision has the same pair: owner signing
 * for this decision alone, or the review permission together with it. A link to one expires 10
 * minutes after it is sent, and a page opened from it keeps working for up to 15 minutes more.
 * Nothing is sent until the page reserves an attempt, which moves the report or decision out of
 * waiting for a signature. So one still waiting once every link and page is closed was never sent:
 * the chat says so once, and RETRY sends a fresh link.
 */
const REPORT_SIGNING = "('publish_work','grant_reporting')";
const REVIEW_SIGNING = "('review_decision','grant_review')";
type SigningPurposes = typeof REPORT_SIGNING | typeof REVIEW_SIGNING;

function signingPurposes(purpose: string): SigningPurposes {
  return purpose === "review_decision" || purpose === "grant_review"
    ? REVIEW_SIGNING
    : REPORT_SIGNING;
}

/** The lifecycle states in which a report waits for its owner on a signing page. */
const WAITING_FOR_SIGNATURE = new Set(["awaitingWallet", "grantChoice"]);

/**
 * When the last way to sign this report or decision from a link already sent closes: the latest
 * open link, or a page opened from any of them. An owner signing page outlives a link that has
 * since been replaced and can still sign. A permission page whose link a later answer in the chat
 * revoked cannot: its proposal is refused and its permission retired. Null when nothing is open.
 */
function signingOpenUntil(
  core: ReportingCore,
  resourceId: string,
  purposes: SigningPurposes = REPORT_SIGNING
): number | null {
  const row = core.db
    .query(
      `SELECT MAX(until) AS until FROM (
         SELECT expires_at AS until FROM continuation_requests
         WHERE resource_id = $resource AND purpose IN ${purposes} AND state = 'open'
           AND expires_at > $now
         UNION ALL
         SELECT s.expires_at FROM app_access_grants s
         JOIN continuation_requests r ON r.id = s.request_id
         WHERE r.resource_id = $resource AND r.purpose IN ${purposes} AND s.state = 'active'
           AND s.expires_at > $now
           AND NOT (r.purpose IN ('grant_reporting','grant_review') AND r.state = 'revoked')
       )`
    )
    .get({ resource: resourceId, now: core.clock.now() }) as { until: number | null } | null;
  return row?.until ?? null;
}

/** Whether a link or page already sent can still sign this report. */
export function signingLinkOpen(core: ReportingCore, draftId: string): boolean {
  return signingOpenUntil(core, draftId) !== null;
}

/** The most recent signing link for a report or decision, whatever its state. */
function latestSigningRequest(
  core: ReportingCore,
  resourceId: string,
  purposes: SigningPurposes = REPORT_SIGNING
): { id: string; revision: number | null; createdAt: number; rowid: number } | null {
  const row = core.db
    .query(
      `SELECT id, resource_revision, created_at, rowid FROM continuation_requests
       WHERE resource_id = $resource AND purpose IN ${purposes}
       ORDER BY created_at DESC, rowid DESC LIMIT 1`
    )
    .get({ resource: resourceId }) as {
    id: string;
    resource_revision: number | null;
    created_at: number;
    rowid: number;
  } | null;
  return row
    ? { id: row.id, revision: row.resource_revision, createdAt: row.created_at, rowid: row.rowid }
    : null;
}

/**
 * Whether a decision waiting for its signature had its link sent after any the report beside it
 * was sent, so a request for a new link means the decision's.
 */
export function decisionLinkIsLatest(
  core: ReportingCore,
  review: ReviewRecord,
  draftId: string | null
): boolean {
  if (reviewState(review) !== "awaitingSignature") return false;
  const decision = latestSigningRequest(core, review.id, REVIEW_SIGNING);
  const report = draftId ? latestSigningRequest(core, draftId) : null;
  if (!decision) return false;
  // Links sent in the same instant are told apart by the order they were stored in.
  return (
    !report ||
    decision.createdAt > report.createdAt ||
    (decision.createdAt === report.createdAt && decision.rowid > report.rowid)
  );
}

/**
 * Whether a report waits for a signature that no link or page can give any more. A report waiting
 * on its owner that was never sent a link (a chat that had no recipient at the time) counts too:
 * either way, RETRY is the way on.
 */
export function signingLinkLapsed(core: ReportingCore, draft: DraftRecord): boolean {
  const state = lifecycleState(draft);
  if (!WAITING_FOR_SIGNATURE.has(state) || signingOpenUntil(core, draft.id) !== null) return false;
  if (state === "awaitingWallet") return true;
  // Before the owner picks how to publish, no link is due yet.
  return latestSigningRequest(core, draft.id)?.revision === draft.revision;
}

/**
 * Checks the report's latest signing link again now. A first report prepared from the permission
 * page gets no link of its own, and its preparation can outlast the page, so the check that ran
 * when the page closed found the report still being prepared. This one finds it waiting.
 */
export function rewatchSigningLink(core: ReportingCore, draftId: string): void {
  const latest = latestSigningRequest(core, draftId);
  if (latest) watchLinkExpiry(core, latest.id, core.clock.now());
}

/**
 * Whether a steward's confirmed decision waits for a signature that no link or page can give any
 * more. RETRY sends a fresh link, as it does for a report.
 */
export function reviewLinkLapsed(core: ReportingCore, review: ReviewRecord): boolean {
  return (
    reviewState(review) === "awaitingSignature" &&
    signingOpenUntil(core, review.id, REVIEW_SIGNING) === null
  );
}

type LapseReply = "publish.linkExpired" | "review.linkExpired";

/** Whether the chat has already said, since this link expired, that it did (STATUS says it too). */
function lapseAlreadyTold(
  core: ReportingCore,
  conversationId: string,
  expiredAt: number,
  reply: LapseReply
): boolean {
  return (
    core.db
      .query(
        `SELECT 1 FROM delivery_outbox WHERE conversation_id = $conversation
           AND reply_kind = $reply AND created_at >= $expiredAt LIMIT 1`
      )
      .get({ conversation: conversationId, expiredAt, reply }) !== null
  );
}

/** The decision a link was sent for, if it still waits for that revision to be signed. */
function waitingReview(core: ReportingCore, reviewId: string, revision: number | null) {
  const review = loadReview(core, reviewId);
  return review && review.revision === revision && reviewState(review) === "awaitingSignature"
    ? review
    : null;
}

function waitingDraft(core: ReportingCore, draftId: string, revision: number | null) {
  let draft: DraftRecord | null;
  try {
    draft = loadDraft(core, draftId);
  } catch (error) {
    if (error instanceof DraftContentUnavailableError) return null;
    throw error;
  }
  return draft && draft.revision === revision && WAITING_FOR_SIGNATURE.has(lifecycleState(draft))
    ? draft
    : null;
}

/**
 * Runs when a report's or decision's signing link expires. A newer link for it is watched on its
 * own, so only the latest one speaks; a page still open from any of them moves the watch to when
 * that page closes. Once nothing is left and it still waits for a signature, the chat hears it once.
 */
export function watchSigningLinkJob(core: ReportingCore, job: ClaimedJob): JobOutcome {
  return inTransaction(core.db, (): JobOutcome => {
    const request = requestById(core, job.subjectId);
    const resourceId = request?.resourceId;
    if (!request || !resourceId) return { status: "done" };
    const purposes = signingPurposes(request.purpose);
    if (latestSigningRequest(core, resourceId, purposes)?.id !== request.id)
      return { status: "done" };
    const until = signingOpenUntil(core, resourceId, purposes);
    if (until !== null) {
      watchLinkExpiry(core, request.id, until);
      return { status: "done" };
    }
    if (purposes === REVIEW_SIGNING) {
      const review = waitingReview(core, resourceId, request.resourceRevision);
      if (
        review &&
        !lapseAlreadyTold(core, review.conversationId, request.expiresAt, "review.linkExpired")
      )
        participantWriter(core, {
          participantId: review.participantId,
          conversationId: review.conversationId,
          dedupePrefix: `link-expired:${request.id}`,
        })?.say("review.linkExpired");
      return { status: "done" };
    }
    const draft = waitingDraft(core, resourceId, request.resourceRevision);
    if (
      !draft ||
      lapseAlreadyTold(core, draft.conversationId, request.expiresAt, "publish.linkExpired")
    )
      return { status: "done" };
    // A choice asked again by RETRY is what the report waits on now, as STATUS says; its answer
    // brings a new link, watched on its own.
    const prompt = openPrompt(core, draft.conversationId);
    if (prompt?.kind === "grant_choice" && prompt.subjectId === draft.id) return { status: "done" };
    participantWriter(core, {
      participantId: draft.participantId,
      conversationId: draft.conversationId,
      dedupePrefix: `link-expired:${request.id}`,
    })?.say("publish.linkExpired");
    return { status: "done" };
  });
}

/**
 * Sends the link to sign a prepared report with the owner's own account. A new link replaces the
 * report's previous one. False when there is nobody to send it to.
 */
export function sendSigningLink(
  core: ReportingCore,
  out: ConversationWriter,
  draft: DraftRecord,
  operation: OperationRecord
): boolean {
  const account = accountById(core, operation.authorAccountId);
  const binding = out.target.binding;
  if (!account || !binding || !operation.envelope) return false;
  const { url } = issueContinuation(core, {
    purpose: "publish_work",
    participantId: draft.participantId,
    subjectId: out.target.subjectId,
    bindingId: binding.bindingId,
    conversationId: draft.conversationId,
    providerRealm: conversationRealm(core, draft.conversationId),
    resourceKind: "draft",
    resourceId: draft.id,
    resourceRevision: draft.revision,
    resourceDigest: operation.envelope.payloadDigest,
    expectedAccount: account.address,
    identityEpoch: participantEpoch(core, draft.participantId),
  });
  out.say(
    "publish.signLink",
    { kind: out.text(account.kind === "eoa" ? "account.wallet" : "account.passkey") },
    { url, label: out.text("publish.signLabel") }
  );
  return true;
}

/**
 * Sends the link to sign a confirmed decision with the steward's own account. A new link replaces
 * the decision's previous one. False when there is nobody to send it to.
 */
export function sendReviewSigningLink(
  core: ReportingCore,
  out: ConversationWriter,
  review: ReviewRecord,
  operation: OperationRecord,
  account: AccountBinding,
  /** The epoch the decision's confirmation was checked against; the current one by default. */
  identityEpoch = participantEpoch(core, review.participantId)
): boolean {
  const binding = out.target.binding;
  if (!binding || !operation.envelope) return false;
  const { url } = issueContinuation(core, {
    purpose: "review_decision",
    participantId: review.participantId,
    subjectId: out.target.subjectId,
    bindingId: binding.bindingId,
    conversationId: review.conversationId,
    providerRealm: conversationRealm(core, review.conversationId),
    resourceKind: "review",
    resourceId: review.id,
    resourceRevision: review.revision,
    resourceDigest: operation.envelope.payloadDigest,
    expectedAccount: account.address,
    identityEpoch,
  });
  out.say(
    "review.signLink",
    { kind: out.text(account.kind === "eoa" ? "account.wallet" : "account.passkey") },
    { url, label: out.text("review.signLabel") }
  );
  return true;
}
