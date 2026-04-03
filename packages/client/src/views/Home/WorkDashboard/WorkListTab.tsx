import type { Work } from "@green-goods/shared";
import React from "react";
import { useIntl } from "react-intl";
import { MinimalWorkCard } from "@/components/Cards";
import { Loader } from "@/components/Communication";

interface WorkListMessages {
  itemCount: { id: string; defaultMessage: string };
  loading: { id: string; defaultMessage: string };
  emptyTitle: { id: string; defaultMessage: string };
  emptyDescription: { id: string; defaultMessage: string };
}

interface WorkListTabProps {
  items: Work[];
  isLoading: boolean;
  isFetching?: boolean;
  hasError: boolean;
  errorMessage?: string;
  onWorkClick: (work: Work) => void;
  onRefresh?: () => void;
  renderBadges?: (work: Work) => React.ReactNode[];
  headerContent?: React.ReactNode;
  messages: WorkListMessages;
  emptyIcon: string;
}

export const WorkListTab: React.FC<WorkListTabProps> = ({
  items,
  isLoading,
  isFetching,
  hasError,
  errorMessage,
  onWorkClick,
  onRefresh,
  renderBadges,
  headerContent,
  messages,
  emptyIcon,
}) => {
  const intl = useIntl();

  return (
    <div className="h-full flex flex-col">
      <div className="mb-4 px-4 pt-4 flex items-center justify-between gap-3">
        <div>
          {isLoading ? null : hasError ? (
            <p className="text-sm text-error-base">
              {intl.formatMessage({
                id: "app.workDashboard.error.fetchingData",
                defaultMessage: "Error loading data. Please try again.",
              })}
            </p>
          ) : items.length > 0 ? (
            <p className="text-sm text-text-sub-600">
              {intl.formatMessage(messages.itemCount, { count: items.length })}
            </p>
          ) : null}
        </div>
        {headerContent}
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 pb-4">
        {isLoading ? (
          <div className="h-full flex flex-col items-center justify-center pb-12">
            <Loader />
            <p className="text-sm text-text-soft-400 mt-4">
              {intl.formatMessage(messages.loading)}
            </p>
          </div>
        ) : hasError ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">⚠️</div>
            <p className="font-medium text-text-strong-950">
              {intl.formatMessage({
                id: "app.workDashboard.error.title",
                defaultMessage: "Unable to load work",
              })}
            </p>
            <p className="text-sm text-text-sub-600 mb-4">
              {errorMessage ||
                intl.formatMessage({
                  id: "app.workDashboard.error.description",
                  defaultMessage:
                    "There was an error loading your work. Please check your connection and try again.",
                })}
            </p>
            {onRefresh && (
              <button
                onClick={onRefresh}
                disabled={isFetching}
                className="text-sm text-primary font-medium px-3 py-1 rounded-lg border border-stroke-soft-200 disabled:opacity-50"
              >
                {isFetching
                  ? intl.formatMessage({
                      id: "app.common.refreshing",
                      defaultMessage: "Refreshing...",
                    })
                  : intl.formatMessage({
                      id: "app.workDashboard.error.retry",
                      defaultMessage: "Retry",
                    })}
              </button>
            )}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">{emptyIcon}</div>
            <p className="font-medium text-text-strong-950">
              {intl.formatMessage(messages.emptyTitle)}
            </p>
            <p className="text-sm text-text-sub-600 mb-3">
              {intl.formatMessage(messages.emptyDescription)}
            </p>
            {onRefresh && (
              <button
                onClick={onRefresh}
                disabled={isFetching}
                className="text-xs text-text-sub font-medium px-2 py-1 rounded border border-stroke-soft hover:bg-bg-soft disabled:opacity-50"
              >
                {isFetching
                  ? intl.formatMessage({
                      id: "app.common.refreshing",
                      defaultMessage: "Refreshing...",
                    })
                  : intl.formatMessage({
                      id: "app.common.refresh",
                      defaultMessage: "Refresh",
                    })}
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((work, index) => (
              <MinimalWorkCard
                key={work.id}
                work={work}
                onClick={() => onWorkClick(work)}
                badges={renderBadges?.(work)}
                className="stagger-item cv-work-card"
                style={{ animationDelay: `${index * 30}ms` } as React.CSSProperties}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
