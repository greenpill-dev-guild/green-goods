import type { PublicationEnvelope } from "@green-goods/shared/modules/agent-reporting";
import { getEASExplorerUrl } from "@green-goods/shared/utils/eas/explorers";
import { activeConsentId, hasPublicationConsent } from "./consent";
import { invalidateConfirmation } from "./confirmations";
import { commitLifecycle, lifecycleState } from "./coordinator/draft-commit";
import { askConfirmation } from "./coordinator/prompting";
import { DraftContentUnavailableError, type DraftRecord, loadDraft } from "./drafts";
import { enqueueJob } from "./jobs";
import { participantWriter } from "./notify";
import type { OperationRecord } from "./operations";
import { publicationRecords } from "./publication-records";
import { reopenReview } from "./review-jobs";
import { commitReview, loadReview, type ReviewRecord, reviewState } from "./reviews";
import type { ReportingCore } from "./runtime";

/**
 * What an execution operation publishes: a gardener's report or a steward's decision. Signing,
 * outcomes and reconciliation are shared; each subject keeps its own lifecycle, consent rule,
 * required role and reply. Both lifecycles name the execution events identically.
 */
export type SubjectEvent =
  | "ATTEMPT_RESERVED"
  | "BROADCAST"
  | "OUTCOME_UNCERTAIN"
  | "RECEIPT_VERIFIED";

export type ReopenReason =
  | "rejected_before_send"
  | "preparation_failed"
  | "reverted"
  /** A delegated operation whose grant can no longer be used; the owner can still sign it. */
  | "grant_unavailable";

export interface OperationSubject {
  kind: "draft" | "review";
  id: string;
  participantId: string;
  conversationId: string;
  revision: number;
  /** The owner may reserve an attempt only while the subject waits for their signature. */
  awaitingOwner: boolean;
  /** Reports need a gardener or operator; decisions need an operator. */
  requiresOperator: boolean;
  /** Processing consent, plus publication consent for a report's confirmed digest. */
  consented(summaryDigest: string): boolean;
  advance(event: SubjectEvent, participantAction: boolean): void;
  /** Proven rejection, preparation failure or definitive revert: ask for renewed intent. */
  reopen(reason: ReopenReason, account: string | null, prefix: string): void;
  /** A verified publication: record it and tell its author once. */
  recorded(
    verified: { uid: string; transactionHash: string },
    envelope: PublicationEnvelope,
    prefix: string
  ): void;
}

function channelSubject(core: ReportingCore, participantId: string, conversationId: string) {
  return participantWriter(core, { participantId, conversationId, dedupePrefix: "subject" })?.target
    .subjectId;
}

