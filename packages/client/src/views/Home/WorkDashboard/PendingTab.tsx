import { Button } from "@green-goods/shared/components/Button";
import { ConfirmDialog } from "@green-goods/shared/components/Dialog/ConfirmDialog";
import { NativeSelect } from "@green-goods/shared/components/Form/ControlPrimitives";
import { toastService } from "@green-goods/shared/components/Toast/toast.service";
import { DEFAULT_CHAIN_ID } from "@green-goods/shared/config/default-chain";
import { useActions } from "@green-goods/shared/hooks/blockchain/useBaseLists";
import {
  discardPendingProof,
  type PendingProof,
  usePendingProof,
} from "@green-goods/shared/hooks/client-ui/commitment/usePendingProof";
import { useCommitmentJobs } from "@green-goods/shared/hooks/commitment-pooling/useCommitmentJobs";
import { useLinkedWorkUIDs } from "@green-goods/shared/hooks/commitment-pooling/useCommitmentPooling";
import { useCommitmentQueueState } from "@green-goods/shared/hooks/commitment-pooling/useCommitmentQueueState";
import { useDrafts } from "@green-goods/shared/hooks/work/useDrafts";
import { useQueuedWorkActions } from "@green-goods/shared/hooks/work/useQueuedWorkActions";
import { useWorkPreviewUrls } from "@green-goods/shared/hooks/work/useWorkImages";
import type { WorkUploads } from "@green-goods/shared/hooks/work/useWorkUploads";
import { logger } from "@green-goods/shared/modules/app/logger";
import type { WorkDashboardPendingFilter } from "@green-goods/shared/stores/useUIStore";
import type { Address, Work } from "@green-goods/shared/types/domain";
import { findActionByUID } from "@green-goods/shared/utils/action/parsers";
import { RiErrorWarningLine, RiRefreshLine, RiTaskLine } from "@remixicon/react";
import React, { useMemo, useState } from "react";
import { type IntlShape, useIntl } from "react-intl";
import { DraftCard } from "@/components/Cards";
import { PendingCard } from "@/components/Cards/Work/PendingCard";
import { formatSavedAt } from "@/components/Communication/Offline/formatSavedAt";
import { EmptyState, Loader } from "@/components/Communication";
import { APP_ROUTES } from "@/config/pwaRouting";
import {
  decisionRow,
  draftRow,
  type PendingRow,
  type PendingRowContext,
  proofRow,
  submissionRow,
  toReviewRow,
} from "./buildPendingRows";
import {
  filterPendingRows,
  type PendingRead,
  type PendingReadName,
  pendingFilterOptions,
  readsBehindFilter,
  sortPendingRows,
} from "./pendingRows";
import type { UploadAction } from "./uploadActions";
import { WorkListHeader } from "./WorkListTab";

interface PendingTabProps {
  /** Your own work still pending: on this phone, or on the record without a review. */
  submissions: Work[];
  isOnThisDevice: (work: Work) => boolean;
  /** Work in gardens you steward that waits for your review. */
  toReview: Work[];
  /** Work you reviewed on this phone whose review is still on its way. */
  decisions: Work[];
  uploads: Pick<WorkUploads, "decisionFor" | "pausedForDataSaver">;
  viewer: Address | null;
  /** The record's reads; the queue's own read is taken here. */
  reads: Record<Exclude<PendingReadName, "queue">, PendingRead>;
  isFetching: boolean;
  errorMessage?: string;
  isOffline: boolean;
  /** When the rows on screen were last read, in milliseconds. */
  savedAt?: number;
  pendingFilter: WorkDashboardPendingFilter;
  onPendingFilterChange: (value: WorkDashboardPendingFilter) => void;
  uploadAction?: UploadAction;
  onRefresh: () => void;
  onOpenWork: (work: Work) => void;
  /** Leaves Your Work for a draft or a promise, remembering where it was. */
  onOpenPath: (path: string, state?: Record<string, unknown>) => void;
}

