import { issueContinuation, requestById, watchLinkExpiry } from "./continuations";
import type { ConversationWriter } from "./coordinator/writer";
import { lifecycleState } from "./coordinator/draft-commit";
import { inTransaction } from "./database";
import { DraftContentUnavailableError, type DraftRecord, loadDraft } from "./drafts";
import type { ClaimedJob } from "./jobs";
import { conversationRealm, participantWriter } from "./notify";
import type { OperationRecord } from "./operations";
import { accountById, participantEpoch } from "./participants";
import type { ReportingCore } from "./runtime";
import type { JobOutcome } from "./worker";

/**
 * The pages where a report is signed: owner signing for this report alone, or the chat reporting
 * permission together with its first report. A link to one expires 10 minutes after it is sent,
 * and a page opened from it keeps working for up to 15 minutes more. Nothing is sent until the
 * page reserves an attempt, which moves the report out of waiting for a signature. So a report
 * still waiting once every link and page is closed was never sent: the chat says so once, and
 * RETRY sends a fresh link.
 */
const SIGNING_PURPOSES = "('publish_work','grant_reporting')";

/** The lifecycle states in which a report waits for its owner on a signing page. */
const WAITING_FOR_SIGNATURE = new Set(["awaitingWallet", "grantChoice"]);

/**
 * When the last way to sign this report from a link already sent closes: the latest open link,
 * or a page opened from any of them. A page outlives a link that has since been replaced, so pages
 * count whatever their link's state. Null when nothing is open.
 */
function signingOpenUntil(core: ReportingCore, draftId: string): number | null {
  const row = core.db
    .query(
      `SELECT MAX(until) AS until FROM (
         SELECT expires_at AS until FROM continuation_requests
         WHERE resource_id = $draft AND purpose IN ${SIGNING_PURPOSES} AND state = 'open'
           AND expires_at > $now
         UNION ALL
         SELECT s.expires_at FROM app_access_grants s
         JOIN continuation_requests r ON r.id = s.request_id
         WHERE r.resource_id = $draft AND r.purpose IN ${SIGNING_PURPOSES} AND s.state = 'active'
           AND s.expires_at > $now
       )`
    )
    .get({ draft: draftId, now: core.clock.now() }) as { until: number | null } | null;
  return row?.until ?? null;
}

/** Whether a link or page already sent can still sign this report. */
export function signingLinkOpen(core: ReportingCore, draftId: string): boolean {
  return signingOpenUntil(core, draftId) !== null;
}

/** The report's most recent signing link, whatever its state. */
function latestSigningRequest(
  core: ReportingCore,
  draftId: string
): { id: string; revision: number | null } | null {
  const row = core.db
    .query(
      `SELECT id, resource_revision FROM continuation_requests
       WHERE resource_id = $draft AND purpose IN ${SIGNING_PURPOSES}
       ORDER BY created_at DESC, rowid DESC LIMIT 1`
    )
    .get({ draft: draftId }) as { id: string; resource_revision: number | null } | null;
  return row ? { id: row.id, revision: row.resource_revision } : null;
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

/** Whether the chat has already said, since this link expired, that it did (STATUS says it too). */
function lapseAlreadyTold(core: ReportingCore, conversationId: string, expiredAt: number): boolean {
  return (
    core.db
      .query(
        `SELECT 1 FROM delivery_outbox WHERE conversation_id = $conversation
           AND reply_kind = 'publish.linkExpired' AND created_at >= $expiredAt LIMIT 1`
      )
      .get({ conversation: conversationId, expiredAt }) !== null
  );
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
 * Runs when a report's signing link expires. A newer link for the report is watched on its own, so
 * only the latest one speaks; a page still open from any of them moves the watch to when that page
 * closes. Once nothing is left and the report still waits for a signature, the chat hears it once.
 */
export function watchSigningLinkJob(core: ReportingCore, job: ClaimedJob): JobOutcome {
  return inTransaction(core.db, (): JobOutcome => {
    const request = requestById(core, job.subjectId);
    const draftId = request?.resourceId;
    if (!request || !draftId || latestSigningRequest(core, draftId)?.id !== request.id)
      return { status: "done" };
    const until = signingOpenUntil(core, draftId);
    if (until !== null) {
      watchLinkExpiry(core, request.id, until);
      return { status: "done" };
    }
    const draft = waitingDraft(core, draftId, request.resourceRevision);
    if (!draft || lapseAlreadyTold(core, draft.conversationId, request.expiresAt))
      return { status: "done" };
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
