import { NativeSelect } from "@green-goods/shared/components/Form/ControlPrimitives";
import type { Work } from "@green-goods/shared/types/domain";
import { cn } from "@green-goods/shared/utils/styles/cn";
import type { TimeFilter } from "@green-goods/shared/utils/time";
import { RiCheckLine, RiUploadCloud2Line } from "@remixicon/react";
import React from "react";
import { useIntl } from "react-intl";
import { WAITING_TO_UPLOAD_MESSAGE } from "@/components/Cards/Work/queuedWorkCopy";
import { pwaStatusStyles } from "@/components/Pwa/statusStyles";
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
  isOffline?: boolean;
  savedAt?: number;
  /** Works whose decision from this device still waits for Upload all, by lowercase id. */
  waitingUploadIds?: ReadonlySet<string>;
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
  timeFilter,
  onTimeFilterChange,
  isOffline,
  savedAt,
  waitingUploadIds,
}) => {
  const intl = useIntl();

  const renderBadges = (item: Work): React.ReactNode[] => {
    if (completedFilter === "reviewedByYou") {
      const badges = [
        <span key="reviewed" className="badge-pill-emerald">
          <RiCheckLine className="w-3 h-3" />
          {intl.formatMessage({
            id: "app.workDashboard.badge.reviewedByYou",
            defaultMessage: "Reviewed by you",
          })}
        </span>,
      ];
      // A decision made offline shows here at once; until Upload all sends it, it says so.
      if (waitingUploadIds?.has(item.id.toLowerCase()))
        badges.push(
          <span
            key="waiting-upload"
            className={cn(
              "badge-pill",
              pwaStatusStyles.information.surface,
              pwaStatusStyles.information.border,
              pwaStatusStyles.information.text
            )}
          >
            <RiUploadCloud2Line className="w-3 h-3" aria-hidden="true" />
            {intl.formatMessage(WAITING_TO_UPLOAD_MESSAGE)}
          </span>
        );
      return badges;
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
      isOffline={isOffline}
      savedAt={savedAt}
      renderBadges={renderBadges}
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
              onCompletedFilterChange(e.target.value as "reviewedByYou" | "myWorkReviewed")
            }
          >
            <option value="reviewedByYou">
              {intl.formatMessage({
                id: "app.workDashboard.filter.reviewedByYou",
                defaultMessage: "By you",
              })}
            </option>
            <option value="myWorkReviewed">
              {intl.formatMessage({
                id: "app.workDashboard.filter.myWorkReviewed",
                defaultMessage: "Yours",
              })}
            </option>
          </NativeSelect>
          <TimeFilterControl value={timeFilter} onChange={onTimeFilterChange} />
        </div>
      }
    />
  );
};
