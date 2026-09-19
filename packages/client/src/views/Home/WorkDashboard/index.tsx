import { toastService } from "@green-goods/shared/components/Toast/toast.service";
import {
  DEFAULT_RETRY_COUNT,
  STALE_TIME_MEDIUM,
} from "@green-goods/shared/config/query-keys/constants";
import { queryKeys } from "@green-goods/shared/config/query-keys/registry";
import { useOnlineStatus } from "@green-goods/shared/hooks/app/useOnlineStatus";
import { useUser } from "@green-goods/shared/hooks/auth/useUser";
import { useTimeout } from "@green-goods/shared/hooks/utils/useTimeout";
import { fetchApprovalsByRecipients } from "@green-goods/shared/hooks/work/useAggregatedApprovals";
import { useDrafts } from "@green-goods/shared/hooks/work/useDrafts";
import { useMyWorks } from "@green-goods/shared/hooks/work/useMyWorks";
import { useNeedsReview } from "@green-goods/shared/hooks/work/useNeedsReview";
import { useReviewerGardenIds } from "@green-goods/shared/hooks/work/useReviewerGardenIds";
import { useWorkApprovals } from "@green-goods/shared/hooks/work/useWorkApprovals";
import { useWorkUploads } from "@green-goods/shared/hooks/work/useWorkUploads";
import { logger } from "@green-goods/shared/modules/app/logger";
import {
  useUIStore,
  type WorkDashboardPendingFilter,
  type WorkDashboardTab,
} from "@green-goods/shared/stores/useUIStore";
import type { Address, Work } from "@green-goods/shared/types/domain";
import { hapticLight } from "@green-goods/shared/utils/app/haptics";
import { isUserAddress as sharedIsUserAddress } from "@green-goods/shared/utils/blockchain/address";
import { filterByTimeRange, type TimeFilter } from "@green-goods/shared/utils/time";
import { RiCheckLine, RiDraftLine, RiTaskLine } from "@remixicon/react";
import { useQuery } from "@tanstack/react-query";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router-dom";
import type { StandardTab } from "@/components/Navigation";
import { getPwaSheetCloseDelayMs } from "@/components/Pwa/sheetStyles";
import { CompletedTab } from "./CompletedTab";
import { DraftsTab } from "./Drafts";
import { PendingTab } from "./PendingTab";
import { buildUploadActions } from "./uploadActions";
import { WorkDashboardShell } from "./WorkDashboardShell";
import {
  approvalsToCompletedWorks,
  buildWorkMap,
  combinePendingWork,
  extractWorkGardenIds,
  receivedApprovalsToWorks,
  resolveWorkNavigation,
} from "./workDashboardUtils";

/** Work that has not reached the chain yet: queued, sending, or failed to send. */
function isOnThisDevice(work: Work): boolean {
  return (
    ["offline", "uploading", "syncing", "sync_failed"].includes(work.status) ||
    work.id.startsWith("0xoffline_") ||
    !work.id.startsWith("0x")
  );
}

