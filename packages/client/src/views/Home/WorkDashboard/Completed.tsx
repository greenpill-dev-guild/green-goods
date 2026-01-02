import type { Work } from "@green-goods/shared";
import React from "react";
import { useIntl } from "react-intl";
import { MinimalWorkCard } from "@/components/Cards";
import { BeatLoader } from "@/components/Communication";

interface CompletedTabProps {
  completedWork: Work[];
  isLoading: boolean;
  hasError: boolean;
  errorMessage?: string;
  onWorkClick: (work: Work) => void;
  renderBadges?: (work: Work) => React.ReactNode[];
  headerContent?: React.ReactNode;
}

export const CompletedTab: React.FC<CompletedTabProps> = ({
  completedWork,
  isLoading,
  hasError,
  errorMessage,
  onWorkClick,
  renderBadges,
  headerContent,
}) => {
  const intl = useIntl();

  return (
    <div className="h-full flex flex-col">
      <div className="mb-4 px-4 pt-4 flex items-center justify-between gap-3">
        <div>
          {isLoading ? null : hasError ? (
            <p className="text-sm text-red-600">
              {intl.formatMessage({
                id: "app.workDashboard.error.fetchingData",
                defaultMessage: "Error loading data. Please try again.",
              })}
            </p>
          ) : completedWork.length > 0 ? (
            <p className="text-sm text-slate-600">
              {intl.formatMessage(
                {
                  id: "app.workDashboard.completed.itemsCompleted",
                  defaultMessage: "{count} items completed",
                },
                { count: completedWork.length }
              )}
            </p>
          ) : null}
        </div>
        {headerContent}
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 pb-4">
        {isLoading ? (
          <div className="h-full flex flex-col items-center justify-center pb-12">
            <BeatLoader />
            <p className="text-sm text-slate-400 mt-4">
              {intl.formatMessage({
                id: "app.workDashboard.loading",
                defaultMessage: "Loading completed work...",
              })}
            </p>
          </div>
        ) : hasError ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">⚠️</div>
            <p className="font-medium text-slate-900">
              {intl.formatMessage({
                id: "app.workDashboard.error.title",
                defaultMessage: "Unable to load work",
              })}
            </p>
            <p className="text-sm text-slate-600 mb-4">
              {errorMessage ||
                intl.formatMessage({
                  id: "app.workDashboard.error.description",
                  defaultMessage:
                    "There was an error loading your work. Please check your connection and try again.",
                })}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="text-sm text-primary font-medium px-3 py-1 rounded-lg border border-slate-200"
            >
              {intl.formatMessage({
                id: "app.workDashboard.error.retry",
                defaultMessage: "Retry",
              })}
            </button>
          </div>
        ) : completedWork.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">📝</div>
            <p className="font-medium text-slate-900">
              {intl.formatMessage({
                id: "app.workDashboard.completed.noCompleted",
                defaultMessage: "No completed work",
              })}
            </p>
            <p className="text-sm text-slate-600">
              {intl.formatMessage({
                id: "app.workDashboard.completed.description",
                defaultMessage: "Approved and rejected work will appear here",
              })}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {completedWork.map((work, index) => (
              <MinimalWorkCard
                key={work.id}
                work={work}
                onClick={() => onWorkClick(work)}
                badges={renderBadges?.(work)}
                className="stagger-item"
                style={{ animationDelay: `${index * 30}ms` } as React.CSSProperties}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
