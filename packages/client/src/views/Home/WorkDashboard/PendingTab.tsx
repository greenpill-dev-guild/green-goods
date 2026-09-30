import { Button } from "@green-goods/shared/components/Button";
import { NativeSelect } from "@green-goods/shared/components/Form/ControlPrimitives";
import type { Address, Work } from "@green-goods/shared/types/domain";
import { RiTimeLine } from "@remixicon/react";
import React from "react";
import { useIntl } from "react-intl";
import {
  queuedWorkDetailMessage,
  queuedWorkStatusMessage,
  readQueuedWorkState,
} from "@/components/Cards/Work/queuedWorkCopy";
import type { WorkCardPresentation } from "@/components/Cards/Work/WorkCard";
import type { UploadAction } from "./uploadActions";
import { WorkListTab } from "./WorkListTab";
import { isStewardForGarden } from "./workDashboardUtils";

interface PendingTabProps {
  items: Work[];
  isLoading: boolean;
  isFetching: boolean;
  hasError: boolean;
  errorMessage?: string;
  onWorkClick: (work: Work) => void;
  onRefresh: () => void;
  pendingFilter: "all" | "needsReview" | "mySubmissions";
  onPendingFilterChange: (value: "all" | "needsReview" | "mySubmissions") => void;
  isOffline?: boolean;
  savedAt?: number;
  activeAddress: Address | undefined;
  reviewerGardenIds: string[];
  reviewedByYou: Set<string>;
  waitingUploadIds?: ReadonlySet<string>;
  checkingUploadIds?: ReadonlySet<string>;
  isUserAddress: (address: Address | undefined) => boolean;
  uploadAction?: UploadAction;
}

const PENDING_MESSAGES = {
  itemCount: {
    id: "app.workDashboard.pending.itemsPending",
    defaultMessage: "{count, plural, one {# item} other {# items}}",
  },
  loading: { id: "app.workDashboard.loading", defaultMessage: "Loading your work..." },
  emptyTitle: { id: "app.workDashboard.pending.noPending", defaultMessage: "No pending work" },
  emptyDescription: {
    id: "app.workDashboard.pending.description",
    defaultMessage: "Submitted work waiting to send or be reviewed will appear here",
  },
};

