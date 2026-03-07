import { type Address, filterByTimeRange, type TimeFilter, type Work } from "@green-goods/shared";
import { RiCheckLine, RiDraftLine, RiTaskLine, RiTimeLine } from "@remixicon/react";
import React, { useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { type StandardTab, StandardTabs } from "@/components/Navigation";
import { CompletedTab } from "./Completed";
import { DraftsTab } from "./Drafts";
import { PendingTab } from "./Pending";
import { TimeFilterControl } from "./TimeFilterControl";
import { UploadingTab } from "./Uploading";
import { renderApprovalBadges, renderMyWorkReviewedBadges } from "./WorkBadges";

interface DashboardTabsProps {
  draftCount: number;
  timeFilter: TimeFilter;
  onTimeFilterChange: (value: TimeFilter) => void;
  uploadingWork: Work[];
  pendingNeedsReview: Work[];
  pendingMySubmissions: Work[];
  completedReviewedByYou: Work[];
  completedMyWorkReviewed: Work[];
  isLoadingUploading: boolean;
  isLoadingPending: boolean;
  isLoadingCompleted: boolean;
  isLoadingApprovals: boolean;
  isFetchingRecent: boolean;
  isFetchingPending: boolean;
  isFetchingCompleted: boolean;
  hasRecentError: boolean;
  hasPendingError: boolean;
  hasCompletedError: boolean;
  errorMessage?: string;
  onWorkClick: (work: Work | { workUID?: string; gardenAddress?: Address }) => void;
  onRefreshRecent: () => void;
  onRefreshPending: () => void;
  onRefreshCompleted: () => void;
  renderWorkBadges: (work: Work) => React.ReactNode[];
}

export const DashboardTabs: React.FC<DashboardTabsProps> = ({
  draftCount,
  timeFilter,
  onTimeFilterChange,
  uploadingWork,
  pendingNeedsReview,
  pendingMySubmissions,
  completedReviewedByYou,
  completedMyWorkReviewed,
  isLoadingUploading,
  isLoadingPending,
  isLoadingCompleted,
  isLoadingApprovals,
  isFetchingRecent,
  isFetchingPending,
  isFetchingCompleted,
  hasRecentError,
  hasPendingError,
  hasCompletedError,
  errorMessage,
  onWorkClick,
  onRefreshRecent,
  onRefreshPending,
  onRefreshCompleted,
  renderWorkBadges,
}) => {
  const intl = useIntl();
  const [activeTab, setActiveTab] = useState<"drafts" | "recent" | "pending" | "completed">(
    "recent"
  );
  const [pendingFilter, setPendingFilter] = useState<"all" | "needsReview" | "mySubmissions">(
    "all"
  );
  const [completedFilter, setCompletedFilter] = useState<"reviewedByYou" | "myWorkReviewed">(
    "reviewedByYou"
  );

  const combinedPending = useMemo(() => {
    const map = new Map<string, Work>();
    for (const w of pendingNeedsReview) map.set(w.id, w);
    for (const w of pendingMySubmissions) map.set(w.id, w);
    return Array.from(map.values()).sort((a, b) => b.createdAt - a.createdAt);
  }, [pendingNeedsReview, pendingMySubmissions]);

  let pendingWork: Work[];
  if (pendingFilter === "needsReview") {
    pendingWork = pendingNeedsReview;
  } else if (pendingFilter === "mySubmissions") {
    pendingWork = pendingMySubmissions;
  } else {
    pendingWork = combinedPending;
  }

  const completedWork =
    completedFilter === "reviewedByYou" ? completedReviewedByYou : completedMyWorkReviewed;

  const filteredUploading = filterByTimeRange(uploadingWork, timeFilter);
  const filteredPending = filterByTimeRange(pendingWork, timeFilter);
  const filteredCompleted = filterByTimeRange(completedWork, timeFilter);

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

  const renderTabContent = () => {
    switch (activeTab) {
      case "drafts":
        return <DraftsTab />;
      case "recent":
        return (
          <UploadingTab
            uploadingWork={filteredUploading}
            isLoading={isLoadingApprovals || isLoadingUploading}
            isFetching={isFetchingRecent}
            hasError={hasRecentError}
            onWorkClick={onWorkClick}
            onRefresh={onRefreshRecent}
            headerContent={<TimeFilterControl value={timeFilter} onChange={onTimeFilterChange} />}
          />
        );
      case "pending":
        return (
          <PendingTab
            pendingWork={filteredPending}
            isLoading={isLoadingApprovals || isLoadingPending}
            isFetching={isFetchingPending}
            hasError={hasPendingError}
            errorMessage={errorMessage}
            onWorkClick={onWorkClick}
            onRefresh={onRefreshPending}
            renderBadges={renderWorkBadges}
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
                <TimeFilterControl value={timeFilter} onChange={onTimeFilterChange} />
              </div>
            }
          />
        );
      case "completed":
        return (
          <CompletedTab
            completedWork={filteredCompleted}
            isLoading={
              isLoadingApprovals || (completedFilter === "myWorkReviewed" && isLoadingCompleted)
            }
            isFetching={isFetchingCompleted}
            hasError={hasCompletedError}
            errorMessage={errorMessage}
            onWorkClick={onWorkClick}
            onRefresh={onRefreshCompleted}
            renderBadges={
              completedFilter === "reviewedByYou"
                ? renderApprovalBadges
                : renderMyWorkReviewedBadges
            }
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
                <TimeFilterControl value={timeFilter} onChange={onTimeFilterChange} />
              </div>
            }
          />
        );
      default:
        return (
          <UploadingTab
            uploadingWork={filteredUploading}
            isLoading={isLoadingApprovals || isLoadingUploading}
            isFetching={isFetchingRecent}
            hasError={hasRecentError}
            onWorkClick={onWorkClick}
            onRefresh={onRefreshRecent}
            headerContent={<TimeFilterControl value={timeFilter} onChange={onTimeFilterChange} />}
          />
        );
    }
  };

  return (
    <>
      <StandardTabs
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={(tabId: string) =>
          setActiveTab(tabId as "drafts" | "recent" | "pending" | "completed")
        }
        triggerClassName="text-xs"
      />

      <div className="flex-1 min-h-0 overflow-hidden overscroll-contain">{renderTabContent()}</div>
    </>
  );
};
