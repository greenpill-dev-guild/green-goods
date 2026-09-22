import { NativeSelect } from "@green-goods/shared/components/Form/ControlPrimitives";
import type { WorkDashboardCompletedFilter } from "@green-goods/shared/stores/useUIStore";
import type { Work } from "@green-goods/shared/types/domain";
import type { TimeFilter } from "@green-goods/shared/utils/time";
import { RiCheckLine } from "@remixicon/react";
import React from "react";
import { useIntl } from "react-intl";
import type { WorkCardPresentation } from "@/components/Cards/Work/WorkCard";
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
  completedFilter: WorkDashboardCompletedFilter;
  onCompletedFilterChange: (value: WorkDashboardCompletedFilter) => void;
  /** Works this account reviewed; every other completed work is its own submission. */
  reviewedByYou: ReadonlySet<string>;
  timeFilter: TimeFilter;
  onTimeFilterChange: (value: TimeFilter) => void;
  isOffline?: boolean;
  savedAt?: number;
}

const COMPLETED_MESSAGES = {
  itemCount: {
    id: "app.workDashboard.completed.itemsCompleted",
    defaultMessage: "{count, plural, one {# item} other {# items}}",
  },
  loading: { id: "app.workDashboard.loading", defaultMessage: "Loading your work..." },
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
  reviewedByYou,
  timeFilter,
  onTimeFilterChange,
  isOffline,
  savedAt,
}) => {
  const intl = useIntl();

  const renderPresentation = (work: Work): WorkCardPresentation => ({
    // Under All the list mixes both kinds, so each card says which one it is.
    contextLabel: reviewedByYou.has(work.id)
      ? intl.formatMessage({
          id: "app.workDashboard.badge.reviewedByYou",
          defaultMessage: "Reviewed by you",
        })
      : intl.formatMessage({
          id: "app.workDashboard.badge.yourWorkReviewed",
          defaultMessage: "Your work was reviewed",
        }),
    supportingText: work.feedback?.trim()
      ? intl.formatMessage({ id: "app.workCard.feedback", defaultMessage: "Feedback" })
      : intl.formatMessage({
          id: "app.workCard.reviewRecorded",
          defaultMessage: "Review added to the garden record",
        }),
  });

  return (
    <WorkListTab
      items={items}
      isLoading={isLoading}
      isFetching={isFetching}
      hasError={hasError}
      errorMessage={errorMessage}
      onWorkClick={onWorkClick}
      onRefresh={onRefresh}
      isOffline={isOffline}
      savedAt={savedAt}
      renderPresentation={renderPresentation}
      messages={COMPLETED_MESSAGES}
      emptyIcon={<RiCheckLine />}
      headerContent={
        <div className="flex min-w-0 items-center justify-end gap-2">
          <NativeSelect
            aria-label={intl.formatMessage({
              id: "app.workDashboard.completedFilter.label",
              defaultMessage: "Completed work filter",
            })}
            controlSize="sm"
            density="condensed"
            className="w-auto min-w-16 max-w-48 field-sizing-content"
            value={completedFilter}
            onChange={(e) =>
              onCompletedFilterChange(e.target.value as WorkDashboardCompletedFilter)
            }
          >
            <option value="all">
              {intl.formatMessage({
                id: "app.workDashboard.filter.all",
                defaultMessage: "All",
              })}
            </option>
            <option value="reviewedByYou">
              {intl.formatMessage({
                id: "app.workDashboard.filter.reviewedByYou",
                defaultMessage: "You reviewed",
              })}
            </option>
            <option value="myWorkReviewed">
              {intl.formatMessage({
                id: "app.workDashboard.filter.myWorkReviewed",
                defaultMessage: "My work",
              })}
            </option>
          </NativeSelect>
          <TimeFilterControl value={timeFilter} onChange={onTimeFilterChange} />
        </div>
      }
    />
  );
};