function oldestTime(...times: Array<number | undefined>): number | undefined {
  const known = times.filter((time): time is number => typeof time === "number" && time > 0);
  return known.length > 0 ? Math.min(...known) : undefined;
}

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

  // Your review history: works you approved or rejected, as the indexer reports them.
  const {
    completedApprovals,
    isLoading,
    hasError,
    errorMessage,
    dataUpdatedAt: reviewHistoryUpdatedAt,
    refetch: refetchApprovals,
  } = useWorkApprovals(activeAddress || undefined);
  const isOffline = !useOnlineStatus();

  // Get draft count for badge
  const { draftCount } = useDrafts();

  // Queued work and decisions go out together from the bar under every tab.
  const uploads = useWorkUploads();
  const uploadActions = buildUploadActions(
    uploads,
    {
      onUpload: () => {
        hapticLight();
        // useWorkUploads reports every outcome, a failure included.
        uploads.upload().catch(() => undefined);
      },
      onPrepareNow: uploads.prepareNow,
    },
    intl.formatMessage
  );

  // Timer for close animation (auto-cleared on unmount)
  const { set: scheduleTimeout, clear: clearCloseTimeout } = useTimeout();

  // State management — open to the tab/filter the caller requested (e.g. the arrival toast),
  // else defaults. Store presets are consumed once at mount; an already-open dashboard
  // intentionally ignores later store writes.
  const initialTab = useUIStore((s) => s.workDashboardInitialTab);
  const initialPendingFilter = useUIStore((s) => s.workDashboardInitialPendingFilter);
  const [activeTab, setActiveTab] = useState<WorkDashboardTab>(initialTab ?? "pending");
  const [isClosing, setIsClosing] = useState(false);
  const closeCompletedRef = useRef(false);
  const [pendingFilter, setPendingFilter] = useState<WorkDashboardPendingFilter>(
    initialPendingFilter ?? "all"
  );
  const [completedFilter, setCompletedFilter] = useState<"reviewedByYou" | "myWorkReviewed">(
    "reviewedByYou"
  );
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("month");

  // Needs review reads each garden you review the way its Work tab does, so a review
  // made on this device leaves the list at once — the same list the arrival toast counts.
  const { reviewerGardenIds, isLoading: isLoadingReviewerGardens } =
    useReviewerGardenIds(activeAddress);
  const needsReview = useNeedsReview(reviewerGardenIds, activeAddress);

  // Include offline queued submissions so the Pending tab still reflects the
  // dashboard badge after the Recent/Uploading tab was removed.
  const {
    data: myWorks = [],
    isLoading: isLoadingMyWorks,
    isError: isErrorMyWorks,
    lastSuccessfulRefresh: myWorksUpdatedAt,
    refetch: refetchMyWorks,
  } = useMyWorks({ includeOffline: true });

  // Which works have you reviewed? The history, plus decisions made here that the
  // indexer has not reported yet.
  const reviewedByYou = useMemo(
    () =>
      new Set([
        ...(completedApprovals || []).map((approval) => approval.workUID),
        ...needsReview.decidedHere.map((work) => work.id),
      ]),
    [completedApprovals, needsReview.decidedHere]
  );

  const reviewWorksById = useMemo(
    () => buildWorkMap([...needsReview.works, ...needsReview.decidedHere]),
    [needsReview.works, needsReview.decidedHere]
  );

  const pendingNeedsReview = needsReview.works;

  // Reviewed by you: the history, plus decisions made here until the history has them.
  const completedReviewedByYou: Work[] = useMemo(() => {
    const history = approvalsToCompletedWorks(completedApprovals);
    const inHistory = new Set(history.map((work) => work.id));
    // A decision made on this device is recent, so it files under now for the time filter.
    const decidedAt = Math.floor(Date.now() / 1000);
    const decidedHere = needsReview.decidedHere
      .filter((work) => !inHistory.has(work.id))
      .map((work) => ({ ...work, createdAt: decidedAt }));
    return [...decidedHere, ...history];
  }, [completedApprovals, needsReview.decidedHere]);

  const myWorkGardenIds = useMemo(() => extractWorkGardenIds(myWorks || []), [myWorks]);
  const myWorksById = useMemo(() => buildWorkMap(myWorks || []), [myWorks]);
  const myApprovalsEnabled = !!activeAddress && myWorkGardenIds.length > 0;

  // Fetch approvals scoped to gardens where the user has submitted work.
  const {
    data: allApprovals,
    isLoading: isLoadingMyApprovals,
    isError: isErrorMyApprovals,
    dataUpdatedAt: myApprovalsUpdatedAt,
    refetch: refetchMyApprovals,
  } = useQuery({
    queryKey: queryKeys.approvals.byMyWorkGardens(activeAddress, myWorkGardenIds),
    queryFn: () => fetchApprovalsByRecipients(myWorkGardenIds),
    enabled: myApprovalsEnabled,
    staleTime: STALE_TIME_MEDIUM,
    retry: DEFAULT_RETRY_COUNT,
  });

  // Filter approvals to only those for the user's works
  const myReceivedApprovals = useMemo(
    () => (allApprovals ?? []).filter((approval) => myWorksById.has(approval.workUID)),
    [allApprovals, myWorksById]
  );

  const reviewedForMe = useMemo(
    () => new Set(myReceivedApprovals.map((approval) => approval.workUID)),
    [myReceivedApprovals]
  );

  // Pending: your submissions still waiting. Work still on this device is waiting by
  // definition; anything already on chain needs a successful review read first, so a
  // failed read never shows a reviewed submission as pending.
  const pendingMySubmissions: Work[] = (myWorks || []).filter((work) => {
    if (!isUserAddress(work.gardenerAddress)) return false;
    if (work.status === "approved" || work.status === "rejected") return false;
    if (isOnThisDevice(work)) return true;
    return allApprovals !== undefined && !reviewedForMe.has(work.id);
  });

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
    () => receivedApprovalsToWorks(myReceivedApprovals, myWorksById),
    [myReceivedApprovals, myWorksById]
  );

  const completedWork =
    completedFilter === "reviewedByYou" ? completedReviewedByYou : completedMyWorkReviewed;

  // Pending work stays listed however long it has waited; only history takes a time range.
  const filteredPending = pendingWork;
  const filteredCompleted = filterByTimeRange(completedWork, timeFilter);

  // Navigation handler - handles both Work and WorkApproval shapes
  const handleWorkClick = (work: Work | { workUID?: string; gardenAddress?: Address }) => {
    try {
      const nav = resolveWorkNavigation(work, reviewWorksById);
      if (!nav) return;

      onClose?.();
      navigate(`/home/${nav.gardenId}/work/${nav.workId}`, {
        state: { from: "dashboard", returnTo: "/home" },
        viewTransition: true,
      });
    } catch (err) {
      logger.error("Navigation error:", { error: err });
      toastService.error({
        title: intl.formatMessage({
          id: "app.workDashboard.error.navigationFailed",
          defaultMessage: "Navigation failed",
        }),
        message: intl.formatMessage({
          id: "app.workDashboard.error.navigationFailedMessage",
          defaultMessage: "Could not navigate to the selected item",
        }),
        context: "workDashboard",
      });
    }
  };

  // One Refresh re-reads everything the dashboard shows, from either tab. Only a
  // refresh someone asked for reports failure; background reads stay quiet (D4-A).
  const [isRefreshing, setIsRefreshing] = useState(false);
  const mountedRef = useRef(false);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const handleRefresh = async () => {
    if (isRefreshing) return;
    hapticLight();
    setIsRefreshing(true);
    const succeeded = (result: { status: string }) => result.status !== "error";
    const outcomes = await Promise.all([
      needsReview.refetch().catch(() => false),
      refetchMyWorks()
        .then(succeeded)
        .catch(() => false),
      refetchApprovals()
        .then(succeeded)
        .catch(() => false),
      myApprovalsEnabled
        ? refetchMyApprovals()
            .then(succeeded)
            .catch(() => false)
        : true,
    ]);
    if (!mountedRef.current) return;
    setIsRefreshing(false);
    if (outcomes.includes(false)) {
      toastService.error({
        id: "work-dashboard-refresh",
        message: intl.formatMessage({
          id: "app.workDashboard.refreshFailed",
          defaultMessage: "Couldn't refresh. Try again.",
        }),
        context: "workDashboard",
        suppressLogging: true,
      });
    }
  };

  // Offline, the count line says when the oldest part of the list was saved.
  const pendingSavedAt = oldestTime(needsReview.savedAt, myWorksUpdatedAt, myApprovalsUpdatedAt);
  const completedSavedAt = oldestTime(reviewHistoryUpdatedAt, myApprovalsUpdatedAt);

  // Loading and errors follow the source the active filter shows, and an error
  // takes over a tab only when there is nothing to show.
  const needsReviewState = {
    isLoading: isLoadingReviewerGardens || needsReview.isLoading,
    isError: needsReview.isError,
  };
  const mySubmissionsState = {
    isLoading: isLoadingMyWorks || isLoadingMyApprovals,
    isError: isErrorMyWorks || (isErrorMyApprovals && allApprovals === undefined),
  };
  const pendingSources =
    pendingFilter === "needsReview"
      ? [needsReviewState]
      : pendingFilter === "mySubmissions"
        ? [mySubmissionsState]
        : [needsReviewState, mySubmissionsState];
  const isLoadingPending =
    pendingSources.some((source) => source.isLoading) && filteredPending.length === 0;
  const hasPendingError =
    pendingSources.some((source) => source.isError) && filteredPending.length === 0;

  const isLoadingCompleted = completedFilter === "reviewedByYou" ? isLoading : isLoadingMyApprovals;
  const hasCompletedError =
    (completedFilter === "reviewedByYou" ? hasError : isErrorMyApprovals) &&
    filteredCompleted.length === 0;
  // Only the review history carries its own error text; the other reads use the tab's default.
  const completedErrorMessage = completedFilter === "reviewedByYou" ? errorMessage : undefined;

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

  const finishClose = useCallback(() => {
    if (closeCompletedRef.current) return;
    closeCompletedRef.current = true;
    clearCloseTimeout();
    onClose?.();
  }, [clearCloseTimeout, onClose]);

  const handleClose = () => {
    if (isClosing) return;
    closeCompletedRef.current = false;
    setIsClosing(true);
    scheduleTimeout(finishClose, getPwaSheetCloseDelayMs());
  };

  useEffect(() => {
    if (!isClosing) return;

    const handlePageHide = () => finishClose();
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") finishClose();
    };

    window.addEventListener("pagehide", handlePageHide);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("pagehide", handlePageHide);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [finishClose, isClosing]);

  const renderTabContent = () => {
    switch (activeTab) {
      case "drafts":
        return <DraftsTab onBeforeNavigate={onClose} />;
      case "pending":
      default:
        return (
          <PendingTab
            items={filteredPending}
            isLoading={isLoadingPending}
            isFetching={isRefreshing}
            hasError={hasPendingError}
            onWorkClick={handleWorkClick}
            onRefresh={handleRefresh}
            isOffline={isOffline}
            savedAt={pendingSavedAt}
            pendingFilter={pendingFilter}
            onPendingFilterChange={setPendingFilter}
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
            isLoading={isLoadingCompleted}
            isFetching={isRefreshing}
            hasError={hasCompletedError}
            errorMessage={completedErrorMessage}
            onWorkClick={handleWorkClick}
            onRefresh={handleRefresh}
            isOffline={isOffline}
            savedAt={completedSavedAt}
            completedFilter={completedFilter}
            onCompletedFilterChange={setCompletedFilter}
            timeFilter={timeFilter}
            onTimeFilterChange={setTimeFilter}
            waitingUploadIds={uploads.waitingDecisionWorkIds}
          />
        );
    }
  };

  return (
    <WorkDashboardShell
      className={className}
      isClosing={isClosing}
      onRequestClose={handleClose}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={(tabId: string) => setActiveTab(tabId as WorkDashboardTab)}
      actions={uploadActions}
    >
      {renderTabContent()}
    </WorkDashboardShell>
  );
};
