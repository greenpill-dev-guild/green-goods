import type { Address, Work } from "@green-goods/shared/types/domain";
import { cn } from "@green-goods/shared/utils/styles/cn";
import {
  collectApprovalRecipientsForWorks,
  collectApprovedWorkUIDs,
  filterPendingNeedsReview,
} from "@green-goods/shared/utils/work/pending-review";
import {
  DEFAULT_RETRY_COUNT,
  STALE_TIME_MEDIUM,
} from "@green-goods/shared/config/query-keys/constants";
import { fetchApprovalsByRecipients } from "@green-goods/shared/hooks/work/useAggregatedApprovals";
import { filterByTimeRange, type TimeFilter } from "@green-goods/shared/utils/time";
import { hapticLight } from "@green-goods/shared/utils/app/haptics";
import { logger } from "@green-goods/shared/modules/app/logger";
import { queryKeys } from "@green-goods/shared/config/query-keys/registry";
import { isUserAddress as sharedIsUserAddress } from "@green-goods/shared/utils/blockchain/address";
import { toastService } from "@green-goods/shared/components/Toast/toast.service";
import { useDrafts } from "@green-goods/shared/hooks/work/useDrafts";
import { useFocusTrap } from "@green-goods/shared/hooks/utils/useFocusTrap";
import { useMyWorks } from "@green-goods/shared/hooks/work/useMyWorks";
import { useReviewerGardenIds } from "@green-goods/shared/hooks/work/useReviewerGardenIds";
import { useReviewerWorks } from "@green-goods/shared/hooks/work/useReviewerWorks";
import { useTimeout } from "@green-goods/shared/hooks/utils/useTimeout";
import {
  useUIStore,
  type WorkDashboardPendingFilter,
  type WorkDashboardTab,
} from "@green-goods/shared/stores/useUIStore";
import { useUser } from "@green-goods/shared/hooks/auth/useUser";
import { useWorkApprovals } from "@green-goods/shared/hooks/work/useWorkApprovals";
import { RiCheckLine, RiCloseLine, RiDraftLine, RiTaskLine } from "@remixicon/react";
import { useQuery } from "@tanstack/react-query";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router-dom";
import { type StandardTab, StandardTabs } from "@/components/Navigation";
import { getPwaDrawerCloseDelayMs, pwaDrawerStyles } from "@/components/Pwa/drawerStyles";
import { CompletedTab } from "./CompletedTab";
import { DraftsTab } from "./Drafts";
import { PendingTab } from "./PendingTab";
import {
  approvalsToCompletedWorks,
  buildWorkMap,
  combinePendingWork,
  extractWorkGardenIds,
  receivedApprovalsToWorks,
  resolveWorkNavigation,
} from "./workDashboardUtils";

// Component-specific props (not a domain type)
export interface WorkDashboardProps {
  className?: string;
  onClose?: () => void;
}

