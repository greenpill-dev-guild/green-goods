import type { PendingProof } from "@green-goods/shared/hooks/client-ui/commitment/usePendingProof";
import type { DraftWithImages } from "@green-goods/shared/hooks/work/useDrafts";
import type { WorkUploads } from "@green-goods/shared/hooks/work/useWorkUploads";
import type { Work } from "@green-goods/shared/types/domain";
import { toWorkDisplayTitle } from "@green-goods/shared/utils/work/workTitles";
import type { IntlShape } from "react-intl";
import { formatAgo, formatRowDay, formatSavedMeta } from "@/components/Cards/Work/pendingCopy";
import type { PendingCardProps } from "@/components/Cards/Work/PendingCard";
import {
  blockedShortReasonMessage,
  readQueuedWorkState,
} from "@/components/Cards/Work/queuedWorkCopy";
import { canDiscardQueuedWork, workUploadGroup } from "@/components/Cards/Work/workUploadGroup";
import { describeProofContents } from "@/components/Features/Commitments/proofContents";
import type { PendingPlace } from "./pendingRows";

type RowCard = Pick<
  PendingCardProps,
  "kind" | "pill" | "title" | "meta" | "marker" | "status" | "statusTone" | "locked"
>;

/** One row of Your Work › Pending, with what opening and discarding it act on. */
export type PendingRow = PendingPlace & { id: string } & (
    | { type: "work"; work: Work; card: RowCard; discardable: boolean }
    | { type: "decision"; work: Work; card: RowCard }
    | { type: "toReview"; work: Work; card: RowCard }
    | { type: "draft"; draft: DraftWithImages }
    | { type: "proof"; proof: PendingProof; card: RowCard }
  );

export interface PendingRowContext {
  intl: IntlShape;
  isOnline: boolean;
  pausedForDataSaver: boolean;
  /**
   * The reader sends queued proof themselves (a wallet sign-in). Nothing sends
   * or checks it for them, so its row never says it will.
   */
  sendsFromTap: boolean;
  /** The action's own name, which titles work its record doesn't name. */
  actionTitle: (actionUID: number) => string | undefined;
  /** Work a promise counts: linked on the record, or by a queued link. */
  isLinked: (work: Work) => boolean;
}

type QueuedDecision = NonNullable<ReturnType<WorkUploads["decisionFor"]>>;

const message = (intl: IntlShape, id: string, values?: Record<string, string | number>) =>
  intl.formatMessage({ id }, values);

function workTitle(work: Work, context: PendingRowContext): string {
  return (
    toWorkDisplayTitle(work.title, "") ||
    context.actionTitle(work.actionUID) ||
    message(context.intl, "app.workCard.untitledWork")
  );
}

function linkedMarker(work: Work, context: PendingRowContext): RowCard["marker"] {
  return context.isLinked(work)
    ? { kind: "linked", label: message(context.intl, "app.pending.marker.linked") }
    : undefined;
}

/** A row that is sent, or may be, and is being checked: nothing can be done to it meanwhile. */
function checkingCard(
  base: Pick<RowCard, "title" | "meta" | "marker">,
  context: PendingRowContext
) {
  return {
    ...base,
    kind: "checking",
    pill: message(context.intl, "app.uploads.chip.checking"),
    status: message(
      context.intl,
      context.isOnline ? "app.pending.status.checking" : "app.pending.status.checksWhenConnected"
    ),
    locked: true,
  } satisfies RowCard;
}

/**
 * Your own work: on this phone it says where its upload stands, the way its
 * page does; once on the record it waits for a review (O2).
 */
