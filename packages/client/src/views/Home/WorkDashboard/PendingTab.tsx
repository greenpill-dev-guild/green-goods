import type { Address, TimeFilter, Work } from "@green-goods/shared";
import { RiCheckLine, RiTimeLine } from "@remixicon/react";
import React from "react";
import { useIntl } from "react-intl";
import { TimeFilterControl } from "./TimeFilterControl";
import { WorkListTab } from "./WorkListTab";
import { isOperatorForGarden } from "./work-dashboard-utils";

interface PendingTabProps {
  items: Work[];
  isLoading: boolean;
  isFetching: boolean;
  hasError: boolean;
  errorMessage?: string;
  onWorkClick: (work: Work) => void;
  onRefresh: () => void;
  pendingFilter: "all" | "needsReview" | "mySubmissions";
  onPendingFilterChange: (value: "all" | "needsReview" | "mySubmissions") => void;
  timeFilter: TimeFilter;
  onTimeFilterChange: (value: TimeFilter) => void;
  activeAddress: Address | undefined;
  reviewerGardenIds: string[];
  reviewedByYou: Set<string>;
  isUserAddress: (address: Address | undefined) => boolean;
}

const PENDING_MESSAGES = {
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

export const PendingTab: React.FC<PendingTabProps> = ({
  items,
  isLoading,
  isFetching,
  hasError,
  errorMessage,
  onWorkClick,
  onRefresh,
  pendingFilter,
  onPendingFilterChange,
  timeFilter,
  onTimeFilterChange,
  activeAddress,
  reviewerGardenIds,
  reviewedByYou,
  isUserAddress,
}) => {
  const intl = useIntl();

  const renderBadges = (item: Work): React.ReactNode[] => {
    const badges: React.ReactNode[] = [];
    const isGardener = isUserAddress(item.gardenerAddress);
    const isOperator = isOperatorForGarden(activeAddress, reviewerGardenIds, item.gardenAddress);
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

  return (
    <WorkListTab
      items={items}
      isLoading={isLoading}
      isFetching={isFetching}
      hasError={hasError}
      errorMessage={errorMessage}
      onWorkClick={onWorkClick}
      onRefresh={onRefresh}
      renderBadges={renderBadges}
      messages={PENDING_MESSAGES}
      emptyIcon="⏳"
      headerContent={
        <div className="flex items-center gap-2">
          <select
            className="border border-stroke-soft-200 text-xs rounded-md px-2 py-1 bg-bg-white-0"
            value={pendingFilter}
            onChange={(e) =>
              onPendingFilterChange(e.target.value as "all" | "needsReview" | "mySubmissions")
            }
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
};
