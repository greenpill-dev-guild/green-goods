import type { TimeFilter, Work } from "@green-goods/shared";
import { RiCheckLine } from "@remixicon/react";
import React from "react";
import { useIntl } from "react-intl";
import { TimeFilterControl } from "./TimeFilterControl";
import { WorkListTab } from "./WorkListTab";

interface CompletedTabProps {
  items: Work[];
  isLoading: boolean;
  isFetching: boolean;
  hasError: boolean;
  errorMessage?: string;
  onWorkClick: (work: Work) => void;
  onRefresh: () => void;
  completedFilter: "reviewedByYou" | "myWorkReviewed";
  onCompletedFilterChange: (value: "reviewedByYou" | "myWorkReviewed") => void;
  timeFilter: TimeFilter;
  onTimeFilterChange: (value: TimeFilter) => void;
}

const COMPLETED_MESSAGES = {
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

export const CompletedTab: React.FC<CompletedTabProps> = ({
  items,
  isLoading,
  isFetching,
  hasError,
  errorMessage,
  onWorkClick,
  onRefresh,
  completedFilter,
  onCompletedFilterChange,
  timeFilter,
  onTimeFilterChange,
}) => {
  const intl = useIntl();

  const renderBadges = (): React.ReactNode[] => {
    if (completedFilter === "reviewedByYou") {
      return [
        <span key="reviewed" className="badge-pill-emerald">
          <RiCheckLine className="w-3 h-3" />
          {intl.formatMessage({
            id: "app.workDashboard.badge.reviewedByYou",
            defaultMessage: "Reviewed by you",
          })}
        </span>,
      ];
    }
    return [
      <span key="work-reviewed" className="badge-pill-slate">
        {intl.formatMessage({
          id: "app.workDashboard.badge.yourWorkReviewed",
          defaultMessage: "Your work was reviewed",
        })}
      </span>,
    ];
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
      messages={COMPLETED_MESSAGES}
      emptyIcon="📝"
      headerContent={
        <div className="flex items-center gap-2">
          <select
            className="border border-stroke-soft-200 text-xs rounded-md px-2 py-1 bg-bg-white-0"
            value={completedFilter}
            onChange={(e) =>
              onCompletedFilterChange(e.target.value as "reviewedByYou" | "myWorkReviewed")
            }
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
};
