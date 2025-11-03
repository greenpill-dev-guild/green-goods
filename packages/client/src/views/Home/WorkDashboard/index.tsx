import { DEFAULT_CHAIN_ID } from "@green-goods/shared/config/blockchain";
import { jobToWork, queryKeys, useUser, useWorkApprovals } from "@green-goods/shared/hooks";
import {
  getWorkApprovals as fetchWorkApprovals,
  getGardens,
  getWorks,
  getWorksByGardener,
  jobQueueEventBus,
} from "@green-goods/shared/modules";
import { jobQueue, jobQueueDB } from "@green-goods/shared/modules/job-queue";
import { cn } from "@green-goods/shared/utils";
import {
  RiCheckboxCircleLine,
  RiCheckLine,
  RiCloseLine,
  RiTimeLine,
  RiUploadLine,
} from "@remixicon/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useEffect, useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router-dom";
import { type StandardTab, StandardTabs } from "@/components/UI/Tabs";
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
  const { smartAccountAddress } = useUser();

  // Use the new hook for work approvals
  const { completedApprovals, isLoading, hasError, errorMessage } = useWorkApprovals(
    smartAccountAddress || undefined
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

      // Get uploading job IDs to exclude from pending
      const uploadingJobs = await jobQueue.getJobs({ kind: "work", synced: false });
      const uploadingWorkIds = new Set(
        uploadingJobs.map((j) => {
          // Convert job ID to offline transaction hash format
          const paddedId = j.id.replace(/-/g, "").substring(0, 56).padStart(56, "0");
          return `0xoffline_${paddedId}`;
        })
      );

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

      // Deduplicate by id, prefer online entries, exclude uploading items
      const byId = new Map<string, Work>();
      for (const w of optimistic) {
        if (!uploadingWorkIds.has(w.id)) {
          byId.set(w.id, w);
        }
      }
      for (const w of online) {
        if (!uploadingWorkIds.has(w.id)) {
          byId.set(w.id, w);
        }
      }
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

  // Fetch user's own works (online + offline merged with deduplication)
  const { data: myWorks = [] } = useQuery({
    queryKey: ["myWorks", smartAccountAddress, DEFAULT_CHAIN_ID],
    queryFn: async () => {
      if (!smartAccountAddress) return [];

      console.log("[MyWork] Fetching works for gardener:", smartAccountAddress);

      // Get online works by this user
      const onlineWorks = await getWorksByGardener(smartAccountAddress);
      console.log("[MyWork] Online works fetched:", {
        count: onlineWorks.length,
        works: onlineWorks.map((w) => ({
          id: w.id,
          title: w.title,
          metadata: w.metadata?.substring(0, 100),
        })),
      });

      // Get offline jobs by this user
      const offlineJobs = await jobQueue.getJobs({ kind: "work", synced: false });
      console.log("[MyWork] Offline jobs fetched:", {
        count: offlineJobs.length,
        jobs: offlineJobs.map((j) => ({
          id: j.id,
          clientWorkId: j.meta?.clientWorkId,
        })),
      });

      // Convert offline jobs to Work format
      const offlineWorks = await Promise.all(
        offlineJobs.map(async (job) => {
          const work = jobToWork(job);
          const images = await jobQueueDB.getImagesForJob(job.id);

          console.log("[MyWork] Loading images for job:", {
            jobId: job.id,
            imagesCount: images.length,
            imageData: images.map((img) => ({
              id: img.id,
              hasFile: !!img.file,
              fileSize: img.file?.size,
              url: img.url?.substring(0, 60) + "...",
              urlIsBlob: img.url?.startsWith("blob:"),
            })),
          });

          work.media = images.map((img: any) => img.url);
          work.gardenerAddress = smartAccountAddress;

          console.log("[MyWork] Work object after media assignment:", {
            workId: work.id,
            mediaCount: work.media.length,
            mediaUrls: work.media.map((url) => url?.substring(0, 60) + "..."),
          });

          return work;
        })
      );

      // Build set of clientWorkIds from online works for deduplication
      const onlineClientWorkIds = new Set(
        onlineWorks
          .map((w) => {
            try {
              const meta = JSON.parse(w.metadata || "{}");
              return meta.clientWorkId;
            } catch {
              return null;
            }
          })
          .filter(Boolean)
      );

      console.log("[MyWork] Online clientWorkIds:", Array.from(onlineClientWorkIds));

      // Filter out offline works that have been uploaded (matching clientWorkId)
      const dedupedOffline = offlineWorks.filter((work) => {
        const jobMeta = offlineJobs.find((j) => j.id === work.id)?.meta;
        const clientWorkId = jobMeta?.clientWorkId;
        const isDuplicate = clientWorkId && onlineClientWorkIds.has(clientWorkId);

        console.log("[MyWork] Checking offline work:", {
          workId: work.id,
          clientWorkId,
          isDuplicate,
        });

        return !isDuplicate;
      });

      console.log("[MyWork] After deduplication:", {
        onlineCount: onlineWorks.length,
        offlineCount: dedupedOffline.length,
      });

      // Merge and sort by creation time
      const merged = [...onlineWorks, ...dedupedOffline]
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 50); // Show last 50 items

      console.log("[MyWork] Final merged works:", {
        count: merged.length,
        works: merged.map((w) => ({
          id: w.id,
          title: w.title,
          isOffline: w.id.startsWith("0xoffline_"),
        })),
      });

      return merged;
    },
    enabled: !!smartAccountAddress,
    staleTime: 10_000,
  });

  // Cleanup offline works when matching online work appears
  useEffect(() => {
    if (!myWorks || myWorks.length === 0) return;

    const cleanupOfflineWorks = async () => {
      // Get all offline jobs
      const offlineJobs = await jobQueue.getJobs({ kind: "work", synced: false });

      // Get online work client IDs from metadata
      const onlineClientIds = new Set(
        myWorks
          .filter((w) => w.id.startsWith("0x") && !w.id.startsWith("0xoffline_"))
          .map((w) => {
            try {
              const meta = JSON.parse(w.metadata || "{}");
              return meta.clientWorkId;
            } catch {
              return null;
            }
          })
          .filter(Boolean)
      );

      console.log("[MyWork] Cleanup check:", {
        offlineJobsCount: offlineJobs.length,
        onlineClientIdsCount: onlineClientIds.size,
        onlineClientIds: Array.from(onlineClientIds),
      });

      // Delete offline jobs that have matching online work (by clientWorkId)
      for (const job of offlineJobs) {
        const clientWorkId = job.meta?.clientWorkId;
        if (clientWorkId && onlineClientIds.has(clientWorkId)) {
          console.log("[MyWork] Removing offline job with matching online work:", {
            jobId: job.id,
            clientWorkId,
          });
          await jobQueueDB.deleteJob(job.id);
        }
      }
    };

    void cleanupOfflineWorks();
  }, [myWorks]);

  // Fetch recent online work by this gardener (time-filtered)
  const { data: recentOnlineWork = [], isLoading: isLoadingRecentOnline } = useQuery({
    queryKey: ["recentOnlineWork", smartAccountAddress, timeFilter, DEFAULT_CHAIN_ID],
    queryFn: async () => {
      if (!smartAccountAddress) return [];

      console.log("[WorkDashboard] Fetching recent online work for:", smartAccountAddress);

      // Fetch all work by this gardener
      const allWork = await getWorksByGardener(smartAccountAddress, DEFAULT_CHAIN_ID);

      // Calculate time cutoff based on filter
      const now = Date.now();
      let cutoffTime: number;
      switch (timeFilter) {
        case "day":
          cutoffTime = now - 24 * 60 * 60 * 1000;
          break;
        case "week":
          cutoffTime = now - 7 * 24 * 60 * 60 * 1000;
          break;
        case "month":
          cutoffTime = now - 30 * 24 * 60 * 60 * 1000;
          break;
        case "year":
          cutoffTime = now - 365 * 24 * 60 * 60 * 1000;
          break;
        default:
          cutoffTime = now - 30 * 24 * 60 * 60 * 1000;
      }

      // Filter by time and sort newest first
      const recentWork = allWork
        .filter((w) => {
          const workTime = w.createdAt < 1e12 ? w.createdAt * 1000 : w.createdAt;
          return workTime >= cutoffTime;
        })
        .sort((a, b) => b.createdAt - a.createdAt);

      console.log("[WorkDashboard] Recent online work filtered:", {
        total: allWork.length,
        recent: recentWork.length,
        timeFilter,
        cutoffTime: new Date(cutoffTime).toISOString(),
      });

      return recentWork;
    },
    enabled: !!smartAccountAddress,
    staleTime: 10_000,
  });

  // Uploading work (offline queue jobs only)
  const { data: offlineQueueWork = [], isLoading: isLoadingOfflineQueue } = useQuery({
    queryKey: queryKeys.queue.uploading(),
    queryFn: async () => {
      console.log("[WorkDashboard] Fetching offline queue jobs...");
      const jobs = await jobQueue.getJobs({ kind: "work", synced: false });
      console.log("[WorkDashboard] Retrieved jobs from queue:", {
        count: jobs.length,
        jobs: jobs.map((j) => ({
          id: j.id,
          synced: j.synced,
          attempts: j.attempts,
          lastError: j.lastError,
          createdAt: j.createdAt,
        })),
      });

      const works = await Promise.all(
        jobs.map(async (job: any) => {
          const work = jobToWork(job);
          const images = await jobQueueDB.getImagesForJob(job.id);
          work.media = images.map((img: any) => img.url);
          if (smartAccountAddress) {
            work.gardenerAddress = smartAccountAddress;
          }

          console.log("[WorkDashboard] Converted job to work:", {
            jobId: job.id,
            workId: work.id,
            status: work.status,
            mediaCount: work.media.length,
            lastError: job.lastError,
          });

          return work;
        })
      );

      // Newest first
      const sorted = works.sort((a, b) => b.createdAt - a.createdAt);
      console.log("[WorkDashboard] Final offline queue array:", {
        count: sorted.length,
        works: sorted.map((w) => ({ id: w.id, status: w.status, title: w.title })),
      });

      return sorted;
    },
    staleTime: 5000,
  });

  // Combine offline queue + recent online work for "Recent Work" tab
  const recentWorkCombined = useMemo(() => {
    // For now, use simple deduplication (will be enhanced with async lookup)
    // Offline work always comes first, then recent online work
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

  // For backwards compatibility, keep uploadingWork as alias
  const uploadingWork = recentWorkCombined;
  const isLoadingUploading = isLoadingOfflineQueue || isLoadingRecentOnline;

  // Invalidate uploading jobs on queue events
  useEffect(() => {
    const unsub = jobQueueEventBus.onMultiple(
      ["job:added", "job:completed", "job:failed", "queue:sync-completed"],
      (event) => {
        console.log("[WorkDashboard] Received job queue event:", event);
        console.log("[WorkDashboard] Invalidating uploading query...");
        queryClient.invalidateQueries({ queryKey: queryKeys.queue.uploading() });
        // Also invalidate stats for badge counts
        queryClient.invalidateQueries({ queryKey: queryKeys.queue.stats() });
        // Invalidate myWorks to update My Work tab
        queryClient.invalidateQueries({
          queryKey: ["myWorks", smartAccountAddress, DEFAULT_CHAIN_ID],
        });
      }
    );
    return () => unsub();
  }, [queryClient, smartAccountAddress]);

  // Log when uploadingWork changes
  useEffect(() => {
    console.log("[WorkDashboard] uploadingWork state changed:", {
      count: uploadingWork.length,
      isLoading: isLoadingUploading,
      works: uploadingWork.map((w) => ({ id: w.id, title: w.title, status: w.status })),
    });
  }, [uploadingWork, isLoadingUploading]);

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

  // Pending work needing your review (from gardens you operate, excluding your own submissions)
  const pendingNeedsReview: any[] = (operatorWorks || []).filter(
    (w: any) =>
      !reviewedByYou.has(w.id) &&
      w.gardenerAddress?.toLowerCase() !== smartAccountAddress?.toLowerCase()
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

  // Tabs without counts (counts shown in tab content instead)
  const tabs: StandardTab[] = [
    {
      id: "recent",
      label: intl.formatMessage({
        id: "app.workDashboard.tabs.recent",
        defaultMessage: "Recent Work",
      }),
      icon: <RiUploadLine className="w-4 h-4" />,
    },
    {
      id: "pending",
      label: intl.formatMessage({
        id: "app.workDashboard.tabs.pending",
        defaultMessage: "Pending",
      }),
      icon: <RiTimeLine className="w-4 h-4" />,
    },
    {
      id: "completed",
      label: intl.formatMessage({
        id: "app.workDashboard.tabs.completed",
        defaultMessage: "Completed",
      }),
      icon: <RiCheckboxCircleLine className="w-4 h-4" />,
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
          onTabChange={(tabId: string) => setActiveTab(tabId as "recent" | "pending" | "completed")}
          isLoading={isLoading}
        />

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-hidden">{renderTabContent()}</div>
      </div>
    </div>
  );
};