const FILTER_LABELS: Record<WorkDashboardPendingFilter, string> = {
  all: "app.workDashboard.filter.all",
  needs: "app.workDashboard.filter.needs",
  needsReview: "app.workDashboard.filter.needsReview",
  upload: "app.workDashboard.filter.upload",
  editing: "app.workDashboard.filter.editing",
  checking: "app.workDashboard.filter.checking",
  review: "app.workDashboard.filter.review",
};

const COUNT_LABELS: Record<WorkDashboardPendingFilter, string> = {
  all: "app.workDashboard.pending.itemsPending",
  needs: "app.pending.count.needs",
  needsReview: "app.pending.count.needsReview",
  upload: "app.pending.count.upload",
  editing: "app.drafts.count",
  checking: "app.pending.count.checking",
  review: "app.pending.count.review",
};

/** Queued work names its client id in its metadata; a queued link names the same id. */
function clientWorkIdOf(work: Work): string | null {
  try {
    const { clientWorkId } = JSON.parse(work.metadata || "{}") as { clientWorkId?: unknown };
    return typeof clientWorkId === "string" ? clientWorkId : null;
  } catch {
    return null;
  }
}

/**
 * Your Work › Pending (D12, D13, D17): one list sorted by what needs you,
 * holding work, reviews and proof that are still on this phone or waiting for
 * a review. The header is the count, Refresh and Upload all, then the filter.
 * Discard is offered only where it's safe and always asks first.
 */