export function submissionRow(
  work: Work,
  onThisDevice: boolean,
  context: PendingRowContext
): PendingRow {
  const { intl } = context;
  const at = work.createdAt * 1000;
  const base = { title: workTitle(work, context), marker: linkedMarker(work, context) };
  const row = { id: work.id, type: "work" as const, source: "work" as const, at, work };
  if (!onThisDevice) {
    const card: RowCard = {
      ...base,
      kind: "review",
      pill: message(intl, "app.pending.pill.inReview"),
      meta: message(intl, "app.pending.meta.submitted", { date: formatRowDay(intl, at) }),
      status: message(intl, "app.pending.status.waitingForReview"),
    };
    return { ...row, kind: "review", card, discardable: false };
  }

  const state = readQueuedWorkState(work.metadata);
  const discardable = canDiscardQueuedWork(state.submissionState, {
    isOnline: context.isOnline,
    pausedForDataSaver: context.pausedForDataSaver,
  });
  const saved = { ...base, meta: formatSavedMeta(intl, at) };
  const toUpload = (status: string, locked = false): RowCard => ({
    ...saved,
    kind: "upload",
    pill: message(intl, "app.uploads.chip.toUpload"),
    status,
    locked,
  });
  const card = ((): RowCard => {
    switch (workUploadGroup(state.submissionState)) {
      case "attention":
        return {
          ...saved,
          kind: "needs",
          pill: message(intl, "app.pending.pill.cantUpload"),
          status: intl.formatMessage(blockedShortReasonMessage(state)),
          statusTone: "error",
        };
      case "failed":
        return state.submissionState === "reverted"
          ? {
              ...saved,
              kind: "needs",
              pill: message(intl, "app.pending.pill.didntUpload"),
              status: message(intl, "app.uploads.blocked.short.refused"),
              statusTone: "error",
            }
          : {
              ...saved,
              kind: "needs",
              pill: message(intl, "app.pending.pill.didntUpload"),
              status: message(intl, "app.pending.status.nothingWasSent"),
            };
      case "sent":
        return state.submissionState === "sending" && context.isOnline
          ? toUpload(message(intl, "app.pending.status.uploadingNow"), true)
          : checkingCard(saved, context);
      case "preparing":
        // A photo still converting says so either way; plain preparation needs the connection.
        return toUpload(
          state.submissionState === "photo-pending"
            ? message(intl, "app.uploads.state.photoPending")
            : message(
                intl,
                context.isOnline
                  ? "app.uploads.state.preparing"
                  : "app.pending.status.uploadsWhenConnected"
              )
        );
      default:
        return toUpload(
          message(
            intl,
            context.isOnline
              ? "app.pending.status.nothingSent"
              : "app.pending.status.uploadsWhenConnected"
          )
        );
    }
  })();
  return { ...row, kind: card.kind, card, discardable };
}

/**
 * A review you made on this phone that is still on its way to the record. It
 * sorts by when the review was saved, not by when the work was submitted.
 */
export function decisionRow(
  work: Work,
  decision: QueuedDecision | undefined,
  context: PendingRowContext
): PendingRow {
  const { intl } = context;
  const status = decision?.status;
  const base = {
    title: workTitle(work, context),
    meta: message(intl, "app.pending.meta.yourReview"),
    marker: linkedMarker(work, context),
  };
  const card = ((): RowCard => {
    switch (status?.state) {
      case "sent":
        return checkingCard(base, context);
      case "blocked":
      case "photo-needs-attention":
        return {
          ...base,
          kind: "needs",
          pill: message(intl, "app.pending.pill.cantUpload"),
          status: intl.formatMessage(
            blockedShortReasonMessage({
              submissionState: status.state,
              blockedReason: status.reason,
            })
          ),
          statusTone: "error",
        };
      case "failed":
      case "reverted":
        return {
          ...base,
          kind: "needs",
          pill: message(intl, "app.pending.pill.didntUpload"),
          status: message(intl, "app.pending.status.nothingWasSent"),
        };
      default:
        return {
          ...base,
          kind: "upload",
          pill: message(intl, "app.uploads.chip.toUpload"),
          status: message(
            intl,
            context.isOnline
              ? "app.pending.status.reviewSaved"
              : "app.pending.status.uploadsWhenConnected"
          ),
        };
    }
  })();
  return {
    id: `decision:${work.id}`,
    type: "decision",
    kind: card.kind,
    source: "work",
    at: decision?.savedAt ?? work.createdAt * 1000,
    work,
    card,
  };
}

