import {
  hapticLight,
  logger,
  trackSyncError,
  useBatchWorkSync,
  useOffline,
  useQueueFlush,
  useTimeout,
  useUser,
  type Work,
} from "@green-goods/shared";
import React, { useEffect, useRef, useState } from "react";
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
  const batchWorkSync = useBatchWorkSync();
  const [isFlushing, setIsFlushing] = useState(false);
  const { set: scheduleConfirmClear } = useTimeout();

  // Only offline (unsynced) work is actively "uploading".
  const uploadingOfflineWork = uploadingWork.filter((work) => work.id.startsWith("0xoffline_"));
  const uploadingCount = uploadingOfflineWork.length;
  const [confirmedIds, setConfirmedIds] = useState<Set<string>>(new Set());
  const previousOfflineRef = useRef<Work[]>(uploadingOfflineWork);

  useEffect(() => {
    const previousOffline = previousOfflineRef.current;
    const currentOffline = uploadingWork.filter((work) => work.id.startsWith("0xoffline_"));
    const currentOnline = uploadingWork.filter((work) => !work.id.startsWith("0xoffline_"));

    const removedOffline = previousOffline.filter(
      (offlineWork) => !currentOffline.some((current) => current.id === offlineWork.id)
    );

    if (removedOffline.length === 0) {
      previousOfflineRef.current = currentOffline;
      return;
    }

    const toMs = (timestamp: number) =>
      timestamp < 1_000_000_000_000 ? timestamp * 1000 : timestamp;
    const CONFIRM_WINDOW_MS = 5 * 60 * 1000;
    const newlyConfirmed = new Set<string>();

    for (const onlineWork of currentOnline) {
      const onlineTs = toMs(onlineWork.createdAt);
      const match = removedOffline.some((offlineWork) => {
        const offlineTs = toMs(offlineWork.createdAt);
        return (
          offlineWork.actionUID === onlineWork.actionUID &&
          Math.abs(offlineTs - onlineTs) <= CONFIRM_WINDOW_MS
        );
      });

      if (match) {
        newlyConfirmed.add(onlineWork.id);
      }
    }

    if (newlyConfirmed.size > 0) {
      setConfirmedIds(newlyConfirmed);
      scheduleConfirmClear(() => {
        setConfirmedIds(new Set());
      }, 200);
    }

    previousOfflineRef.current = currentOffline;
  }, [uploadingWork, scheduleConfirmClear]);

  const isSyncing = isFlushing || batchWorkSync.isPending;

  const handleSyncAll = async () => {
    if (isSyncing) return;
    // Provide haptic feedback when sync is triggered
    hapticLight();
    try {
      if (authMode === "wallet") {
        await batchWorkSync.mutateAsync();
      } else {
        setIsFlushing(true);
        await flush();
      }
    } catch (error) {
      logger.error("Failed to sync all items:", { error });
      trackSyncError(error, {
        source: "Uploading.handleSyncAll",
        userAction: authMode === "wallet" ? "retrying failed uploads" : "syncing all pending items",
        recoverable: true,
        metadata: {
          trigger: authMode === "wallet" ? "retry_button" : "sync_all_button",
          uploading_count: uploadingCount,
          auth_mode: authMode,
          is_online: isOnline,
        },
      });
    } finally {
      setIsFlushing(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="mb-4 px-4 pt-4 flex items-center justify-between gap-3">
        <div>
          {isLoading ? null : uploadingWork.length > 0 ? (
            <p className="text-sm text-text-sub-600">
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
                className="text-sm text-primary font-medium px-3 py-1 rounded-lg border border-stroke-soft-200 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary active:border-primary active:scale-95 tap-feedback disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleSyncAll}
                disabled={isSyncing}
              >
                {isSyncing
                  ? intl.formatMessage({
                      id: "app.workDashboard.queue.syncing",
                      defaultMessage: "Syncing...",
                    })
                  : authMode === "wallet"
                    ? intl.formatMessage(
                        {
                          id: "app.syncBar.syncAll",
                          defaultMessage: "Sync All ({count})",
                        },
                        { count: uploadingCount }
                      )
                    : intl.formatMessage({
                        id: "app.workDashboard.queue.syncAll",
                        defaultMessage: "Sync All",
                      })}
              </button>
            ) : (
              <span className="text-xs text-text-sub-600 px-2">
                {intl.formatMessage({
                  id: "app.workDashboard.offline",
                  defaultMessage: "Reconnect to sync",
                })}
              </span>
            ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden native-scroll px-4 pb-4">
        {isLoading ? (
          <div className="h-full flex flex-col items-center justify-center pb-12">
            <BeatLoader />
            <p className="text-sm text-text-soft-400 mt-4">
              {intl.formatMessage({
                id: "app.workDashboard.loading",
                defaultMessage: "Loading recent work...",
              })}
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
        ) : uploadingWork.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">📋</div>
            <p className="font-medium text-text-strong-950">
              {intl.formatMessage({
                id: "app.workDashboard.uploading.noRecentWork",
                defaultMessage: "No recent work",
              })}
            </p>
            <p className="text-sm text-text-sub-600 mb-3">
              {intl.formatMessage({
                id: "app.workDashboard.uploading.submitWorkHint",
                defaultMessage: "Work you submit will appear here",
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
                  confirmed={confirmedIds.has(work.id)}
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
