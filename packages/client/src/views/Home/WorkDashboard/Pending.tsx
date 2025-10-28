import React from "react";
import { useIntl } from "react-intl";
import { MinimalWorkCard } from "@/components/UI/Card/WorkCard";
import { BeatLoader } from "@/components/UI/Loader";

interface PendingTabProps {
  pendingWork: any[];
  isLoading: boolean;
  hasError: boolean;
  errorMessage?: string;
  onWorkClick: (work: any) => void;
  renderBadges?: (work: any) => React.ReactNode[];
  headerContent?: React.ReactNode;
}

export const PendingTab: React.FC<PendingTabProps> = ({
  pendingWork,
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
          {isLoading ? (
            <BeatLoader />
          ) : hasError ? (
            <p className="text-sm text-red-600">
              {intl.formatMessage({
                id: "app.workDashboard.error.fetchingData",
                defaultMessage: "Error loading data. Please try again.",
              })}
            </p>
          ) : pendingWork.length > 0 ? (
            <p className="text-sm text-slate-600">
              {intl.formatMessage(
                {
                  id: "app.workDashboard.pending.itemsPending",
                  defaultMessage: "{count} items pending review",
                },
                { count: pendingWork.length }
              )}
            </p>
          ) : null}
        </div>
        {headerContent}
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 pb-4">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="p-4 border rounded-xl bg-white animate-pulse">
                <div className="h-4 w-40 bg-slate-200 rounded mb-2" />
                <div className="h-3 w-64 bg-slate-200 rounded" />
              </div>
            ))}
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
        ) : pendingWork.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">⏳</div>
            <p className="font-medium text-slate-900">
              {intl.formatMessage({
                id: "app.workDashboard.pending.noPending",
                defaultMessage: "No pending work",
              })}
            </p>
            <p className="text-sm text-slate-600">
              {intl.formatMessage({
                id: "app.workDashboard.pending.description",
                defaultMessage: "Work awaiting review will appear here",
              })}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {pendingWork.map((work, index) => (
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
