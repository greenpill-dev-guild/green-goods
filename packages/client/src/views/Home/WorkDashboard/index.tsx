import {
  type Address,
  convertJobsToWorks,
  createPublicClientForChain,
  DEFAULT_CHAIN_ID,
  DEFAULT_RETRY_COUNT,
  getWorkApprovals as fetchWorkApprovals,
  GardenAccountABI,
  getGardens,
  getWorks,
  hapticLight,
  type Job,
  jobQueue,
  jobQueueEventBus,
  logger,
  queryKeys,
  STALE_TIME_FAST,
  STALE_TIME_MEDIUM,
  STALE_TIME_SLOW,
  isUserAddress as sharedIsUserAddress,
  type TimeFilter,
  toastService,
  useDrafts,
  useMyOnlineWorks,
  useUser,
  useWorkApprovals,
  type Work,
  type WorkJobPayload,
} from "@green-goods/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router-dom";
import { DashboardModal } from "./DashboardModal";
import { DashboardTabs } from "./DashboardTabs";
import { createWorkBadgeRenderer } from "./WorkBadges";

export interface WorkDashboardProps {
  className?: string;
  onClose?: () => void;
}

export const WorkDashboard: React.FC<WorkDashboardProps> = ({ className, onClose }) => {
  const intl = useIntl();
  const navigate = useNavigate();
  const { user } = useUser();
  const activeAddress = user?.id;

  const [timeFilter, setTimeFilter] = useState<TimeFilter>("month");

  const isUserAddress = (address: Address | undefined): boolean =>
    sharedIsUserAddress(address, activeAddress);

  const fetchApprovalsByRecipients = useCallback(async (recipients: string[]) => {
    if (recipients.length === 0) return [];

    const uniqueRecipients = Array.from(
      new Map(
        recipients.filter(Boolean).map((recipient) => [recipient.toLowerCase(), recipient])
      ).values()
    );

    const approvalGroups = await Promise.all(
      uniqueRecipients.map((recipient) => fetchWorkApprovals(recipient))
    );
    const approvalById = new Map<string, (typeof approvalGroups)[number][number]>();

    for (const approvals of approvalGroups) {
      for (const approval of approvals) {
        approvalById.set(approval.id, approval);
      }
    }

    return Array.from(approvalById.values());
  }, []);

  const {
    completedApprovals,
    isLoading,
    hasError,
    errorMessage,
    refetch: refetchApprovals,
  } = useWorkApprovals(activeAddress || undefined);

  const { draftCount } = useDrafts();

  // Fetch gardens and determine operator gardens
  const { data: gardens = [] } = useQuery({
    queryKey: queryKeys.gardens.byChain(DEFAULT_CHAIN_ID),
    queryFn: getGardens,
    staleTime: STALE_TIME_SLOW,
    retry: DEFAULT_RETRY_COUNT,
  });

  const operatorGardenIds = useMemo(
    () =>
      (gardens || [])
        .filter((g) => {
          if (!activeAddress) return false;
          const operators = (g.operators || []).map((op: string) => op.toLowerCase());
          return operators.includes(activeAddress.toLowerCase());
        })
        .map((g) => g.id),
    [gardens, activeAddress]
  );

  const { data: evaluatorGardenIds = [] } = useQuery({
    queryKey: queryKeys.role.evaluatorGardens(
      activeAddress || undefined,
      (gardens || []).map((g) => g.id)
    ),
    queryFn: async () => {
      if (!activeAddress || !gardens?.length) return [];
      const publicClient = createPublicClientForChain(DEFAULT_CHAIN_ID);

      const results = await publicClient.multicall({
        contracts: gardens.map((garden) => ({
          address: garden.id as Address,
          abi: GardenAccountABI,
          functionName: "isEvaluator" as const,
          args: [activeAddress as Address],
        })),
        allowFailure: true,
      });

      return gardens
        .filter((_, index) => results[index].status === "success" && Boolean(results[index].result))
        .map((garden) => garden.id);
    },
    enabled: !!activeAddress && (gardens?.length ?? 0) > 0,
    staleTime: STALE_TIME_MEDIUM,
  });

  const reviewerGardenIds = useMemo(() => {
    const combined = new Set<string>();
    operatorGardenIds.forEach((id) => combined.add(id));
    evaluatorGardenIds.forEach((id) => combined.add(id));
    return Array.from(combined);
  }, [operatorGardenIds, evaluatorGardenIds]);

  // Fetch works for gardens the user operates (online + offline merged)
  const {
    data: operatorWorks = [],
    isLoading: isLoadingOperatorWorks,
    isFetching: isFetchingOperatorWorks,
    isError: isErrorOperatorWorks,
    refetch: refetchOperatorWorks,
  } = useQuery({
    queryKey: queryKeys.operatorWorks.byAddress(activeAddress, reviewerGardenIds),
    queryFn: async () => {
      if (!activeAddress) return [];
      const allWorks: Work[] = [];

      for (const gardenId of reviewerGardenIds) {
        let online: Work[] = [];
        try {
          online = await getWorks([gardenId], DEFAULT_CHAIN_ID);
        } catch (err) {
          logger.warn(`[WorkDashboard] Failed to fetch works for garden ${gardenId}:`, {
            error: err,
          });
        }

        const offlineJobs = activeAddress
          ? await jobQueue.getJobs(activeAddress, { kind: "work", synced: false })
          : [];
        const gardenOfflineJobs = offlineJobs.filter(
          (job) => (job.payload as WorkJobPayload).gardenAddress === gardenId
        );

        const offline = await convertJobsToWorks(
          gardenOfflineJobs as Job<WorkJobPayload>[],
          activeAddress
        );

        const workMap = new Map<string, Work>();
        online.forEach((w) => workMap.set(w.id, { ...w, status: "pending" as const }));
        offline.forEach((w) => {
          const isDuplicate = online.some((onlineWork) => {
            const timeDiff = Math.abs(onlineWork.createdAt - w.createdAt);
            return onlineWork.actionUID === w.actionUID && timeDiff < 5 * 60 * 1000;
          });
          if (!isDuplicate) {
            workMap.set(w.id, w);
          }
        });

        allWorks.push(...Array.from(workMap.values()));
      }

      return allWorks.sort((a, b) => b.createdAt - a.createdAt);
    },
    enabled: reviewerGardenIds.length > 0 && !!activeAddress,
    staleTime: STALE_TIME_MEDIUM,
    retry: DEFAULT_RETRY_COUNT,
  });

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

  const recentWorkCombined = useMemo((): Work[] => {
    const onlineWithStatus: Work[] = recentOnlineWork.map((w) => ({
      ...w,
      status: "pending" as const,
    }));
    const combined = [...offlineQueueWork, ...onlineWithStatus];

    const seen = new Set<string>();
    const deduplicated = combined.filter((work) => {
      if (seen.has(work.id)) return false;
      seen.add(work.id);
      return true;
    });

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

  useEffect(() => {
    const unsub = jobQueueEventBus.onMultiple(
      ["job:added", "job:completed", "job:failed", "queue:sync-completed"],
      () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.queue.uploading() });
        queryClient.invalidateQueries({ queryKey: queryKeys.queue.stats() });
        queryClient.invalidateQueries({
          queryKey: ["myWorks", activeAddress, DEFAULT_CHAIN_ID],
        });
      }
    );
    return () => unsub();
  }, [queryClient, activeAddress]);

  const reviewedByYou = useMemo(
    () => new Set((completedApprovals || []).map((a) => a.workUID)),
    [completedApprovals]
  );

  const { data: allOperatorGardenApprovals = [] } = useQuery({
    queryKey: queryKeys.approvals.byOperatorGardens(reviewerGardenIds),
    queryFn: () => fetchApprovalsByRecipients(reviewerGardenIds),
    enabled: reviewerGardenIds.length > 0,
    staleTime: STALE_TIME_MEDIUM,
    retry: DEFAULT_RETRY_COUNT,
  });

  const alreadyReviewedByAnyone = useMemo(
    () => new Set((allOperatorGardenApprovals || []).map((a) => a.workUID)),
    [allOperatorGardenApprovals]
  );

  const operatorWorksById = useMemo(() => {
    const map = new Map<string, Work>();
    (operatorWorks || []).forEach((w) => map.set(w.id, w));
    return map;
  }, [operatorWorks]);

  const pendingNeedsReview = (operatorWorks || []).filter(
    (w) => !alreadyReviewedByAnyone.has(w.id) && !isUserAddress(w.gardenerAddress)
  );

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

  const {
    data: allApprovals = [],
    isLoading: isLoadingMyApprovals,
    isFetching: isFetchingMyApprovals,
    isError: isErrorMyApprovals,
    refetch: refetchMyApprovals,
  } = useQuery({
    queryKey: ["approvals", "byMyWorkGardens", activeAddress, [...myWorkGardenIds].sort()],
    queryFn: () => fetchApprovalsByRecipients(myWorkGardenIds),
    enabled: !!activeAddress && myWorkGardenIds.length > 0,
    staleTime: STALE_TIME_MEDIUM,
    retry: DEFAULT_RETRY_COUNT,
  });

  const myWorkIds = useMemo(() => new Set((myOnlineWorks || []).map((w) => w.id)), [myOnlineWorks]);

  const myReceivedApprovals = useMemo(
    () => (allApprovals || []).filter((a) => myWorkIds.has(a.workUID)),
    [allApprovals, myWorkIds]
  );

  const approvedOrRejectedForMe = useMemo(
    () => new Set((myReceivedApprovals || []).map((a) => a.workUID)),
    [myReceivedApprovals]
  );

  const pendingMySubmissions: Work[] = (myOnlineWorks || [])
    .filter((w) => isUserAddress(w.gardenerAddress) && !approvedOrRejectedForMe.has(w.id))
    .map((w) => ({ ...w, status: "pending" as const }));

  const completedMyWorkReviewed: Work[] = useMemo(
    () =>
      (myReceivedApprovals || []).map((a) => ({
        id: a.workUID,
        title: `Work ${String(a.workUID || "").slice(0, 8)}...`,
        actionUID: a.actionUID,
        gardenerAddress: a.gardenerAddress,
        gardenAddress: "",
        feedback: a.feedback || "",
        metadata: "",
        media: [],
        createdAt: a.createdAt,
        status: a.approved ? ("approved" as const) : ("rejected" as const),
      })),
    [myReceivedApprovals]
  );

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
        state: { from: "dashboard" },
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

  const renderWorkBadges = createWorkBadgeRenderer({
    activeAddress,
    reviewerGardenIds,
    reviewedByYou,
    isUserAddress,
  });

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

  return (
    <DashboardModal className={className} onClose={onClose}>
      <DashboardTabs
        draftCount={draftCount}
        timeFilter={timeFilter}
        onTimeFilterChange={setTimeFilter}
        uploadingWork={uploadingWork}
        pendingNeedsReview={pendingNeedsReview}
        pendingMySubmissions={pendingMySubmissions}
        completedReviewedByYou={completedReviewedByYou}
        completedMyWorkReviewed={completedMyWorkReviewed}
        isLoadingUploading={isLoadingUploading}
        isLoadingPending={isLoadingOperatorWorks || isLoadingMyOnlineWorks}
        isLoadingCompleted={isLoadingMyApprovals}
        isLoadingApprovals={isLoading}
        isFetchingRecent={isFetchingRecentOnline}
        isFetchingPending={isFetchingOperatorWorks || isFetchingMyWorks}
        isFetchingCompleted={isFetchingMyApprovals}
        hasRecentError={isErrorRecentOnline}
        hasPendingError={hasError || isErrorOperatorWorks || isErrorMyWorks}
        hasCompletedError={hasError || isErrorMyApprovals}
        errorMessage={errorMessage}
        onWorkClick={handleWorkClick}
        onRefreshRecent={handleRefreshRecent}
        onRefreshPending={handleRefreshPending}
        onRefreshCompleted={handleRefreshCompleted}
        renderWorkBadges={renderWorkBadges}
      />
    </DashboardModal>
  );
};
