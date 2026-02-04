/**
 * Sync Indicator Component
 *
 * Visual indicator for background sync status showing:
 * - Pending job count
 * - Sync in progress animation
 * - Online/offline status
 * - Manual sync trigger
 *
 * @module components/Progress/SyncIndicator
 */

import React, { useEffect, useState } from "react";
import type { QueueStats } from "../../types/job-queue";

/**
 * Sync status derived from queue stats and connection
 */
export type SyncStatus = "synced" | "pending" | "syncing" | "offline" | "error";

interface SyncIndicatorProps {
  /** Queue statistics from useJobQueue */
  stats: QueueStats;
  /** Whether sync is currently in progress */
  isProcessing: boolean;
  /** Trigger manual sync */
  onSync?: () => void;
  /** Whether the device is online */
  isOnline?: boolean;
  /** Compact mode (icon only) */
  compact?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Status configuration for visual display
 */
interface StatusConfig {
  icon: string;
  label: string;
  color: string;
  bgColor: string;
  animate?: boolean;
}

const STATUS_CONFIG: Record<SyncStatus, StatusConfig> = {
  synced: {
    icon: "✓",
    label: "Synced",
    color: "text-green-600 dark:text-green-400",
    bgColor: "bg-green-100 dark:bg-green-900/30",
  },
  pending: {
    icon: "↑",
    label: "Pending",
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-100 dark:bg-amber-900/30",
  },
  syncing: {
    icon: "⟳",
    label: "Syncing",
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
    animate: true,
  },
  offline: {
    icon: "○",
    label: "Offline",
    color: "text-gray-500 dark:text-gray-400",
    bgColor: "bg-gray-100 dark:bg-gray-800",
  },
  error: {
    icon: "!",
    label: "Error",
    color: "text-red-600 dark:text-red-400",
    bgColor: "bg-red-100 dark:bg-red-900/30",
  },
};

/**
 * Derive sync status from props
 */
function deriveSyncStatus(stats: QueueStats, isProcessing: boolean, isOnline: boolean): SyncStatus {
  if (!isOnline) return "offline";
  if (isProcessing) return "syncing";
  if (stats.failed > 0) return "error";
  if (stats.pending > 0) return "pending";
  return "synced";
}

/**
 * Compact sync indicator (icon badge only)
 */
function CompactIndicator({
  status,
  pendingCount,
  onClick,
  className,
}: {
  status: SyncStatus;
  pendingCount: number;
  onClick?: () => void;
  className?: string;
}) {
  const config = STATUS_CONFIG[status];
  const showBadge = pendingCount > 0 || status === "error";

  return (
    <button
      onClick={onClick}
      disabled={status === "syncing" || status === "offline"}
      className={`
        relative p-2 rounded-full transition-all
        ${config.bgColor}
        ${onClick && status !== "syncing" && status !== "offline" ? "hover:opacity-80 cursor-pointer" : "cursor-default"}
        ${className || ""}
      `}
      title={`${config.label}${pendingCount > 0 ? ` (${pendingCount} pending)` : ""}`}
    >
      <span
        className={`
          text-lg ${config.color}
          ${config.animate ? "animate-spin" : ""}
        `}
      >
        {config.icon}
      </span>

      {/* Badge for pending count */}
      {showBadge && (
        <span
          className={`
            absolute -top-1 -right-1 min-w-[18px] h-[18px]
            flex items-center justify-center
            text-[10px] font-bold text-white
            rounded-full
            ${status === "error" ? "bg-red-500" : "bg-amber-500"}
          `}
        >
          {status === "error" ? "!" : pendingCount}
        </span>
      )}
    </button>
  );
}

/**
 * Full sync indicator with label and details
 */
function FullIndicator({
  status,
  stats,
  onClick,
  className,
}: {
  status: SyncStatus;
  stats: QueueStats;
  onClick?: () => void;
  className?: string;
}) {
  const config = STATUS_CONFIG[status];

  return (
    <div
      className={`
        flex items-center gap-3 px-3 py-2 rounded-lg
        ${config.bgColor}
        ${className || ""}
      `}
    >
      {/* Icon */}
      <span
        className={`
          text-lg ${config.color}
          ${config.animate ? "animate-spin" : ""}
        `}
      >
        {config.icon}
      </span>

      {/* Status text */}
      <div className="flex-1 min-w-0">
        <div className={`text-sm font-medium ${config.color}`}>{config.label}</div>
        {stats.pending > 0 && (
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {stats.pending} item{stats.pending !== 1 ? "s" : ""} waiting to sync
          </div>
        )}
        {stats.failed > 0 && (
          <div className="text-xs text-red-500 dark:text-red-400">
            {stats.failed} failed - tap to retry
          </div>
        )}
      </div>

      {/* Sync button */}
      {onClick && status !== "syncing" && status !== "offline" && stats.pending > 0 && (
        <button
          onClick={onClick}
          className="
            px-3 py-1 text-xs font-medium
            bg-white dark:bg-gray-700
            text-gray-700 dark:text-gray-200
            rounded-full shadow-sm
            hover:bg-gray-50 dark:hover:bg-gray-600
            transition-colors
          "
        >
          Sync now
        </button>
      )}
    </div>
  );
}

/**
 * Background Sync Status Indicator
 *
 * Shows the current sync status of the offline job queue.
 * Displays pending count, sync progress, and allows manual sync trigger.
 *
 * @example
 * ```tsx
 * function AppHeader() {
 *   const { stats, isProcessing, flush } = useJobQueue();
 *
 *   return (
 *     <header>
 *       <SyncIndicator
 *         stats={stats}
 *         isProcessing={isProcessing}
 *         onSync={flush}
 *       />
 *     </header>
 *   );
 * }
 * ```
 */
export function SyncIndicator({
  stats,
  isProcessing,
  onSync,
  isOnline: isOnlineProp,
  compact = false,
  className,
}: SyncIndicatorProps) {
  // Use navigator.onLine if not provided
  const [isOnline, setIsOnline] = useState(
    isOnlineProp ?? (typeof navigator !== "undefined" ? navigator.onLine : true)
  );

  // Listen for online/offline changes
  useEffect(() => {
    if (isOnlineProp !== undefined) {
      setIsOnline(isOnlineProp);
      return;
    }

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [isOnlineProp]);

  const status = deriveSyncStatus(stats, isProcessing, isOnline);

  // Don't show anything if synced and no pending
  if (status === "synced" && stats.total === 0) {
    return null;
  }

  if (compact) {
    return (
      <CompactIndicator
        status={status}
        pendingCount={stats.pending}
        onClick={onSync}
        className={className}
      />
    );
  }

  return <FullIndicator status={status} stats={stats} onClick={onSync} className={className} />;
}