export const WorkDashboard: React.FC<WorkDashboardProps> = ({ className, onClose }) => {
  const intl = useIntl();
  const navigate = useNavigate();
  const { user } = useUser();
  const activeAddress = user?.id;

  // Helper to check if an address matches the current user (wrapping shared util)
  const isUserAddress = (address: Address | undefined): boolean =>
    sharedIsUserAddress(address, activeAddress);

  // Use the new hook for work approvals
  const {
    completedApprovals,
    isLoading,
    hasError,
    errorMessage,
    refetch: refetchApprovals,
  } = useWorkApprovals(activeAddress || undefined);

  // Get draft count for badge
  const { draftCount } = useDrafts();

  // Timer for close animation (auto-cleared on unmount)
  const { set: scheduleTimeout } = useTimeout();

  // State management — open to the tab/filter the caller requested (e.g. the arrival toast),
  // else defaults. Store presets are consumed once at mount; an already-open dashboard
  // intentionally ignores later store writes.
  const initialTab = useUIStore((s) => s.workDashboardInitialTab);
  const initialPendingFilter = useUIStore((s) => s.workDashboardInitialPendingFilter);
  const [activeTab, setActiveTab] = useState<WorkDashboardTab>(initialTab ?? "pending");
  const [isClosing, setIsClosing] = useState(false);
  const [pendingFilter, setPendingFilter] = useState<WorkDashboardPendingFilter>(
    initialPendingFilter ?? "all"
  );
  const [completedFilter, setCompletedFilter] = useState<"reviewedByYou" | "myWorkReviewed">(
    "reviewedByYou"
  );
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("month");

  // Ref for focus trap on the dialog panel
  const dialogRef = useRef<HTMLDivElement>(null);

  // Prevent background scrolling when modal is open
  useEffect(() => {
    document.documentElement.classList.add("modal-open");
    return () => {
      document.documentElement.classList.remove("modal-open");
    };
  }, []);

  // Focus trap: keep Tab/Shift+Tab cycling within the dialog
  useFocusTrap(dialogRef);

  // Use shared hooks for reviewer garden detection and works fetching
  const { reviewerGardenIds } = useReviewerGardenIds(activeAddress);
  const {
    data: stewardWorks = [],
    isLoading: isLoadingStewardWorks,
    isFetching: isFetchingStewardWorks,
    isError: isErrorStewardWorks,
    refetch: refetchStewardWorks,
  } = useReviewerWorks(reviewerGardenIds, activeAddress);

  // Include offline queued submissions so the Pending tab still reflects the
  // dashboard badge after the Recent/Uploading tab was removed.
  const {
    data: myWorks = [],
    isLoading: isLoadingMyWorks,
    isFetching: isFetchingMyWorks,
    isError: isErrorMyWorks,
    refetch: refetchMyWorks,
  } = useMyWorks({ includeOffline: true });
  // Which works have you already reviewed?
  const reviewedByYou = useMemo(
    () => new Set((completedApprovals || []).map((a) => a.workUID)),
    [completedApprovals]
  );

  // Fetch approvals covering ALL reviewers of the candidate works. New approvals use
  // recipient = garden; historical bot approvals may use recipient = gardener, so the
  // helper includes both garden ids and candidate gardeners.
  const approvalRecipients = useMemo(
    () => collectApprovalRecipientsForWorks(reviewerGardenIds, stewardWorks || []),
    [reviewerGardenIds, stewardWorks]
  );
  const reviewExclusionQueryEnabled =
    reviewerGardenIds.length > 0 && (stewardWorks || []).length > 0;
  const {
    data: reviewExclusionApprovals = [],
    isLoading: isLoadingReviewExclusionApprovals,
    isFetching: isFetchingReviewExclusionApprovals,
    isError: isErrorReviewExclusionApprovals,
    isSuccess: isSuccessReviewExclusionApprovals,
    refetch: refetchReviewExclusionApprovals,
  } = useQuery({
    queryKey: queryKeys.approvals.forWorkReview(approvalRecipients),
    queryFn: () => fetchApprovalsByRecipients(approvalRecipients),
    enabled: reviewExclusionQueryEnabled,
    staleTime: STALE_TIME_MEDIUM,
    retry: DEFAULT_RETRY_COUNT,
  });
  const isReviewExclusionReady = !reviewExclusionQueryEnabled || isSuccessReviewExclusionApprovals;
  const isWaitingForReviewExclusionApprovals =
    reviewExclusionQueryEnabled && !isReviewExclusionReady && !isErrorReviewExclusionApprovals;

  // Set of work IDs that have been approved/rejected by ANY steward
  const alreadyReviewedByAnyone = useMemo(
    () =>
      isReviewExclusionReady
        ? collectApprovedWorkUIDs(reviewExclusionApprovals || [])
        : new Set<string>(),
    [isReviewExclusionReady, reviewExclusionApprovals]
  );

  const stewardWorksById = useMemo(() => buildWorkMap(stewardWorks || []), [stewardWorks]);

  // Pending work needing your review (from gardens you operate): not reviewed by ANY
  // steward and not your own submission — shared derivation, same as the arrival toast.
  const pendingNeedsReview = useMemo(
    () =>
      isReviewExclusionReady
        ? filterPendingNeedsReview(stewardWorks || [], alreadyReviewedByAnyone, activeAddress)
        : [],
    [stewardWorks, alreadyReviewedByAnyone, activeAddress, isReviewExclusionReady]
  );

  // Completed approvals (approved/rejected by you) - convert to Work shape for MinimalWorkCard
  const completedReviewedByYou: Work[] = useMemo(
    () => approvalsToCompletedWorks(completedApprovals),
    [completedApprovals]
  );

  const myWorkGardenIds = useMemo(() => extractWorkGardenIds(myWorks || []), [myWorks]);
  const myWorksById = useMemo(() => buildWorkMap(myWorks || []), [myWorks]);

  // Fetch approvals scoped to gardens where the user has submitted work.
  const {
    data: allApprovals = [],
    isLoading: isLoadingMyApprovals,
    isFetching: isFetchingMyApprovals,
    isError: isErrorMyApprovals,
    refetch: refetchMyApprovals,
  } = useQuery({
    queryKey: queryKeys.approvals.byMyWorkGardens(activeAddress, myWorkGardenIds),
    queryFn: () => fetchApprovalsByRecipients(myWorkGardenIds),
    enabled: !!activeAddress && myWorkGardenIds.length > 0,
    staleTime: STALE_TIME_MEDIUM,
    retry: DEFAULT_RETRY_COUNT,
  });

  // Build a set of the user's work IDs for efficient lookup
  const myWorkIds = useMemo(() => new Set(myWorksById.keys()), [myWorksById]);

  // Filter approvals to only those for the user's works
  const myReceivedApprovals = useMemo(
    () => (allApprovals || []).filter((a) => myWorkIds.has(a.workUID)),
    [allApprovals, myWorkIds]
  );

  // Pending: your submissions across ALL gardens (online and awaiting review)
  const approvedOrRejectedForMe = useMemo(
    () => new Set((myReceivedApprovals || []).map((a) => a.workUID)),
    [myReceivedApprovals]
  );

  const pendingMySubmissions: Work[] = (myWorks || [])
    .filter((w) => isUserAddress(w.gardenerAddress) && !approvedOrRejectedForMe.has(w.id))
    .map((w) => ({ ...w, status: w.status ?? ("pending" as const) }));

  const combinedPending = useMemo(
    () => combinePendingWork(pendingNeedsReview, pendingMySubmissions),
    [pendingNeedsReview, pendingMySubmissions]
  );

  const pendingWork =
    pendingFilter === "needsReview"
      ? pendingNeedsReview
      : pendingFilter === "mySubmissions"
        ? pendingMySubmissions
        : combinedPending;

  const completedMyWorkReviewed: Work[] = useMemo(
    () => receivedApprovalsToWorks(myReceivedApprovals || [], myWorksById),
    [myReceivedApprovals, myWorksById]
  );

  const completedWork =
    completedFilter === "reviewedByYou" ? completedReviewedByYou : completedMyWorkReviewed;

  // Apply time filtering using utility
  const filteredPending = filterByTimeRange(pendingWork, timeFilter);
  const filteredCompleted = filterByTimeRange(completedWork, timeFilter);

  // Navigation handler - handles both Work and WorkApproval shapes
  const handleWorkClick = (work: Work | { workUID?: string; gardenAddress?: Address }) => {
    try {
      const nav = resolveWorkNavigation(work, stewardWorksById);
      if (!nav) return;

      navigate(`/home/${nav.gardenId}/work/${nav.workId}`, {
        state: { from: "dashboard", returnTo: "/home" },
        viewTransition: true,
      });
    } catch (err) {
      logger.error("Navigation error:", { error: err });
      toastService.error({
        title: intl.formatMessage({
          id: "app.workDashboard.error.navigationFailed",
          defaultMessage: "Couldn't open work",
        }),
        message: intl.formatMessage({
          id: "app.workDashboard.error.navigationFailedMessage",
          defaultMessage: "Please try again.",
        }),
        context: "workDashboard",
      });
    }
  };

  // Combined refresh functions for each tab
  const handleRefreshPending = () => {
    hapticLight();
    refetchStewardWorks();
    refetchMyWorks();
    refetchApprovals();
    refetchReviewExclusionApprovals();
  };

  const handleRefreshCompleted = () => {
    hapticLight();
    refetchApprovals();
    refetchMyApprovals();
  };

  // Combined error states
  const pendingQueryErrored =
    hasError || isErrorStewardWorks || isErrorMyWorks || isErrorReviewExclusionApprovals;
  const hasPendingError = pendingQueryErrored && filteredPending.length === 0;
  const hasCompletedError = hasError || isErrorMyApprovals;

  // Combined fetching states
  const isFetchingPending =
    isFetchingStewardWorks || isFetchingMyWorks || isFetchingReviewExclusionApprovals;
  const isLoadingPending =
    (isLoading ||
      isLoadingStewardWorks ||
      isLoadingMyWorks ||
      isLoadingReviewExclusionApprovals ||
      isWaitingForReviewExclusionApprovals) &&
    filteredPending.length === 0;
  const isFetchingCompleted = isFetchingMyApprovals;

  const fmt = (id: string, defaultMessage: string) => intl.formatMessage({ id, defaultMessage });
  const tabs: StandardTab[] = [
    {
      id: "drafts",
      icon: <RiDraftLine className="w-4 h-4" />,
      label: fmt("app.workDashboard.tabs.drafts", "Draft"),
      count: draftCount > 0 ? draftCount : undefined,
    },
    {
      id: "pending",
      icon: <RiTaskLine className="w-4 h-4" />,
      label: fmt("app.workDashboard.tabs.pending", "Pending"),
    },
    {
      id: "completed",
      icon: <RiCheckLine className="w-4 h-4" />,
      label: fmt("app.workDashboard.tabs.completed", "Completed"),
    },
  ];

  const handleClose = () => {
    setIsClosing(true);
    scheduleTimeout(() => {
      onClose?.();
    }, getPwaDrawerCloseDelayMs());
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case "drafts":
        return <DraftsTab />;
      case "pending":
      default:
        return (
          <PendingTab
            items={filteredPending}
            isLoading={isLoadingPending}
            isFetching={isFetchingPending}
            hasError={hasPendingError}
            errorMessage={errorMessage}
            onWorkClick={handleWorkClick}
            onRefresh={handleRefreshPending}
            pendingFilter={pendingFilter}
            onPendingFilterChange={setPendingFilter}
            timeFilter={timeFilter}
            onTimeFilterChange={setTimeFilter}
            activeAddress={activeAddress}
            reviewerGardenIds={reviewerGardenIds}
            reviewedByYou={reviewedByYou}
            isUserAddress={isUserAddress}
          />
        );
      case "completed":
        return (
          <CompletedTab
            items={filteredCompleted}
            isLoading={isLoading || (completedFilter === "myWorkReviewed" && isLoadingMyApprovals)}
            isFetching={isFetchingCompleted}
            hasError={hasCompletedError}
            errorMessage={errorMessage}
            onWorkClick={handleWorkClick}
            onRefresh={handleRefreshCompleted}
            completedFilter={completedFilter}
            onCompletedFilterChange={setCompletedFilter}
            timeFilter={timeFilter}
            onTimeFilterChange={setTimeFilter}
          />
        );
    }
  };

  return (
    <div
      role="presentation"
      className={cn(
        pwaDrawerStyles.overlay,
        isClosing ? "modal-backdrop-exit" : "modal-backdrop-enter"
      )}
      data-testid="modal-drawer-overlay"
      onClick={(e) => {
        // Only close if clicking directly on backdrop, not from propagated events
        if (e.target === e.currentTarget) {
          handleClose();
        }
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          handleClose();
        }
      }}
      tabIndex={-1}
    >
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- dialog surface; handler only stops propagation to the overlay */}
      <div
        ref={dialogRef}
        className={cn(
          pwaDrawerStyles.panel,
          isClosing ? "modal-slide-exit" : "modal-slide-enter",
          className
        )}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          e.stopPropagation();
        }}
        role="dialog"
        aria-modal="true"
        data-testid="modal-drawer"
      >
        {/* Header */}
        <div className={pwaDrawerStyles.header}>
          <div className="flex-1 min-w-0">
            <h2 className="title-section truncate">
              {intl.formatMessage({
                id: "app.workDashboard.title",
                defaultMessage: "Work Dashboard",
              })}
            </h2>
            <p className="text-sm text-text-sub-600 truncate">
              {intl.formatMessage({
                id: "app.workDashboard.description",
                defaultMessage: "Track work submissions and reviews",
              })}
            </p>
          </div>
          <div className="flex items-center gap-2 ml-4">
            <button
              onClick={handleClose}
              className={cn(
                "min-h-11 min-w-11 flex items-center justify-center",
                pwaDrawerStyles.closeButtonBase
              )}
              data-testid="modal-drawer-close"
              aria-label={intl.formatMessage({
                id: "app.workDashboard.closeModal",
                defaultMessage: "Close modal",
              })}
            >
              <RiCloseLine className={cn("w-5 h-5", pwaDrawerStyles.closeIcon)} />
            </button>
          </div>
        </div>

        {/* Standardized Tabs */}
        <StandardTabs
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={(tabId: string) => setActiveTab(tabId as WorkDashboardTab)}
          triggerClassName="text-xs"
        />

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-y-auto">{renderTabContent()}</div>
      </div>
    </div>
  );
};