export const PendingTab: React.FC<PendingTabProps> = ({
  submissions,
  isOnThisDevice,
  toReview,
  decisions,
  uploads,
  viewer,
  reads,
  isFetching,
  errorMessage,
  isOffline,
  savedAt,
  pendingFilter,
  onPendingFilterChange,
  uploadAction,
  onRefresh,
  onOpenWork,
  onOpenPath,
}) => {
  const intl = useIntl();
  const chainId = DEFAULT_CHAIN_ID;
  const { drafts, deleteDraft, isDeleting } = useDrafts();
  const proofs = usePendingProof({ chainId, viewer });
  const queue = useCommitmentQueueState(viewer);
  const { sendsFromTap } = useCommitmentJobs({ chainId });
  const { data: actions = [] } = useActions();
  const onRecord = [...submissions.filter((work) => !isOnThisDevice(work)), ...toReview];
  const { linked } = useLinkedWorkUIDs({ chainId, workUIDs: onRecord.map((work) => work.id) });

  const context: PendingRowContext = {
    intl,
    isOnline: !isOffline,
    pausedForDataSaver: uploads.pausedForDataSaver,
    sendsFromTap,
    actionTitle: (actionUID) => findActionByUID(actions, actionUID)?.title,
    isLinked: (work) => {
      const clientWorkId = clientWorkIdOf(work);
      return (
        linked.has(work.id.toLowerCase()) ||
        queue.linkedWorkIds.has(work.id) ||
        (clientWorkId !== null && queue.linkedWorkIds.has(clientWorkId))
      );
    },
  };
  const rows = sortPendingRows([
    ...submissions.map((work) => submissionRow(work, isOnThisDevice(work), context)),
    ...decisions.map((work) => decisionRow(work, uploads.decisionFor(work.id), context)),
    ...toReview.map((work) => toReviewRow(work, context)),
    ...drafts.map(draftRow),
    ...proofs.items.map((proof) => proofRow(proof, context)),
  ]);
  const shown = filterPendingRows(rows, pendingFilter);
  const options = pendingFilterOptions(rows, pendingFilter);
  const hasNothing = rows.length === 0;
  // An empty filter is only "nothing pending" once the reads that could fill it
  // have answered. This phone's queue can fail to read while the record answers,
  // so it counts as a read too, and Refresh reads it again.
  const behind = readsBehindFilter(pendingFilter, {
    ...reads,
    queue: { isLoading: false, isError: proofs.isUnavailable },
  });
  const showsNothing = shown.length === 0;
  const isLoading = showsNothing && behind.isLoading;
  const failed = showsNothing && behind.failed.length > 0;
  const queueUnreadable = failed && behind.failed.includes("queue");
  const refresh = () => {
    queue.refresh();
    onRefresh();
  };

  const statusText =
    isLoading || failed
      ? null
      : isOffline && savedAt
        ? intl.formatMessage(
            { id: "app.offline.savedAt", defaultMessage: "Offline · {when}" },
            { when: formatSavedAt(intl, savedAt) }
          )
        : intl.formatMessage({ id: COUNT_LABELS[pendingFilter] }, { count: shown.length });
  const showRefresh = !isOffline && !(isLoading || failed);
  const showUpload =
    !isOffline && uploadAction && (pendingFilter === "all" || pendingFilter === "upload");

  const open = (row: PendingRow) => {
    switch (row.type) {
      case "draft":
        return onOpenPath(`${APP_ROUTES.garden}?draftId=${row.draft.id}`);
      case "proof": {
        const { garden, commitmentId, source } = row.proof;
        if (!garden) return;
        const promise = `/home/${garden}/commitments/${commitmentId.toString()}`;
        // A draft picks up where it was left; queued proof shows where it stands.
        // Either way Back from the promise reopens Your Work.
        return onOpenPath(source === "draft" ? `${promise}/proof` : promise, {
          from: "dashboard",
        });
      }
      default:
        return onOpenWork(row.work);
    }
  };

  const [discarding, setDiscarding] = useState<PendingRow | null>(null);
  const workActions = useQueuedWorkActions(
    discarding?.type === "work" ? discarding.work.id : undefined
  );
  const [isDiscardingProof, setIsDiscardingProof] = useState(false);
  const discard = async () => {
    if (!discarding) return;
    if (discarding.type === "work") await workActions.discard();
    else if (discarding.type === "draft")
      await deleteWorkDraft(intl, deleteDraft, discarding.draft.id);
    else if (discarding.type === "proof") {
      setIsDiscardingProof(true);
      await discardProof(intl, discarding.proof);
      setIsDiscardingProof(false);
    }
    setDiscarding(null);
  };
  const canDiscard = (row: PendingRow) =>
    row.type === "draft" ||
    (row.type === "work" && row.discardable) ||
    (row.type === "proof" && row.proof.discardable);

  return (
    <div className="flex min-h-full flex-col">
      <WorkListHeader
        statusText={statusText}
        onRefresh={showRefresh ? refresh : undefined}
        isFetching={isFetching}
        actions={
          showUpload ? (
            // The label gives way only after the filter reaches its minimum.
            <Button
              type="button"
              size="compact"
              className="min-w-0"
              loading={uploadAction.loading}
              onClick={uploadAction.onClick}
              data-testid={uploadAction.testId}
              leadingIcon={uploadAction.icon}
              title={uploadAction.label}
            >
              <span className="min-w-0 truncate">{uploadAction.label}</span>
            </Button>
          ) : null
        }
      >
        {hasNothing && pendingFilter === "all" ? null : (
          <div className="flex min-w-0 items-center justify-end">
            <NativeSelect
              aria-label={intl.formatMessage({
                id: "app.workDashboard.pendingFilter.label",
                defaultMessage: "Pending work filter",
              })}
              controlSize="compact"
              density="condensed"
              className="w-auto min-w-16 max-w-48 field-sizing-content"
              value={pendingFilter}
              onChange={(event) =>
                onPendingFilterChange(event.target.value as WorkDashboardPendingFilter)
              }
            >
              {options.map((option) => (
                <option key={option} value={option}>
                  {intl.formatMessage({ id: FILTER_LABELS[option] })}
                </option>
              ))}
            </NativeSelect>
          </div>
        )}
      </WorkListHeader>

      {isLoading ? (
        <div className="flex flex-1 flex-col items-center justify-center pb-32">
          <Loader />
          <p className="mt-4 text-sm text-text-soft-400">
            {intl.formatMessage({
              id: "app.workDashboard.loading",
              defaultMessage: "Loading your work...",
            })}
          </p>
        </div>
      ) : failed ? (
        <EmptyState
          className="flex-1"
          placement="sheet"
          icon={<RiErrorWarningLine />}
          tone="error"
          title={intl.formatMessage({ id: "app.workDashboard.error.title" })}
          description={
            errorMessage || intl.formatMessage({ id: "app.workDashboard.error.description" })
          }
          action={
            // The queue is on this phone, so trying it again needs no connection.
            isOffline && !queueUnreadable ? null : (
              <Button
                type="button"
                emphasis="secondary"
                onClick={refresh}
                loading={isFetching}
                leadingIcon={<RiRefreshLine className="h-4 w-4" aria-hidden="true" />}
              >
                {intl.formatMessage({
                  id: isFetching ? "app.common.refreshing" : "app.workDashboard.error.retry",
                })}
              </Button>
            )
          }
        />
      ) : shown.length === 0 ? (
        <EmptyState
          className="flex-1"
          placement="sheet"
          icon={<RiTaskLine />}
          title={intl.formatMessage({ id: "app.workDashboard.pending.noPending" })}
          description={intl.formatMessage({ id: "app.workDashboard.pending.description" })}
        />
      ) : (
        <ul className="flex flex-col gap-3 px-4 pb-6" data-testid="pending-list">
          {shown.map((row) => (
            <li key={row.id} className="cv-draft-card">
              <PendingRowCard
                row={row}
                actionTitle={
                  row.type === "draft" && row.draft.actionUID !== null
                    ? findActionByUID(actions, row.draft.actionUID)?.title
                    : undefined
                }
                onOpen={() => open(row)}
                onDiscard={canDiscard(row) ? () => setDiscarding(row) : undefined}
              />
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        isOpen={discarding !== null}
        onClose={() => {
          if (!workActions.isDiscarding && !isDeleting && !isDiscardingProof) setDiscarding(null);
        }}
        onConfirm={discard}
        variant="danger"
        isLoading={workActions.isDiscarding || isDeleting || isDiscardingProof}
        {...discardCopy(intl, discarding)}
      />
    </div>
  );
};

/** One row: work, a review, a draft or proof, each in the pending card. */
function PendingRowCard({
  row,
  actionTitle,
  onOpen,
  onDiscard,
}: {
  row: PendingRow;
  actionTitle?: string;
  onOpen: () => void;
  onDiscard?: () => void;
}) {
  const intl = useIntl();
  if (row.type === "draft") {
    return (
      <DraftCard
        draft={row.draft}
        actionTitle={actionTitle}
        onResume={onOpen}
        onDelete={() => onDiscard?.()}
      />
    );
  }
  if (row.type === "proof") return <ProofCard row={row} onOpen={onOpen} onDiscard={onDiscard} />;
  return (
    <PendingCard
      {...row.card}
      thumbnailUrl={row.work.media[0] ?? null}
      onOpen={onOpen}
      onDiscard={onDiscard}
      discardLabel={intl.formatMessage(
        { id: "app.pending.discardLabel" },
        { title: row.card.title }
      )}
    />
  );
}

/** Queued proof shows its first photo, read from the queue. */
function ProofCard({
  row,
  onOpen,
  onDiscard,
}: {
  row: Extract<PendingRow, { type: "proof" }>;
  onOpen: () => void;
  onDiscard?: () => void;
}) {
  const intl = useIntl();
  // The preview hook keys its URLs by the array it's handed, so it must stay the same array.
  const { firstPhoto } = row.proof;
  const photos = useMemo(() => (firstPhoto ? [firstPhoto] : []), [firstPhoto]);
  const [thumbnailUrl] = useWorkPreviewUrls(photos);
  return (
    <PendingCard
      {...row.card}
      thumbnailUrl={thumbnailUrl ?? null}
      onOpen={row.proof.garden ? onOpen : undefined}
      onDiscard={onDiscard}
      discardLabel={intl.formatMessage(
        { id: "app.pending.discardLabel" },
        { title: row.card.title }
      )}
    />
  );
}

function discardCopy(intl: IntlShape, row: PendingRow | null) {
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

async function deleteWorkDraft(
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
async function discardProof(intl: IntlShape, proof: PendingProof) {
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
