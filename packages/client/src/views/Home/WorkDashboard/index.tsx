import {
  type Address,
  cn,
  fetchApprovalsByRecipients,
  filterByTimeRange,
  hapticLight,
  logger,
  queryKeys,
  STALE_TIME_MEDIUM,
  isUserAddress as sharedIsUserAddress,
  type TimeFilter,
  toastService,
  useDrafts,
  useFocusTrap,
  useMyWorks,
  useReviewerGardenIds,
  useReviewerWorks,
  useTimeout,
  useUIStore,
  type WorkDashboardTab,
  useUser,
  useWorkApprovals,
  type Work,
  DEFAULT_RETRY_COUNT,
} from "@green-goods/shared";
import { RiCheckLine, RiCloseLine, RiDraftLine, RiTaskLine } from "@remixicon/react";
import { useQuery } from "@tanstack/react-query";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router-dom";
import { type StandardTab, StandardTabs } from "@/components/Navigation";
import { getPwaDrawerCloseDelayMs, pwaDrawerStyles } from "@/styles/pwaDrawerStyles";
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

  // State management — open to the tab the caller requested (e.g. the arrival toast), else default.
  const initialTab = useUIStore((s) => s.workDashboardInitialTab);
  const [activeTab, setActiveTab] = useState<WorkDashboardTab>(initialTab ?? "pending");
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

  const myWorkGardenIds = useMemo(() => extractWorkGardenIds(myWorks || []), [myWorks]);

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
  const myWorkIds = useMemo(() => new Set((myWorks || []).map((w) => w.id)), [myWorks]);

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
    () => receivedApprovalsToWorks(myReceivedApprovals || []),
    [myReceivedApprovals]
  );

  const completedWork =
    completedFilter === "reviewedByYou" ? completedReviewedByYou : completedMyWorkReviewed;

  // Apply time filtering using utility
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
  const pendingQueryErrored = hasError || isErrorOperatorWorks || isErrorMyWorks;
  const hasPendingError = pendingQueryErrored && filteredPending.length === 0;
  const hasCompletedError = hasError || isErrorMyApprovals;

  // Combined fetching states
  const isFetchingPending = isFetchingOperatorWorks || isFetchingMyWorks;
  const isLoadingPending =
    (isLoading || isLoadingOperatorWorks || isLoadingMyWorks) && filteredPending.length === 0;
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