/** Work in a garden you steward that waits for your review. */
export function toReviewRow(work: Work, context: PendingRowContext): PendingRow {
  const { intl } = context;
  const at = work.createdAt * 1000;
  const card: RowCard = {
    kind: "needsReview",
    pill: message(intl, "app.pending.pill.toReview"),
    title: workTitle(work, context),
    meta: message(intl, "app.pending.meta.submittedBy", { date: formatRowDay(intl, at) }),
    marker: linkedMarker(work, context),
    status: message(intl, "app.pending.status.waitingForYourReview"),
  };
  return {
    id: `review:${work.id}`,
    type: "toReview",
    kind: "needsReview",
    source: "work",
    at,
    work,
    card,
  };
}

export function draftRow(draft: DraftWithImages): PendingRow {
  return {
    id: `draft:${draft.id}`,
    type: "draft",
    kind: "draft",
    source: "work",
    at: draft.updatedAt,
    draft,
  };
}

/**
 * Proof still on this phone (D13), named by its promise: a draft not added
 * yet, or proof the queue holds to send.
 *
 * The background flush sends queued proof, and checks one already sent, for a
 * passkey or embedded reader. A wallet reader does both from the promise this
 * row opens, so their row says to open it and never that it goes by itself.
 */
export function proofRow(proof: PendingProof, context: PendingRowContext): PendingRow {
  const { intl, sendsFromTap } = context;
  const base = {
    title: proof.title ?? message(intl, "app.commitments.row.untitled"),
    marker: { kind: "proof" as const, label: message(intl, "app.pending.marker.proof") },
  };
  const row = {
    id: `proof:${proof.id}`,
    type: "proof" as const,
    source: "proof" as const,
    at: proof.savedAt,
    proof,
  };
  if (proof.source === "draft") {
    const contents =
      describeProofContents(intl, proof.contents, { words: "alone" }) ??
      message(intl, "app.proof.contents.words");
    const card: RowCard = {
      ...base,
      kind: "draft",
      pill: message(intl, "app.draft.status"),
      meta: message(intl, "app.pending.meta.edited", { when: formatAgo(intl, proof.savedAt) }),
      status: message(intl, "app.pending.status.proofDraft", { contents }),
    };
    return { ...row, kind: "draft", card };
  }

  const saved = { ...base, meta: formatSavedMeta(intl, proof.savedAt) };
  const card = ((): RowCard => {
    if (proof.failed)
      return {
        ...saved,
        kind: "needs",
        pill: message(intl, "app.pending.pill.didntUpload"),
        status: message(intl, "app.pending.status.notAdded"),
      };
    if (proof.waitingReason === "awaiting-confirmation") {
      const checking = checkingCard(saved, context);
      if (!sendsFromTap) return checking;
      const status = context.isOnline
        ? "app.pending.status.openToCheck"
        : "app.pending.status.checkAgainWhenConnected";
      return { ...checking, status: message(intl, status), locked: false };
    }
    const toUpload = (status: string, locked = false): RowCard => ({
      ...saved,
      kind: "upload",
      pill: message(intl, "app.uploads.chip.toUpload"),
      status,
      locked,
    });
    if (proof.sending) return toUpload(message(intl, "app.pending.status.uploadingNow"), true);
    if (!context.isOnline) {
      return toUpload(
        message(
          intl,
          sendsFromTap
            ? "app.pending.status.sendItWhenConnected"
            : "app.pending.status.sendsWhenConnected"
        )
      );
    }
    if (sendsFromTap) return toUpload(message(intl, "app.pending.status.openToSend"));
    return toUpload(
      message(
        intl,
        proof.waitingReason === "send-intent-expired"
          ? "app.pending.status.nothingWasSent"
          : "app.pending.status.nothingSent"
      )
    );
  })();
  return { ...row, kind: card.kind, card };
}
