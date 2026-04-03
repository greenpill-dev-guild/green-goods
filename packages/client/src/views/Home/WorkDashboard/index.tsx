import {
  type Address,
  cn,
  compareAddresses,
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
import { DraftsTab } from "./Drafts";
import { TimeFilterControl } from "./TimeFilterControl";
import { UploadingTab } from "./Uploading";
import { WorkListTab } from "./WorkListTab";

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
  const recentWorkCombined = useMemo((): Work[] => {
    // Convert EASWork to Work by adding status
    const onlineWithStatus: Work[] = recentOnlineWork.map((w) => ({
      ...w,
      status: "pending" as const,
    }));
    const combined = [...offlineQueueWork, ...onlineWithStatus];

    // Remove duplicates by ID
    const seen = new Set<string>();
    const deduplicated = combined.filter((work) => {
      if (seen.has(work.id)) return false;
      seen.add(work.id);
      return true;
    });

    // Sort: offline first, then by time
    return deduplicated.sort((a, b) => {
      const aIsOffline = a.id.startsWith("0xoffline_");
      const bIsOffline = b.id.startsWith("0xoffline_");

      if (aIsOffline && !bIsOffline) return -1;
      if (!aIsOffline && bIsOffline) return 1;

      return b.createdAt - a.createdAt;
    });
  }, [offlineQueueWork, recentOnlineWork]);

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

  const operatorWorksById = useMemo(() => {
    const map = new Map<string, Work>();
    (operatorWorks || []).forEach((w) => map.set(w.id, w));
    return map;
  }, [operatorWorks]);

  // Pending work needing your review (from gardens you operate, excluding your own submissions)
  // Filter out works that have been reviewed by ANY operator, not just the current user
  const pendingNeedsReview = (operatorWorks || []).filter(
    (w) => !alreadyReviewedByAnyone.has(w.id) && !isUserAddress(w.gardenerAddress)
  );

  // Completed approvals (approved/rejected by you) - convert to Work shape for MinimalWorkCard
  const completedReviewedByYou: Work[] = useMemo(
    () =>
      completedApprovals
        .filter((approval) => ["approved", "rejected"].includes(approval.status))
        .map((approval) => ({
          id: approval.workUID,
          title: approval.title || `Work ${String(approval.workUID || "").slice(0, 8)}...`,
          actionUID: approval.actionUID,
          gardenerAddress: approval.gardenerAddress,
          gardenAddress: approval.gardenId || "",
          feedback: approval.feedback || "",
          metadata: "",
          media: [],
          createdAt: approval.createdAt,
          status: approval.status as "approved" | "rejected" | "pending",
        })),
    [completedApprovals]
  );

  const myWorkGardenIds = useMemo(
    () =>
      Array.from(new Set((myOnlineWorks || []).map((work) => work.gardenAddress).filter(Boolean))),
    [myOnlineWorks]
  );

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

  // Combine lists and deduplicate by id when showing "all"
  const combinedPending = useMemo(() => {
    const map = new Map<string, Work>();
    for (const w of pendingNeedsReview) map.set(w.id, w);
    for (const w of pendingMySubmissions) map.set(w.id, w);
    return Array.from(map.values()).sort((a, b) => b.createdAt - a.createdAt);
  }, [pendingNeedsReview, pendingMySubmissions]);

  const pendingWork =
    pendingFilter === "needsReview"
      ? pendingNeedsReview
      : pendingFilter === "mySubmissions"
        ? pendingMySubmissions
        : combinedPending;

  const completedMyWorkReviewed: Work[] = useMemo(
    () =>
      (myReceivedApprovals || []).map((a) => ({
        id: a.workUID,
        title: `Work ${String(a.workUID || "").slice(0, 8)}...`,
        actionUID: a.actionUID,
        gardenerAddress: a.gardenerAddress,
        gardenAddress: "", // Not available from approval data
        feedback: a.feedback || "",
        metadata: "",
        media: [],
        createdAt: a.createdAt,
        status: a.approved ? ("approved" as const) : ("rejected" as const),
      })),
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
      let workId = "id" in work ? work.id : (work as { workUID?: string }).workUID;
      let gardenId = work.gardenAddress;

      if (!gardenId && "workUID" in work && work.workUID) {
        const found = operatorWorksById.get(work.workUID);
        if (found) {
          gardenId = found.gardenAddress;
          workId = found.id;
        }
      }

      if (!gardenId || !workId) {
        return;
      }

      navigate(`/home/${gardenId}/work/${workId}`, {
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

  // Badge renderers using CSS utilities from utilities.css
  const renderWorkBadges = (item: Work) => {
    const badges: React.ReactNode[] = [];
    const isGardener = isUserAddress(item.gardenerAddress);
    const isOperator =
      activeAddress && reviewerGardenIds.some((id) => compareAddresses(id, item.gardenAddress));
    const reviewed = reviewedByYou.has(item.id);

    if (isOperator && !reviewed) {
      badges.push(
        <span key="review" className="badge-pill-amber">
          <RiTimeLine className="w-3 h-3" />
          {intl.formatMessage({
            id: "app.workDashboard.badge.needsReview",
            defaultMessage: "Needs review",
          })}
        </span>
      );
    }
    if (reviewed) {
      badges.push(
        <span key="reviewed" className="badge-pill-emerald">
          <RiCheckLine className="w-3 h-3" />
          {intl.formatMessage({
            id: "app.workDashboard.badge.reviewedByYou",
            defaultMessage: "Reviewed by you",
          })}
        </span>
      );
    }
    if (isGardener) {
      badges.push(
        <span key="submitted" className="badge-pill-slate">
          {intl.formatMessage({
            id: "app.workDashboard.badge.youSubmitted",
            defaultMessage: "You submitted",
          })}
        </span>
      );
    }
    return badges;
  };

  const renderApprovalBadges = () => [
    <span key="reviewed" className="badge-pill-emerald">
      <RiCheckLine className="w-3 h-3" />
      {intl.formatMessage({
        id: "app.workDashboard.badge.reviewedByYou",
        defaultMessage: "Reviewed by you",
      })}
    </span>,
  ];

  const renderMyWorkReviewedBadges = () => [
    <span key="work-reviewed" className="badge-pill-slate">
      {intl.formatMessage({
        id: "app.workDashboard.badge.yourWorkReviewed",
        defaultMessage: "Your work was reviewed",
      })}
    </span>,
  ];

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

  const tabs: StandardTab[] = [
    {
      id: "drafts",
      icon: <RiDraftLine className="w-4 h-4" />,
      label: intl.formatMessage({
        id: "app.workDashboard.tabs.drafts",
        defaultMessage: "Drafts",
      }),
      count: draftCount > 0 ? draftCount : undefined,
    },
    {
      id: "recent",
      icon: <RiTimeLine className="w-4 h-4" />,
      label: intl.formatMessage({
        id: "app.workDashboard.tabs.recent",
        defaultMessage: "Recent",
      }),
    },
    {
      id: "pending",
      icon: <RiTaskLine className="w-4 h-4" />,
      label: intl.formatMessage({
        id: "app.workDashboard.tabs.pending",
        defaultMessage: "Pending",
      }),
    },
    {
      id: "completed",
      icon: <RiCheckLine className="w-4 h-4" />,
      label: intl.formatMessage({
        id: "app.workDashboard.tabs.completed",
        defaultMessage: "Completed",
      }),
    },
  ];

  const handleClose = () => {
    setIsClosing(true);
    scheduleTimeout(() => {
      onClose?.();
    }, 300);
  };

  // i18n message descriptors for WorkListTab
  const pendingMessages = {
    itemCount: {
      id: "app.workDashboard.pending.itemsPending",
      defaultMessage: "{count} items pending review",
    },
    loading: { id: "app.workDashboard.loading", defaultMessage: "Loading pending work..." },
    emptyTitle: { id: "app.workDashboard.pending.noPending", defaultMessage: "No pending work" },
    emptyDescription: {
      id: "app.workDashboard.pending.description",
      defaultMessage: "Work awaiting review will appear here",
    },
  };

  const completedMessages = {
    itemCount: {
      id: "app.workDashboard.completed.itemsCompleted",
      defaultMessage: "{count} items completed",
    },
    loading: { id: "app.workDashboard.loading", defaultMessage: "Loading completed work..." },
    emptyTitle: {
      id: "app.workDashboard.completed.noCompleted",
      defaultMessage: "No completed work",
    },
    emptyDescription: {
      id: "app.workDashboard.completed.description",
      defaultMessage: "Approved and rejected work will appear here",
    },
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case "drafts":
        return <DraftsTab />;
      case "recent":
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
          <WorkListTab
            items={filteredPending}
            isLoading={isLoading || isLoadingOperatorWorks || isLoadingMyOnlineWorks}
            isFetching={isFetchingPending}
            hasError={hasPendingError}
            errorMessage={errorMessage}
            onWorkClick={handleWorkClick}
            onRefresh={handleRefreshPending}
            renderBadges={renderWorkBadges}
            messages={pendingMessages}
            emptyIcon="⏳"
            headerContent={
              <div className="flex items-center gap-2">
                <select
                  className="border border-stroke-soft-200 text-xs rounded-md px-2 py-1 bg-bg-white-0"
                  value={pendingFilter}
                  onChange={(e) => setPendingFilter(e.target.value as typeof pendingFilter)}
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
                </select>
                <TimeFilterControl value={timeFilter} onChange={setTimeFilter} />
              </div>
            }
          />
        );
      case "completed":
        return (
          <WorkListTab
            items={filteredCompleted}
            isLoading={isLoading || (completedFilter === "myWorkReviewed" && isLoadingMyApprovals)}
            isFetching={isFetchingCompleted}
            hasError={hasCompletedError}
            errorMessage={errorMessage}
            onWorkClick={handleWorkClick}
            onRefresh={handleRefreshCompleted}
            renderBadges={
              completedFilter === "reviewedByYou"
                ? renderApprovalBadges
                : renderMyWorkReviewedBadges
            }
            messages={completedMessages}
            emptyIcon="📝"
            headerContent={
              <div className="flex items-center gap-2">
                <select
                  className="border border-stroke-soft-200 text-xs rounded-md px-2 py-1 bg-bg-white-0"
                  value={completedFilter}
                  onChange={(e) => setCompletedFilter(e.target.value as typeof completedFilter)}
                >
                  <option value="reviewedByYou">
                    {intl.formatMessage({
                      id: "app.workDashboard.filter.reviewedByYou",
                      defaultMessage: "Reviewed by you",
                    })}
                  </option>
                  <option value="myWorkReviewed">
                    {intl.formatMessage({
                      id: "app.workDashboard.filter.myWorkReviewed",
                      defaultMessage: "My work reviewed",
                    })}
                  </option>
                </select>
                <TimeFilterControl value={timeFilter} onChange={setTimeFilter} />
              </div>
            }
          />
        );
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
