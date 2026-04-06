import {
  type Address,
  cn,
  convertJobsToWorks,
  DEFAULT_CHAIN_ID,
  fetchApprovalsByRecipients,
  filterByTimeRange,
  hapticLight,
  type Job,
  jobQueue,
  jobQueueEventBus,
  logger,
  queryKeys,
  STALE_TIME_FAST,
  STALE_TIME_MEDIUM,
  isUserAddress as sharedIsUserAddress,
  type TimeFilter,
  toastService,
  useDrafts,
  useFocusTrap,
  useMyOnlineWorks,
  useReviewerGardenIds,
  useReviewerWorks,
  useTimeout,
  useUser,
  useWorkApprovals,
  type Work,
  type WorkJobPayload,
  DEFAULT_RETRY_COUNT,
} from "@green-goods/shared";
import { RiCheckLine, RiCloseLine, RiDraftLine, RiTaskLine, RiTimeLine } from "@remixicon/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router-dom";
import { type StandardTab, StandardTabs } from "@/components/Navigation";
import { CompletedTab } from "./CompletedTab";
import { DraftsTab } from "./Drafts";
import { PendingTab } from "./PendingTab";
import { TimeFilterControl } from "./TimeFilterControl";
import { UploadingTab } from "./Uploading";
import {
  approvalsToCompletedWorks,
  buildWorkMap,
  combineRecentWork,
  combinePendingWork,
  extractWorkGardenIds,
  receivedApprovalsToWorks,
  resolveWorkNavigation,
} from "./work-dashboard-utils";

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

  // State management
  const [activeTab, setActiveTab] = useState<"drafts" | "recent" | "pending" | "completed">(
    "recent"
  );
  const [isClosing, setIsClosing] = useState(false);
  const [pendingFilter, setPendingFilter] = useState<"all" | "needsReview" | "mySubmissions">(
    "all"
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
    data: operatorWorks = [],
    isLoading: isLoadingOperatorWorks,
    isFetching: isFetchingOperatorWorks,
    isError: isErrorOperatorWorks,
    refetch: refetchOperatorWorks,
  } = useReviewerWorks(reviewerGardenIds, activeAddress);

  // Use new hooks for user's works
  const {
    data: myOnlineWorks = [],
    isLoading: isLoadingMyOnlineWorks,
    isFetching: isFetchingMyWorks,
    isError: isErrorMyWorks,
    refetch: refetchMyWorks,
  } = useMyOnlineWorks();
  const {
    data: recentOnlineWork = [],
    isLoading: isLoadingRecentOnline,
    isFetching: isFetchingRecentOnline,
    isError: isErrorRecentOnline,
    refetch: refetchRecentOnline,
  } = useMyOnlineWorks({
    timeFilter,
  });

  const queryClient = useQueryClient();

  // Uploading work (offline queue jobs only, scoped to current user)
  const {
    data: offlineQueueWork = [],
    isLoading: isLoadingOfflineQueue,
    refetch: refetchOfflineQueue,
  } = useQuery({
    queryKey: queryKeys.queue.uploading(),
    queryFn: async () => {
      if (!activeAddress) return [];
      const jobs = await jobQueue.getJobs(activeAddress, { kind: "work", synced: false });
      const works = await convertJobsToWorks(jobs as Job<WorkJobPayload>[], activeAddress);
      return works.sort((a, b) => b.createdAt - a.createdAt);
    },
    enabled: !!activeAddress,
    staleTime: STALE_TIME_FAST,
  });

  // Combine offline queue + recent online work for "Recent" tab
  const recentWorkCombined = useMemo(
    () => combineRecentWork(offlineQueueWork, recentOnlineWork),
    [offlineQueueWork, recentOnlineWork]
  );

  const uploadingWork = recentWorkCombined;
  const isLoadingUploading = isLoadingOfflineQueue || isLoadingRecentOnline;

  // Invalidate uploading jobs on queue events
  useEffect(() => {
    const unsub = jobQueueEventBus.onMultiple(
      ["job:added", "job:completed", "job:failed", "queue:sync-completed"],
      () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.queue.uploading() });
        queryClient.invalidateQueries({ queryKey: queryKeys.queue.stats() });
        queryClient.invalidateQueries({
          queryKey: queryKeys.works.mine(activeAddress, DEFAULT_CHAIN_ID),
        });
      }
    );
    return () => unsub();
  }, [queryClient, activeAddress]);

  // Which works have you already reviewed?
  const reviewedByYou = useMemo(
    () => new Set((completedApprovals || []).map((a) => a.workUID)),
    [completedApprovals]
  );

  // Fetch ALL approvals for operator gardens to filter out work reviewed by ANY operator
  const { data: allOperatorGardenApprovals = [] } = useQuery({
    queryKey: queryKeys.approvals.byOperatorGardens(reviewerGardenIds),
    queryFn: () => fetchApprovalsByRecipients(reviewerGardenIds),
    enabled: reviewerGardenIds.length > 0,
    staleTime: STALE_TIME_MEDIUM,
    retry: DEFAULT_RETRY_COUNT,
  });

  // Set of work IDs that have been approved/rejected by ANY operator
  const alreadyReviewedByAnyone = useMemo(
    () => new Set((allOperatorGardenApprovals || []).map((a) => a.workUID)),
    [allOperatorGardenApprovals]
  );

  const operatorWorksById = useMemo(() => buildWorkMap(operatorWorks || []), [operatorWorks]);

  // Pending work needing your review (from gardens you operate, excluding your own submissions)
  // Filter out works that have been reviewed by ANY operator, not just the current user
  const pendingNeedsReview = (operatorWorks || []).filter(
    (w) => !alreadyReviewedByAnyone.has(w.id) && !isUserAddress(w.gardenerAddress)
  );

  // Completed approvals (approved/rejected by you) - convert to Work shape for MinimalWorkCard
  const completedReviewedByYou: Work[] = useMemo(
    () => approvalsToCompletedWorks(completedApprovals),
    [completedApprovals]
  );

  const myWorkGardenIds = useMemo(() => extractWorkGardenIds(myOnlineWorks || []), [myOnlineWorks]);

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
  const myWorkIds = useMemo(() => new Set((myOnlineWorks || []).map((w) => w.id)), [myOnlineWorks]);

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

  const pendingMySubmissions: Work[] = (myOnlineWorks || [])
    .filter((w) => isUserAddress(w.gardenerAddress) && !approvedOrRejectedForMe.has(w.id))
    .map((w) => ({ ...w, status: "pending" as const }));

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
    () => receivedApprovalsToWorks(myReceivedApprovals || []),
    [myReceivedApprovals]
  );

  const completedWork =
    completedFilter === "reviewedByYou" ? completedReviewedByYou : completedMyWorkReviewed;

  // Apply time filtering using utility
  const filteredUploading = filterByTimeRange(uploadingWork, timeFilter);
  const filteredPending = filterByTimeRange(pendingWork, timeFilter);
  const filteredCompleted = filterByTimeRange(completedWork, timeFilter);

  // Navigation handler - handles both Work and WorkApproval shapes
  const handleWorkClick = (work: Work | { workUID?: string; gardenAddress?: Address }) => {
    try {
      const nav = resolveWorkNavigation(work, operatorWorksById);
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
  const handleRefreshRecent = () => {
    hapticLight();
    refetchOfflineQueue();
    refetchRecentOnline();
  };

  const handleRefreshPending = () => {
    hapticLight();
    refetchOperatorWorks();
    refetchMyWorks();
    refetchApprovals();
  };

  const handleRefreshCompleted = () => {
    hapticLight();
    refetchApprovals();
    refetchMyApprovals();
  };

  // Combined error states
  const hasRecentError = isErrorRecentOnline;
  const hasPendingError = hasError || isErrorOperatorWorks || isErrorMyWorks;
  const hasCompletedError = hasError || isErrorMyApprovals;

  // Combined fetching states
  const isFetchingRecent = isFetchingRecentOnline;
  const isFetchingPending = isFetchingOperatorWorks || isFetchingMyWorks;
  const isFetchingCompleted = isFetchingMyApprovals;

  const fmt = (id: string, defaultMessage: string) => intl.formatMessage({ id, defaultMessage });
  const tabs: StandardTab[] = [
    {
      id: "drafts",
      icon: <RiDraftLine className="w-4 h-4" />,
      label: fmt("app.workDashboard.tabs.drafts", "Drafts"),
      count: draftCount > 0 ? draftCount : undefined,
    },
    {
      id: "recent",
      icon: <RiTimeLine className="w-4 h-4" />,
      label: fmt("app.workDashboard.tabs.recent", "Recent"),
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
    }, 300);
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case "drafts":
        return <DraftsTab />;
      case "recent":
      default:
        return (
          <UploadingTab
            uploadingWork={filteredUploading}
            isLoading={isLoading || isLoadingUploading}
            isFetching={isFetchingRecent}
            hasError={hasRecentError}
            onWorkClick={handleWorkClick}
            onRefresh={handleRefreshRecent}
            headerContent={<TimeFilterControl value={timeFilter} onChange={setTimeFilter} />}
          />
        );
      case "pending":
        return (
          <PendingTab
            items={filteredPending}
            isLoading={isLoading || isLoadingOperatorWorks || isLoadingMyOnlineWorks}
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
        "fixed inset-0 bg-black/30 backdrop-blur-sm z-[20000] flex items-end justify-center",
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
      <div
        ref={dialogRef}
        className={cn(
          "bg-bg-white-0 rounded-t-3xl shadow-2xl w-full overflow-hidden flex flex-col h-modal",
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
        <div className="flex items-center justify-between p-4 border-b border-border flex-shrink-0">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold truncate">
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
              className="btn-icon"
              data-testid="modal-drawer-close"
              aria-label={intl.formatMessage({
                id: "app.workDashboard.closeModal",
                defaultMessage: "Close modal",
              })}
            >
              <RiCloseLine className="w-5 h-5 text-text-soft-400 focus:text-primary active:text-primary" />
            </button>
          </div>
        </div>

        {/* Standardized Tabs */}
        <StandardTabs
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={(tabId: string) =>
            setActiveTab(tabId as "drafts" | "recent" | "pending" | "completed")
          }
          triggerClassName="text-xs"
        />

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-y-auto">{renderTabContent()}</div>
      </div>
    </div>
  );
};
