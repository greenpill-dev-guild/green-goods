import { DEFAULT_CHAIN_ID } from "@green-goods/shared/config/blockchain";
import { queryKeys, useMyOnlineWorks, useUser, useWorkApprovals } from "@green-goods/shared/hooks";
import {
  getWorkApprovals as fetchWorkApprovals,
  getGardens,
  getWorks,
  jobQueueEventBus,
} from "@green-goods/shared/modules";
import { jobQueue } from "@green-goods/shared/modules/job-queue";
import {
  cn,
  compareAddresses,
  convertJobsToWorks,
  filterByTimeRange,
  isUserAddress as sharedIsUserAddress,
  type TimeFilter,
} from "@green-goods/shared/utils";
import { RiCheckLine, RiCloseLine, RiTaskLine, RiTimeLine } from "@remixicon/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useEffect, useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router-dom";
import { type StandardTab, StandardTabs } from "@/components/Navigation";
import { CompletedTab } from "./Completed";
import { PendingTab } from "./Pending";
import { TimeFilterControl } from "./TimeFilterControl";
import { UploadingTab } from "./Uploading";

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
  const isUserAddress = (address: string | undefined): boolean =>
    sharedIsUserAddress(address, activeAddress);

  // Use the new hook for work approvals
  const { completedApprovals, isLoading, hasError, errorMessage } = useWorkApprovals(
    activeAddress || undefined
  );

  // State management
  const [activeTab, setActiveTab] = useState<"recent" | "pending" | "completed">("recent");
  const [isClosing, setIsClosing] = useState(false);
  const [pendingFilter, setPendingFilter] = useState<"all" | "needsReview" | "mySubmissions">(
    "all"
  );
  const [completedFilter, setCompletedFilter] = useState<"reviewedByYou" | "myWorkReviewed">(
    "reviewedByYou"
  );
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("month");

  // Prevent background scrolling when modal is open
  useEffect(() => {
    document.documentElement.classList.add("modal-open");
    return () => {
      document.documentElement.classList.remove("modal-open");
    };
  }, []);

  // Fetch gardens and determine operator gardens
  const { data: gardens = [] } = useQuery({
    queryKey: queryKeys.gardens.byChain(DEFAULT_CHAIN_ID),
    queryFn: getGardens,
    staleTime: 60_000,
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

  // Fetch works for gardens the user operates (online + offline merged)
  const { data: operatorWorks = [], isLoading: isLoadingOperatorWorks } = useQuery({
    queryKey: ["operatorWorks", activeAddress, operatorGardenIds],
    queryFn: async () => {
      if (!activeAddress) return [];
      const allWorks: Work[] = [];

      for (const gardenId of operatorGardenIds) {
        // Fetch online works from EAS
        const online = await getWorks([gardenId], DEFAULT_CHAIN_ID);

        // Fetch offline works from job queue (scoped to current user)
        const offlineJobs = activeAddress
          ? await jobQueue.getJobs(activeAddress, { kind: "work", synced: false })
          : [];
        const gardenOfflineJobs = offlineJobs.filter(
          (job) => (job.payload as WorkJobPayload).gardenAddress === gardenId
        );

        // Convert offline jobs to Work format using utility
        const offline = await convertJobsToWorks(
          gardenOfflineJobs as Job<WorkJobPayload>[],
          activeAddress
        );

        // Merge and deduplicate (prefer online, exclude duplicates)
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
    enabled: operatorGardenIds.length > 0 && !!activeAddress,
    staleTime: 30_000,
  });

  // Use new hooks for user's works
  const { data: myOnlineWorks = [], isLoading: isLoadingMyOnlineWorks } = useMyOnlineWorks();
  const { data: recentOnlineWork = [], isLoading: isLoadingRecentOnline } = useMyOnlineWorks({
    timeFilter,
  });

  const queryClient = useQueryClient();

  // Uploading work (offline queue jobs only, scoped to current user)
  const { data: offlineQueueWork = [], isLoading: isLoadingOfflineQueue } = useQuery({
    queryKey: queryKeys.queue.uploading(),
    queryFn: async () => {
      if (!activeAddress) return [];
      const jobs = await jobQueue.getJobs(activeAddress, { kind: "work", synced: false });
      const works = await convertJobsToWorks(jobs as Job<WorkJobPayload>[], activeAddress);
      return works.sort((a, b) => b.createdAt - a.createdAt);
    },
    enabled: !!activeAddress,
    staleTime: 5000,
  });

  // Combine offline queue + recent online work for "Recent" tab
  const recentWorkCombined = useMemo(() => {
    const combined = [...offlineQueueWork, ...recentOnlineWork];

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
          queryKey: ["myWorks", activeAddress, DEFAULT_CHAIN_ID],
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

  const operatorWorksById = useMemo(() => {
    const map = new Map<string, Work>();
    (operatorWorks || []).forEach((w) => map.set(w.id, w));
    return map;
  }, [operatorWorks]);

  // Pending work needing your review (from gardens you operate, excluding your own submissions)
  const pendingNeedsReview = (operatorWorks || []).filter(
    (w) => !reviewedByYou.has(w.id) && !isUserAddress(w.gardenerAddress)
  );

  // Completed approvals (approved/rejected by you)
  const completedReviewedByYou = completedApprovals.filter((work) =>
    ["approved", "rejected"].includes(work.status)
  );

  // Completed: approvals for your own submissions (you as gardener)
  const { data: myReceivedApprovals = [], isLoading: isLoadingMyApprovals } = useQuery({
    queryKey: ["approvals", "byGardener", activeAddress],
    queryFn: () => fetchWorkApprovals(activeAddress || undefined),
    enabled: !!activeAddress,
    staleTime: 30_000,
  });

  // Pending: your submissions across ALL gardens (online and awaiting review)
  const approvedOrRejectedForMe = useMemo(
    () => new Set((myReceivedApprovals || []).map((a) => a.workUID)),
    [myReceivedApprovals]
  );

  const pendingMySubmissions = (myOnlineWorks || []).filter(
    (w) => isUserAddress(w.gardenerAddress) && !approvedOrRejectedForMe.has(w.id)
  );

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

  const completedMyWorkReviewed = useMemo(
    () =>
      (myReceivedApprovals || []).map((a) => ({
        id: a.workUID,
        gardenerAddress: a.gardenerAddress,
        gardenAddress: undefined as unknown as string,
        actionUID: a.actionUID,
        title: `Work ${String(a.workUID || "").slice(0, 8)}...`,
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
  const handleWorkClick = (work: Work | { workUID?: string; gardenAddress?: string }) => {
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

      navigate(`/home/${gardenId}/work/${workId}`, { state: { from: "dashboard" } });
    } catch {
      // Navigation error - silently fail
    }
  };

  // Badge renderers using CSS utilities from utilities.css
  const renderWorkBadges = (item: Work) => {
    const badges: React.ReactNode[] = [];
    const isGardener = isUserAddress(item.gardenerAddress);
    const isOperator =
      activeAddress && operatorGardenIds.some((id) => compareAddresses(id, item.gardenAddress));
    const reviewed = reviewedByYou.has(item.id);

    if (isOperator && !reviewed) {
      badges.push(
        <span key="review" className="badge-pill-amber">
          <RiTimeLine className="w-3 h-3" />
          Needs review
        </span>
      );
    }
    if (reviewed) {
      badges.push(
        <span key="reviewed" className="badge-pill-emerald">
          <RiCheckLine className="w-3 h-3" />
          Reviewed by you
        </span>
      );
    }
    if (isGardener) {
      badges.push(
        <span key="submitted" className="badge-pill-slate">
          You submitted
        </span>
      );
    }
    return badges;
  };

  const renderApprovalBadges = () => [
    <span key="reviewed" className="badge-pill-emerald">
      <RiCheckLine className="w-3 h-3" />
      Reviewed by you
    </span>,
  ];

  const renderMyWorkReviewedBadges = () => [
    <span key="work-reviewed" className="badge-pill-slate">
      Your work was reviewed
    </span>,
  ];

  const tabs: StandardTab[] = [
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
    setTimeout(() => {
      onClose?.();
    }, 300);
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case "recent":
        return (
          <UploadingTab
            uploadingWork={filteredUploading}
            isLoading={isLoading || isLoadingUploading}
            onWorkClick={handleWorkClick}
            headerContent={<TimeFilterControl value={timeFilter} onChange={setTimeFilter} />}
          />
        );
      case "pending":
        return (
          <PendingTab
            pendingWork={filteredPending}
            isLoading={isLoading || isLoadingOperatorWorks || isLoadingMyOnlineWorks}
            hasError={hasError}
            errorMessage={errorMessage}
            onWorkClick={handleWorkClick}
            renderBadges={renderWorkBadges}
            headerContent={
              <div className="flex items-center gap-2">
                <select
                  className="border border-slate-200 text-xs rounded-md px-2 py-1 bg-white"
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
          <CompletedTab
            completedWork={filteredCompleted as any}
            isLoading={isLoading || (completedFilter === "myWorkReviewed" && isLoadingMyApprovals)}
            hasError={hasError}
            errorMessage={errorMessage}
            onWorkClick={handleWorkClick}
            renderBadges={
              completedFilter === "reviewedByYou"
                ? renderApprovalBadges
                : renderMyWorkReviewedBadges
            }
            headerContent={
              <div className="flex items-center gap-2">
                <select
                  className="border border-slate-200 text-xs rounded-md px-2 py-1 bg-white"
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
            onWorkClick={handleWorkClick}
            headerContent={<TimeFilterControl value={timeFilter} onChange={setTimeFilter} />}
          />
        );
    }
  };

  return (
    <div
      className={cn(
        "fixed inset-0 bg-black/20 backdrop-blur-sm z-[20000] flex items-end justify-center",
        isClosing ? "modal-backdrop-exit" : "modal-backdrop-enter"
      )}
      data-testid="modal-drawer-overlay"
      onClick={handleClose}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          handleClose();
        }
      }}
      tabIndex={-1}
    >
      <div
        className={cn(
          "bg-white rounded-t-3xl shadow-2xl w-full overflow-hidden flex flex-col",
          isClosing ? "modal-slide-exit" : "modal-slide-enter",
          className
        )}
        style={{ height: "85vh" }}
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
            <p className="text-sm text-slate-600 truncate">
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
              aria-label="Close modal"
            >
              <RiCloseLine className="w-5 h-5 focus:text-primary active:text-primary" />
            </button>
          </div>
        </div>

        {/* Standardized Tabs */}
        <StandardTabs
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={(tabId: string) => setActiveTab(tabId as "recent" | "pending" | "completed")}
          triggerClassName="text-xs"
        />

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-hidden">{renderTabContent()}</div>
      </div>
    </div>
  );
};