function draftSubject(core: ReportingCore, loaded: DraftRecord): OperationSubject {
  let draft = loaded;
  const writer = (prefix: string) =>
    participantWriter(core, {
      participantId: draft.participantId,
      conversationId: draft.conversationId,
      dedupePrefix: prefix,
    });
  return {
    kind: "draft",
    id: draft.id,
    participantId: draft.participantId,
    conversationId: draft.conversationId,
    revision: draft.revision,
    awaitingOwner: lifecycleState(draft) === "awaitingWallet",
    requiresOperator: false,
    consented(summaryDigest) {
      const subject = channelSubject(core, draft.participantId, draft.conversationId);
      return (
        Boolean(subject && activeConsentId(core, subject, "processing")) &&
        hasPublicationConsent(core, draft.id, draft.revision, summaryDigest)
      );
    },
    advance(event, participantAction) {
      draft = commitLifecycle(core, draft, [{ type: event }], { participantAction }).draft;
    },
    reopen(reason, account, prefix) {
      const event = reason === "reverted" ? "DEFINITIVE_FAILURE" : "REJECTED_BEFORE_SEND";
      const { draft: reviewed } = commitLifecycle(core, draft, [{ type: event }], {
        participantAction: reason === "rejected_before_send" || reason === "preparation_failed",
      });
      invalidateConfirmation(core, { draftId: draft.id });
      const out = writer(prefix);
      if (!out) return;
      out.say(
        reason === "reverted"
          ? "publish.reverted"
          : reason === "rejected_before_send"
            ? "publish.rejected"
            : reason === "grant_unavailable"
              ? "grant.unavailable"
              : "publish.preparationFailed"
      );
      askConfirmation(out, reviewed, account);
    },
    recorded(verified, envelope, prefix) {
      if (envelope.kind !== "work") return;
      core.db
        .query(
          `INSERT OR IGNORE INTO work_records
             (chain_id, work_uid, draft_id, garden_address, action_uid, attester, transaction_hash, published_revision, observed_at)
           VALUES ($chain, $uid, $draft, $garden, $action, $attester, $tx, $revision, $now)`
        )
        .run({
          chain: envelope.chainId,
          uid: verified.uid,
          draft: draft.id,
          garden: envelope.gardenAddress,
          action: envelope.fields.actionUID,
          attester: envelope.accountAddress,
          tx: verified.transactionHash,
          revision: envelope.revision,
          now: core.clock.now(),
        });
      draft = commitLifecycle(core, draft, [{ type: "RECEIPT_VERIFIED" }], {
        participantAction: false,
      }).draft;
      const out = writer(prefix);
      out?.sayWithRecords(
        "publish.published",
        publicationRecords((key) => out.text(key), {
          chainId: envelope.chainId,
          attestationUid: verified.uid,
          transactionHash: verified.transactionHash,
        })
      );
      enqueueJob(core, {
        kind: "purge_private_content",
        subjectId: draft.id,
        dedupeKey: `purge:published:${draft.id}`,
        payload: { scope: "draft" },
      });
    },
  };
}

function reviewSubject(core: ReportingCore, loaded: ReviewRecord): OperationSubject {
  let review = loaded;
  return {
    kind: "review",
    id: review.id,
    participantId: review.participantId,
    conversationId: review.conversationId,
    revision: review.revision,
    awaitingOwner: reviewState(review) === "awaitingSignature",
    requiresOperator: true,
    consented() {
      const subject = channelSubject(core, review.participantId, review.conversationId);
      return Boolean(subject && activeConsentId(core, subject, "processing"));
    },
    advance(event) {
      review = commitReview(core, review, [{ type: event }]).review;
    },
    reopen(reason, _account, prefix) {
      const event = reason === "reverted" ? "DEFINITIVE_FAILURE" : "REJECTED_BEFORE_SEND";
      commitReview(core, review, [{ type: event }]);
      invalidateConfirmation(core, { reviewIntentId: review.id });
      reopenReview(
        core,
        review.id,
        prefix,
        reason === "reverted"
          ? "review.reverted"
          : reason === "grant_unavailable"
            ? "grant.unavailable"
            : "review.rejectedBeforeSend"
      );
    },
    recorded(verified, envelope, prefix) {
      review = commitReview(core, review, [{ type: "RECEIPT_VERIFIED" }]).review;
      const out = participantWriter(core, {
        participantId: review.participantId,
        conversationId: review.conversationId,
        dedupePrefix: prefix,
      });
      // The decision's own attestation leads; the work it decided is a different attestation.
      out?.sayWithRecords("review.recorded", [
        ...publicationRecords((key) => out.text(key), {
          chainId: envelope.chainId,
          attestationUid: verified.uid,
          transactionHash: verified.transactionHash,
        }),
        {
          url: getEASExplorerUrl(review.chainId, review.workUID),
          label: out.text("review.viewWork"),
        },
      ]);
    },
  };
}

export function operationSubject(
  core: ReportingCore,
  operation: Pick<OperationRecord, "draftId" | "reviewIntentId">
): OperationSubject | null {
  if (operation.reviewIntentId) {
    const review = loadReview(core, operation.reviewIntentId);
    return review ? reviewSubject(core, review) : null;
  }
  if (!operation.draftId) return null;
  try {
    const draft = loadDraft(core, operation.draftId);
    return draft ? draftSubject(core, draft) : null;
  } catch (error) {
    if (error instanceof DraftContentUnavailableError) return null;
    throw error;
  }
}
