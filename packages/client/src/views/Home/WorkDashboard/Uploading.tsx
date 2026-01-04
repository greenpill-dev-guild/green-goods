import type { Work } from "@green-goods/shared";
import { useOffline, useUser } from "@green-goods/shared/hooks";
import { useQueueFlush } from "@green-goods/shared/providers/JobQueue";
import React from "react";
import { useIntl } from "react-intl";
import { MinimalWorkCard } from "@/components/Cards";
import { BeatLoader } from "@/components/Communication";

interface UploadingTabProps {
  uploadingWork: Work[];
  isLoading: boolean;
  isFetching?: boolean;
  hasError?: boolean;
  errorMessage?: string;
  onWorkClick: (work: Work) => void;
  onRefresh?: () => void;
  headerContent?: React.ReactNode;
}

export const UploadingTab: React.FC<UploadingTabProps> = ({
  uploadingWork,
  isLoading,
  isFetching,
  hasError,
  errorMessage,
  onWorkClick,
  onRefresh,
  headerContent,
}) => {
  const intl = useIntl();
  const { authMode } = useUser();
  const { isOnline } = useOffline();
  const flush = useQueueFlush();

  // Only offline (unsynced) work is actively "uploading".
  const uploadingOfflineWork = uploadingWork.filter((work) => work.id.startsWith("0xoffline_"));
  const uploadingCount = uploadingOfflineWork.length;

  const handleSyncAll = async () => {
    try {
      await flush();
    } catch (error) {
      console.error("Failed to sync all items:", error);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="mb-4 px-4 pt-4 flex items-center justify-between gap-3">
        <div>
          {isLoading ? null : uploadingWork.length > 0 ? (
            <p className="text-sm text-slate-600">
              {intl.formatMessage(
                {
                  id: "app.workDashboard.recent.itemsCount",
                  defaultMessage: "{count} recent items",
                },
                { count: uploadingWork.length }
              )}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {headerContent}
          {uploadingCount > 0 &&
            (isOnline ? (
              <button
                className="text-sm text-primary font-medium px-3 py-1 rounded-lg border border-slate-200 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary active:border-primary active:scale-95 tap-feedback"
                onClick={handleSyncAll}
              >
                {authMode === "wallet"
                  ? intl.formatMessage({
                      id: "app.workDashboard.queue.retry",
                      defaultMessage: "Retry",
                    })
                  : intl.formatMessage({
                      id: "app.workDashboard.queue.syncAll",
                      defaultMessage: "Sync All",
                    })}
              </button>
            ) : (
              <span className="text-xs text-slate-500 px-2">
                {intl.formatMessage({
                  id: "app.workDashboard.offline",
                  defaultMessage: "Reconnect to sync",
                })}
              </span>
            ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 pb-4">
        {isLoading ? (
          <div className="h-full flex flex-col items-center justify-center pb-12">
            <BeatLoader />
            <p className="text-sm text-slate-400 mt-4">
              {intl.formatMessage({
                id: "app.workDashboard.loading",
                defaultMessage: "Loading recent work...",
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
            {onRefresh && (
              <button
                onClick={onRefresh}
                disabled={isFetching}
                className="text-sm text-primary font-medium px-3 py-1 rounded-lg border border-slate-200 disabled:opacity-50"
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
        ) : uploadingWork.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">✅</div>
            <p className="font-medium text-slate-900">
              {intl.formatMessage({
                id: "app.workDashboard.uploading.allSynced",
                defaultMessage: "All synced!",
              })}
            </p>
            <p className="text-sm text-slate-600 mb-3">
              {intl.formatMessage({
                id: "app.workDashboard.uploading.noUploading",
                defaultMessage: "No items uploading",
              })}
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
            {uploadingWork.map((work, index) => {
              // Only show "Uploading" badge for offline work (not yet synced to EAS)
              const isOffline = work.id.startsWith("0xoffline_");
              const badges = isOffline
                ? [
                    <span key="uploading" className="badge-pill-blue">
                      <span className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
                      {intl.formatMessage({
                        id: "app.workDashboard.badge.uploading",
                        defaultMessage: "Uploading",
                      })}
                    </span>,
                  ]
                : [];

              return (
                <MinimalWorkCard
                  key={work.id}
                  work={work as unknown as Work}
                  onClick={() => onWorkClick(work)}
                  className="stagger-item"
                  style={{ animationDelay: `${index * 30}ms` } as React.CSSProperties}
                  badges={badges}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
