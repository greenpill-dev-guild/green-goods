import { useOffline, useUser } from "@green-goods/shared/hooks";
import { useQueueFlush } from "@green-goods/shared/providers/jobQueue";
import React from "react";
import { useIntl } from "react-intl";
import { MinimalWorkCard } from "@/components/UI/Card/WorkCard";

interface UploadingTabProps {
  uploadingWork: Work[];
  isLoading: boolean;
  onWorkClick: (work: any) => void;
  headerContent?: React.ReactNode;
}

export const UploadingTab: React.FC<UploadingTabProps> = ({
  uploadingWork,
  isLoading,
  onWorkClick,
  headerContent,
}) => {
  const intl = useIntl();
  const { authMode } = useUser();
  const { isOnline } = useOffline();
  const flush = useQueueFlush();

  console.log("[UploadingTab] Rendering with:", {
    uploadingWorkCount: uploadingWork.length,
    isLoading,
    isOnline,
    authMode,
    works: uploadingWork.map((w) => ({ id: w.id, title: w.title, status: w.status })),
  });

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
          {isLoading ? null : (
            <p className="text-sm text-slate-600 capitalize">
              {uploadingWork.length > 0
                ? intl.formatMessage(
                    {
                      id: "app.workDashboard.uploading.itemsUploading",
                      defaultMessage: "{count} items uploading",
                    },
                    { count: uploadingWork.length }
                  )
                : null}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {headerContent}
          {uploadingWork.length > 0 &&
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
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex gap-3 p-3 border border-slate-200 rounded-lg bg-white">
                {/* Image skeleton */}
                <div className="w-16 h-16 bg-slate-100 rounded-lg flex-shrink-0 skeleton" />

                {/* Content skeleton */}
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="h-4 w-32 rounded skeleton" />
                    <div className="h-5 w-16 rounded-full skeleton" />
                  </div>
                  <div className="h-3 w-24 rounded skeleton" />
                  <div className="flex items-center gap-2 mt-2">
                    <div className="h-5 w-20 rounded-full skeleton" />
                  </div>
                </div>
              </div>
            ))}
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
            <p className="text-sm text-slate-600">
              {intl.formatMessage({
                id: "app.workDashboard.uploading.noUploading",
                defaultMessage: "No items uploading",
              })}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {uploadingWork.map((work, index) => {
              // Only show "Uploading" badge for offline work (not yet synced to EAS)
              const isOffline = work.id.startsWith("0xoffline_");
              const badges = isOffline
                ? [
                    <span
                      key="uploading"
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border bg-blue-50 text-blue-600 border-blue-100"
                    >
                      <span className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
                      Uploading
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
                  variant="dashboard"
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