export const PendingTab: React.FC<PendingTabProps> = ({
  items,
  isLoading,
  isFetching,
  hasError,
  errorMessage,
  onWorkClick,
  onRefresh,
  pendingFilter,
  onPendingFilterChange,
  isOffline,
  savedAt,
  activeAddress,
  reviewerGardenIds,
  reviewedByYou,
  waitingUploadIds,
  checkingUploadIds,
  isUserAddress,
  uploadAction,
}) => {
  const intl = useIntl();

  const renderPresentation = (item: Work): WorkCardPresentation => {
    const state = readQueuedWorkState(item.metadata);
    const detail = queuedWorkDetailMessage(state);
    const isGardener = isUserAddress(item.gardenerAddress);
    const isSteward = isStewardForGarden(activeAddress, reviewerGardenIds, item.gardenAddress);
    const reviewed = reviewedByYou.has(item.id);
    const waitingDecision = waitingUploadIds?.has(item.id.toLowerCase());
    const contextLabel = isGardener
      ? intl.formatMessage({
          id: "app.workDashboard.badge.youSubmitted",
          defaultMessage: "You submitted",
        })
      : reviewed
        ? intl.formatMessage({
            id: "app.workDashboard.badge.reviewedByYou",
            defaultMessage: "Reviewed by you",
          })
        : undefined;

    if (waitingDecision) {
      return {
        statusLabel: checkingUploadIds?.has(item.id.toLowerCase())
          ? intl.formatMessage({ id: "app.uploads.chip.checking", defaultMessage: "Checking" })
          : intl.formatMessage({ id: "app.uploads.chip.toUpload", defaultMessage: "To upload" }),
        statusTone: "uploading",
        contextLabel,
        supportingText: checkingUploadIds?.has(item.id.toLowerCase())
          ? intl.formatMessage({
              id: "app.workCard.checkingDecision",
              defaultMessage: "Checking transaction status",
            })
          : intl.formatMessage({
              id: "app.workCard.approvalSaved",
              defaultMessage: "Approval saved on this device",
            }),
      };
    }

    const queuedStatus = queuedWorkStatusMessage(state.submissionState);
    if (queuedStatus) {
      return {
        statusLabel:
          state.submissionState === "checking-submission"
            ? intl.formatMessage({ id: "app.uploads.chip.checking", defaultMessage: "Checking" })
            : intl.formatMessage(queuedStatus),
        statusTone:
          state.submissionState === "blocked" || state.submissionState === "photo-needs-attention"
            ? "sync_failed"
            : "uploading",
        contextLabel,
        supportingText: detail
          ? intl.formatMessage(detail)
          : state.submissionState === "awaiting-confirmation"
            ? intl.formatMessage({
                id: "app.workCard.sentForConfirmation",
                defaultMessage: "Transaction sent",
              })
            : state.submissionState === "checking-submission"
              ? intl.formatMessage({
                  id: "app.work.checkingSubmission",
                  defaultMessage: "Checking whether this work was sent",
                })
              : intl.formatMessage({
                  id: "app.workCard.readyToSign",
                  defaultMessage: "Ready to sign and upload",
                }),
      };
    }

    // Your own submission is never yours to review, even in a garden you steward.
    if (isSteward && !reviewed && !isGardener)
      return {
        statusLabel: intl.formatMessage({
          id: "app.workDashboard.badge.needsReview",
          defaultMessage: "Needs review",
        }),
        statusTone: "pending",
        supportingText: intl.formatMessage({
          id: "app.workCard.awaitingDecision",
          defaultMessage: "Awaiting your decision",
        }),
      };

    if (reviewed)
      return {
        statusLabel: intl.formatMessage({
          id: "app.workDashboard.badge.reviewedByYou",
          defaultMessage: "Reviewed by you",
        }),
        statusTone: "approved",
        supportingText: intl.formatMessage({
          id: "app.work.awaitingConfirmation",
          defaultMessage: "Awaiting confirmation",
        }),
      };

    return {
      contextLabel,
      supportingText: detail
        ? intl.formatMessage(detail)
        : isGardener
          ? intl.formatMessage({
              id: "app.workCard.awaitingReview",
              defaultMessage: "Awaiting review",
            })
          : undefined,
    };
  };

  return (
    <WorkListTab
      items={items}
      isLoading={isLoading}
      isFetching={isFetching}
      hasError={hasError}
      errorMessage={errorMessage}
      onWorkClick={onWorkClick}
      onRefresh={onRefresh}
      isOffline={isOffline}
      savedAt={savedAt}
      renderPresentation={renderPresentation}
      messages={PENDING_MESSAGES}
      emptyIcon={<RiTimeLine />}
      headerActions={
        !isOffline && pendingFilter === "all" && uploadAction ? (
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
      headerContent={
        <div className="flex min-w-0 items-center justify-end">
          <NativeSelect
            aria-label={intl.formatMessage({
              id: "app.workDashboard.pendingFilter.label",
              defaultMessage: "Pending work filter",
            })}
            controlSize="sm"
            density="condensed"
            className="w-auto min-w-16 max-w-48 field-sizing-content"
            value={pendingFilter}
            onChange={(e) =>
              onPendingFilterChange(e.target.value as "all" | "needsReview" | "mySubmissions")
            }
          >
            <option value="all">
              {intl.formatMessage({
                id: "app.workDashboard.filter.all",
                defaultMessage: "All",
              })}
            </option>
            <option value="needsReview">
              {intl.formatMessage({
                id: "app.workDashboard.filter.needsReview",
                defaultMessage: "Needs review",
              })}
            </option>
            <option value="mySubmissions">
              {intl.formatMessage({
                id: "app.workDashboard.filter.mySubmissions",
                defaultMessage: "My submissions",
              })}
            </option>
          </NativeSelect>
        </div>
      }
    />
  );
};
