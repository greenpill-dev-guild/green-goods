import React from "react";
import { useIntl } from "react-intl";
import { MinimalWorkCard } from "../Card/WorkCard";
import { BeatLoader } from "../Loader";

interface PendingTabProps {
  pendingWork: any[];
  isLoading: boolean;
  hasError: boolean;
  errorMessage?: string;
  onWorkClick: (work: any) => void;
}

export const PendingTab: React.FC<PendingTabProps> = ({
  pendingWork,
  isLoading,
  hasError,
  errorMessage,
  onWorkClick,
}) => {
  const intl = useIntl();

  return (
    <div className="h-full flex flex-col">
      <div className="mb-4 px-4 pt-4">
        {isLoading ? (
          <BeatLoader />
        ) : hasError ? (
          <p className="text-sm text-red-600">
            {intl.formatMessage({
              id: "app.workDashboard.error.fetchingData",
              defaultMessage: "Error loading data. Please try again.",
            })}
          </p>
        ) : (
          <p className="text-sm text-slate-600">
            {pendingWork.length > 0
              ? intl.formatMessage(
                  {
                    id: "app.workDashboard.pending.itemsPending",
                    defaultMessage: "{count} items pending review",
                  },
                  { count: pendingWork.length }
                )
              : intl.formatMessage({
                  id: "app.workDashboard.pending.noPending",
                  defaultMessage: "No pending work",
                })}
          </p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {hasError ? (
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
        ) : !isLoading && pendingWork.length === 0 ? (
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
            {pendingWork.map((work) => (
              <MinimalWorkCard key={work.id} work={work} onClick={() => onWorkClick(work)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
