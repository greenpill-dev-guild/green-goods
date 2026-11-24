import { toastService } from "@green-goods/shared/components/Toast/toast.service";
import {
  discardPendingProof,
  type PendingProof,
} from "@green-goods/shared/hooks/client-ui/commitment/usePendingProof";
import { logger } from "@green-goods/shared/modules/app/logger";
import type { IntlShape } from "react-intl";
import type { PendingRow } from "./buildPendingRows";

/**
 * Discarding a Your Work › Pending row: what the guard asks for each kind of
 * row, and the discard of a work draft or of proof, each saying how it went.
 * Queued work is discarded through its own queue hook in the tab.
 */
export function discardCopy(intl: IntlShape, row: PendingRow | null) {
  const text = (id: string) => intl.formatMessage({ id });
  if (row?.type === "draft")
    return {
      title: text("app.drafts.delete.title"),
      description: text("app.drafts.delete.description"),
      confirmLabel: text("app.drafts.delete.confirm"),
      cancelLabel: text("app.drafts.delete.cancel"),
    };
  return {
    title: text(
      row?.type === "proof" ? "app.pending.proofDiscard.title" : "app.uploads.discardConfirmTitle"
    ),
    description: text(
      row?.type === "proof"
        ? "app.pending.proofDiscard.description"
        : "app.uploads.discardConfirmDescription"
    ),
    confirmLabel: text("app.uploads.discard"),
    cancelLabel: text("app.uploads.keep"),
  };
}

export async function deleteWorkDraft(
  intl: IntlShape,
  deleteDraft: (draftId: string) => Promise<unknown>,
  draftId: string
) {
  try {
    await deleteDraft(draftId);
  } catch (error) {
    logger.error("[PendingTab] Failed to delete draft", { error });
    toastService.error({
      title: intl.formatMessage({ id: "app.drafts.delete.error" }),
      message: intl.formatMessage({ id: "app.drafts.delete.errorMessage" }),
      context: "drafts",
    });
  }
}

/** The queue refuses a proof that may already be on its way; that is said, not logged as a fault. */
export async function discardProof(intl: IntlShape, proof: PendingProof) {
  const toast = { id: "pending-proof-discard", context: "pending proof" } as const;
  try {
    const discarded = await discardPendingProof(proof);
    if (discarded) {
      toastService.success({
        ...toast,
        title: intl.formatMessage({ id: "app.pending.proofDiscarded.title" }),
        message: intl.formatMessage({ id: "app.uploads.discardedMessage" }),
      });
      return;
    }
    toastService.error({
      ...toast,
      title: intl.formatMessage({ id: "app.pending.proofDiscardFailed.title" }),
      message: intl.formatMessage({ id: "app.pending.proofDiscardRefused.message" }),
    });
  } catch (error) {
    logger.error("[PendingTab] Could not discard the proof", { error, proofId: proof.id });
    toastService.error({
      ...toast,
      title: intl.formatMessage({ id: "app.pending.proofDiscardFailed.title" }),
      message: intl.formatMessage({ id: "app.pending.proofDiscardFailed.message" }),
      error,
    });
  }
}
