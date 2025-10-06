import {
  RiCheckboxCircleLine,
  RiCheckLine,
  RiCloseLine,
  RiTimeLine,
  RiUploadLine,
} from "@remixicon/react";
import React, { useEffect, useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useWorkApprovals } from "@/hooks/work/useWorkApprovals";
import { useUser } from "@/providers/user";
import { cn } from "@/utils/styles/cn";
import { CompletedTab } from "./Completed";
import { PendingTab } from "./Pending";
import { UploadingTab } from "./Uploading";
import { TimeFilterControl } from "./TimeFilterControl";

import { type StandardTab, StandardTabs } from "@/components/UI/Tabs";
import { getGardens } from "@/modules/data/greengoods";
import {
  getWorks,
  getWorkApprovals as fetchWorkApprovals,
  getWorksByGardener,
} from "@/modules/data/eas";
import { jobQueue, jobQueueDB } from "@/modules/job-queue";
import { jobToWork } from "@/hooks/work/useWorks";
import { jobQueueEventBus } from "@/modules/job-queue/event-bus";
import { queryKeys } from "@/hooks/query-keys";

export interface WorkDashboardProps {
  className?: string;
  onClose?: () => void;
}

export const WorkDashboard: React.FC<WorkDashboardProps> = ({ className, onClose }) => {
  const intl = useIntl();
  const navigate = useNavigate();
  const { smartAccountAddress } = useUser();

  // Use the new hook for work approvals
  const { completedApprovals, isLoading, hasError, errorMessage } = useWorkApprovals(
    smartAccountAddress || undefined
  );

  // State management
  const [activeTab, setActiveTab] = useState<"uploading" | "pending" | "completed">("uploading");
  const [isClosing, setIsClosing] = useState(false);
  const [pendingFilter, setPendingFilter] = useState<"all" | "needsReview" | "mySubmissions">(
    "all"
  );
  const [completedFilter, setCompletedFilter] = useState<"reviewedByYou" | "myWorkReviewed">(
    "reviewedByYou"
  );
  const [timeFilter, setTimeFilter] = useState<"day" | "week" | "month" | "year">("month");

  // TimeFilterControl moved to its own component

  // Prevent background scrolling when modal is open
  useEffect(() => {
    document.documentElement.classList.add("modal-open");
    return () => {
      document.documentElement.classList.remove("modal-open");
    };
  }, []);

  // Fetch gardens and determine operator gardens
  const { data: gardens = [] } = useQuery({
    queryKey: ["gardens"],
    queryFn: getGardens,
    staleTime: 60_000,
  });

  const operatorGardenIds = useMemo(
    () =>
      (gardens || [])
        .filter(
          (g) =>
            smartAccountAddress &&
            g.operators?.some(
              (op: string) => op.toLowerCase() === smartAccountAddress.toLowerCase()
            )
        )
        .map((g) => g.id),
    [gardens, smartAccountAddress]
  );

  // Fetch works for gardens the user operates
  const { data: operatorWorks = [], isLoading: isLoadingOperatorWorks } = useQuery({
    queryKey: ["operatorWorks", smartAccountAddress, operatorGardenIds],
    queryFn: async () => {
      // Fetch online works
      const lists = await Promise.all(operatorGardenIds.map((g) => getWorks(g)));
      const online = lists.flat().map((w) => ({ ...w, status: "pending" as const }));

      // Merge with any optimistic works cached in React Query for these gardens
      const optimistic: Work[] = [];
      for (const gardenId of operatorGardenIds) {
        const cached = (queryClient.getQueryData(["works", gardenId]) as Work[] | undefined) || [];
        optimistic.push(
          ...cached.map((w) => ({
            ...w,
            status: (w.status || "pending") as any,
          }))
        );
      }

      // Deduplicate by id, prefer online entries
      const byId = new Map<string, Work>();
      for (const w of optimistic) byId.set(w.id, w);
      for (const w of online) byId.set(w.id, w);
      return Array.from(byId.values()).sort((a, b) => b.createdAt - a.createdAt);
    },
    enabled: operatorGardenIds.length > 0,
    staleTime: 30_000,
  });

  // Fetch your own online works across all gardens
  const { data: myOnlineWorks = [], isLoading: isLoadingMyOnlineWorks } = useQuery({
    queryKey: ["myOnlineWorks", smartAccountAddress],
    queryFn: async () => {
      if (!smartAccountAddress) return [] as Work[];
      const works = await getWorksByGardener(smartAccountAddress);
      // Normalize shape to Work with pending status by default (until approved/rejected)
      return works.map((w) => ({ ...w, status: "pending" as const }));
    },
    enabled: !!smartAccountAddress,
    staleTime: 30_000,
  });

  const queryClient = useQueryClient();

  // Uploading work (from offline work jobs)
  const { data: uploadingWork = [], isLoading: isLoadingUploading } = useQuery({
    queryKey: queryKeys.queue.uploading(),
    queryFn: async () => {
      const jobs = await jobQueue.getJobs({ kind: "work", synced: false });
      const works = await Promise.all(
        jobs.map(async (job: any) => {
          const work = jobToWork(job);
          const images = await jobQueueDB.getImagesForJob(job.id);
          work.media = images.map((img: any) => img.url);
          if (smartAccountAddress) {
            work.gardenerAddress = smartAccountAddress;
          }
          return work;
        })
      );
      // Newest first
      return works.sort((a, b) => b.createdAt - a.createdAt);
    },
    staleTime: 5000,
  });

  // Invalidate uploading jobs on queue events
  useEffect(() => {
    const unsub = jobQueueEventBus.onMultiple(
      ["job:added", "job:completed", "job:failed", "job:retrying", "queue:sync-completed"],
      () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.queue.uploading() });
      }
    );
    return () => unsub();
  }, [queryClient]);

  // Which works have you already reviewed?
  const reviewedByYou = useMemo(
    () => new Set((completedApprovals || []).map((a) => a.workUID)),
    [completedApprovals]
  );

  const operatorWorksById = useMemo(() => {
    const map = new Map<string, any>();
    (operatorWorks || []).forEach((w: any) => map.set(w.id, w));
    return map;
  }, [operatorWorks]);

  // Pending work needing your review (from gardens you operate)
  const pendingNeedsReview: any[] = (operatorWorks || []).filter(
    (w: any) => !reviewedByYou.has(w.id)
  );

  // Completed approvals (approved/rejected by you)
  const completedReviewedByYou = completedApprovals.filter((work) =>
    ["approved", "rejected"].includes(work.status)
  );

  // Completed: approvals for your own submissions (you as gardener)
  const { data: myReceivedApprovals = [], isLoading: isLoadingMyApprovals } = useQuery({
    queryKey: ["approvals", "byGardener", smartAccountAddress],
    queryFn: () => fetchWorkApprovals(smartAccountAddress || undefined),
    enabled: !!smartAccountAddress,
    staleTime: 30_000,
  });

  // Pending: your submissions across ALL gardens (online and awaiting review)
  // Exclude any that already have approvals (approved/rejected)
  const approvedOrRejectedForMe = useMemo(
    () => new Set((myReceivedApprovals || []).map((a) => a.workUID)),
    [myReceivedApprovals]
  );

  const pendingMySubmissions: any[] = (myOnlineWorks || []).filter(
    (w: any) =>
      w.gardenerAddress?.toLowerCase() === smartAccountAddress?.toLowerCase() &&
      !approvedOrRejectedForMe.has(w.id)
  );

  // Combine lists and deduplicate by id when showing "all"
  const combinedPending = useMemo(() => {
    const map = new Map<string, any>();
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

  // Time filter helpers
  const toMs = (timestamp: number): number => (timestamp < 1e12 ? timestamp * 1000 : timestamp);
  const cutoffMs = useMemo(() => {
    const now = Date.now();
    switch (timeFilter) {
      case "day":
        return now - 1 * 24 * 60 * 60 * 1000;
      case "week":
        return now - 7 * 24 * 60 * 60 * 1000;
      case "month":
        return now - 30 * 24 * 60 * 60 * 1000;
      case "year":
        return now - 365 * 24 * 60 * 60 * 1000;
      default:
        return now - 30 * 24 * 60 * 60 * 1000;
    }
  }, [timeFilter]);

  const filterByTime = <T extends { createdAt: number }>(items: T[]): T[] =>
    (items || []).filter((i) => toMs(i.createdAt) >= cutoffMs);

  const filteredUploading = filterByTime(uploadingWork);
  const filteredPending = filterByTime(pendingWork);
  const filteredCompleted = filterByTime(completedWork as any);

  // Navigation handler
  const handleWorkClick = (work: any) => {
    try {
      // Resolve garden/work for both Work and WorkApproval items
      let workId = work.id || work.workUID;
      let gardenId = work.gardenAddress || work.gardenId;

      if (!gardenId && work.workUID) {
        const found = operatorWorksById.get(work.workUID);
        if (found) {
          gardenId = found.gardenAddress;
          workId = found.id;
        }
      }

      if (!gardenId || !workId) {
        console.error("Invalid work object for navigation:", work);
        return;
      }

      navigate(`/home/${gardenId}/work/${workId}`, { state: { from: "dashboard" } });
    } catch (error) {
      console.error("Error navigating to work:", error, work);
    }
  };

  // Badge helpers
  const badge = (text: string, cls: string, icon?: React.ReactNode) => (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border ${cls}`}>
      {icon}
      {text}
    </span>
  );

  const renderWorkBadges = (item: any) => {
    const badges: React.ReactNode[] = [];
    const isGardener =
      smartAccountAddress &&
      item.gardenerAddress?.toLowerCase() === smartAccountAddress.toLowerCase();
    const isOperator =
      smartAccountAddress &&
      operatorGardenIds.some((id) => id.toLowerCase() === item.gardenAddress?.toLowerCase());
    const reviewed = reviewedByYou.has(item.id);

    if (isOperator && !reviewed) {
      badges.push(
        badge(
          "Needs review",
          "bg-amber-50 text-amber-600 border-amber-200",
          <RiTimeLine className="w-3 h-3" />
        )
      );
    }
    if (reviewed) {
      badges.push(
        badge(
          "Reviewed by you",
          "bg-emerald-50 text-emerald-600 border-emerald-200",
          <RiCheckLine className="w-3 h-3" />
        )
      );
    }
    if (isGardener) {
      badges.push(badge("You submitted", "bg-slate-50 text-slate-600 border-slate-200"));
    }
    return badges;
  };

  const renderApprovalBadges = (_item: any) => {
    return [
      badge(
        "Reviewed by you",
        "bg-emerald-50 text-emerald-600 border-emerald-200",
        <RiCheckLine className="w-3 h-3" />
      ),
    ];
  };

  const renderMyWorkReviewedBadges = (_item: any) => {
    return [badge("Your work was reviewed", "bg-slate-50 text-slate-600 border-slate-200")];
  };

  // Enhanced tabs without counts (will be in content)
  const tabs: StandardTab[] = [
    {
      id: "uploading",
      label: intl.formatMessage({
        id: "app.workDashboard.tabs.uploading",
        defaultMessage: "Uploading",
      }),
      icon: <RiUploadLine className="w-4 h-4" />,
      count: filteredUploading.length,
    },
    {
      id: "pending",
      label: intl.formatMessage({
        id: "app.workDashboard.tabs.pending",
        defaultMessage: "Pending",
      }),
      icon: <RiTimeLine className="w-4 h-4" />,
      count: filteredPending.length,
    },
    {
      id: "completed",
      label: intl.formatMessage({
        id: "app.workDashboard.tabs.completed",
        defaultMessage: "Completed",
      }),
      icon: <RiCheckboxCircleLine className="w-4 h-4" />,
      count: filteredCompleted.length,
    },
  ];

  const handleClose = () => {
    setIsClosing(true);
    // Start close animation, then call onClose after animation completes
    setTimeout(() => {
      onClose?.();
    }, 300); // Match the modal-slide-exit animation duration
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case "uploading":
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
            uploadingWork={uploadingWork}
            isLoading={isLoading}
            onWorkClick={handleWorkClick}
          />
        );
    }
  };

  return (
    <div
      className={cn(
        "fixed inset-0 bg-black/20 backdrop-blur-sm z-[10001] flex items-end justify-center",
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
              className="btn-icon rounded-full"
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
          onTabChange={(tabId: string) =>
            setActiveTab(tabId as "uploading" | "pending" | "completed")
          }
          isLoading={isLoading}
        />

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-hidden">{renderTabContent()}</div>
      </div>
    </div>
  );
};
