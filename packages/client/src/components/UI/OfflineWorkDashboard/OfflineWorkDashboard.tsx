import React, { useEffect, useState } from "react";
import type {
  OfflineWorkDashboardProps,
  OfflineWorkItem,
  RetryableItem,
  StorageAnalytics,
  WorkConflict,
} from "../../../types/offline";
import { cn } from "../../../utils/cn";
import { Card } from "../Card/Card";
import { Badge } from "../Badge/Badge";

interface DashboardTab {
  id: "queue" | "conflicts" | "storage" | "settings";
  label: string;
  icon: string;
  count?: number;
}

export const OfflineWorkDashboard: React.FC<OfflineWorkDashboardProps> = ({
  className,
  onClose,
  onRetryItem,
  onResolveConflict,
  onStorageCleanup,
}) => {
  const [activeTab, setActiveTab] = useState<"queue" | "conflicts" | "storage" | "settings">(
    "queue"
  );
  const [pendingWork, setPendingWork] = useState<OfflineWorkItem[]>([]);
  const [conflicts, setConflicts] = useState<WorkConflict[]>([]);
  const [_retryQueue, _setRetryQueue] = useState<RetryableItem[]>([]);
  const [storageInfo, setStorageInfo] = useState<StorageAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Mock data for demonstration - replace with actual data fetching
  useEffect(() => {
    const loadDashboardData = async () => {
      setIsLoading(true);

      try {
        // Simulate a quick loading time for mock data
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Mock pending work
        setPendingWork([
          {
            id: "work-1",
            type: "work",
            title: "Community Garden Watering",
            description: "Daily watering of vegetables section",
            gardenId: "garden-123",
            status: "pending",
            priority: "high",
            createdAt: Date.now() - 2 * 60 * 60 * 1000, // 2 hours ago
            retryCount: 0,
            size: 156000,
            images: { count: 3, totalSize: 120000 },
          },
          {
            id: "work-2",
            type: "work_approval",
            title: "Approve harvest submission",
            gardenId: "garden-456",
            status: "failed",
            priority: "medium",
            createdAt: Date.now() - 24 * 60 * 60 * 1000, // 1 day ago
            lastAttempt: Date.now() - 30 * 60 * 1000, // 30 min ago
            retryCount: 3,
            error: "Network timeout",
            size: 45000,
          },
        ]);

        // Mock conflicts
        setConflicts([
          {
            workId: "work-conflict-1",
            conflicts: [
              {
                type: "already_submitted",
                severity: "high",
                autoResolvable: true,
              },
            ],
            localData: { title: "Duplicate work item" },
            remoteData: { title: "Similar work found" },
          },
        ]);

        // Mock storage info
        setStorageInfo({
          quota: {
            used: 45 * 1024 * 1024, // 45MB
            total: 100 * 1024 * 1024, // 100MB
            available: 55 * 1024 * 1024,
            percentage: 45,
          },
          breakdown: {
            workItems: 15 * 1024 * 1024,
            images: 25 * 1024 * 1024,
            cache: 3 * 1024 * 1024,
            metadata: 2 * 1024 * 1024,
            total: 45 * 1024 * 1024,
          },
          needsCleanup: false,
          recommendedActions: [],
        });
      } catch (error) {
        console.error("Failed to load dashboard data:", error);
        // Set empty states on error
        setPendingWork([]);
        setConflicts([]);
        setStorageInfo(null);
      } finally {
        setIsLoading(false);
      }
    };

    loadDashboardData();

    // Fallback timeout to ensure loading doesn't get stuck
    const timeout = setTimeout(() => {
      setIsLoading(false);
    }, 2000);

    return () => clearTimeout(timeout);
  }, []);

  const tabs: DashboardTab[] = [
    {
      id: "queue",
      label: "Work Queue",
      icon: "📋",
      count: pendingWork.length,
    },
    {
      id: "conflicts",
      label: "Conflicts",
      icon: "⚠️",
      count: conflicts.length,
    },
    {
      id: "storage",
      label: "Storage",
      icon: "💾",
    },
    {
      id: "settings",
      label: "Settings",
      icon: "⚙️",
    },
  ];

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const formatTimeAgo = (timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return "Just now";
  };

  const renderWorkQueue = () => (
    <div className="space-y-3">
      {pendingWork.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-4xl mb-3">✅</div>
          <p className="font-medium text-slate-900">All synced!</p>
          <p className="text-sm text-slate-600">No pending work items</p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-slate-600">{pendingWork.length} items pending</p>
            <button
              className="text-sm text-primary hover:text-primary/80 font-medium"
              onClick={() => {
                /* Sync all */
              }}
            >
              Sync All
            </button>
          </div>
          <div className="space-y-2">
            {pendingWork.map((work) => (
              <Card key={work.id} className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium text-sm truncate">{work.title}</h4>
                      <Badge
                        variant="pill"
                        tint={
                          work.status === "failed"
                            ? "destructive"
                            : work.status === "pending"
                              ? "secondary"
                              : "primary"
                        }
                        className="text-xs"
                      >
                        {work.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span>{formatTimeAgo(work.createdAt)}</span>
                      <span>{formatFileSize(work.size)}</span>
                      {work.images && <span>{work.images.count} images</span>}
                    </div>
                    {work.error && (
                      <p className="mt-1 text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
                        {work.error}
                      </p>
                    )}
                  </div>
                  {work.status === "failed" && (
                    <button
                      className="ml-3 text-xs text-primary hover:text-primary/80 font-medium"
                      onClick={() => onRetryItem?.(work.id)}
                    >
                      Retry
                    </button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );

  const renderConflicts = () => (
    <div className="space-y-3">
      {conflicts.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-4xl mb-3">🤝</div>
          <p className="font-medium text-slate-900">No conflicts</p>
          <p className="text-sm text-slate-600">All work items are ready to sync</p>
        </div>
      ) : (
        <div className="space-y-2">
          {conflicts.map((conflict) => (
            <Card key={conflict.workId} className="p-3 border-orange-200 bg-orange-50/50">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-sm mb-2 truncate">Work ID: {conflict.workId}</h4>
                  <div className="space-y-1 mb-2">
                    {conflict.conflicts.map((c, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <Badge
                          variant="pill"
                          tint={
                            c.severity === "high"
                              ? "destructive"
                              : c.severity === "medium"
                                ? "accent"
                                : "secondary"
                          }
                          className="text-xs"
                        >
                          {c.type.replace("_", " ")}
                        </Badge>
                        {c.autoResolvable && (
                          <span className="text-xs text-green-600 font-medium">
                            Auto-resolvable
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                <button
                  className="ml-3 text-xs text-primary hover:text-primary/80 font-medium"
                  onClick={() => onResolveConflict?.(conflict.workId, "auto")}
                >
                  Resolve
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );

  const renderStorage = () => (
    <div className="space-y-4">
      {storageInfo ? (
        <>
          <Card className="p-3">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-sm">Storage Usage</h4>
              <button
                className="text-xs text-primary hover:text-primary/80 font-medium"
                onClick={onStorageCleanup}
              >
                Clean up
              </button>
            </div>
            <div className="mb-3">
              <div className="flex justify-between text-sm mb-1">
                <span>{formatFileSize(storageInfo.quota.used)} used</span>
                <span>{storageInfo.quota.percentage.toFixed(0)}%</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2">
                <div
                  className={cn(
                    "h-2 rounded-full transition-all",
                    storageInfo.quota.percentage > 90
                      ? "bg-red-500"
                      : storageInfo.quota.percentage > 70
                        ? "bg-orange-500"
                        : "bg-green-500"
                  )}
                  style={{ width: `${Math.min(storageInfo.quota.percentage, 100)}%` }}
                />
              </div>
            </div>
          </Card>

          <Card className="p-3">
            <h4 className="font-medium text-sm mb-3">Breakdown</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">Work Items</span>
                <span className="font-medium">
                  {formatFileSize(storageInfo.breakdown.workItems)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Images</span>
                <span className="font-medium">{formatFileSize(storageInfo.breakdown.images)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Cache</span>
                <span className="font-medium">{formatFileSize(storageInfo.breakdown.cache)}</span>
              </div>
              <hr className="border-slate-200" />
              <div className="flex justify-between font-medium">
                <span>Total</span>
                <span>{formatFileSize(storageInfo.breakdown.total)}</span>
              </div>
            </div>
          </Card>

          {storageInfo.recommendedActions.length > 0 && (
            <Card className="p-3 border-orange-200 bg-orange-50/50">
              <h4 className="font-medium text-sm mb-2">💡 Recommendations</h4>
              <ul className="space-y-1 text-sm">
                {storageInfo.recommendedActions.map((action, index) => (
                  <li key={index} className="text-orange-700">
                    • {action}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      ) : (
        <div className="text-center py-12">
          <p className="text-slate-600">Storage info unavailable</p>
        </div>
      )}
    </div>
  );

  const renderSettings = () => (
    <div className="space-y-4">
      <Card className="p-3">
        <h4 className="font-medium text-sm mb-3">Sync Settings</h4>
        <div className="space-y-3">
          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" defaultChecked className="rounded border-border" />
            <span>Auto-sync when online</span>
          </label>
          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" defaultChecked className="rounded border-border" />
            <span>Check for duplicates before sync</span>
          </label>
          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" className="rounded border-border" />
            <span>Auto-resolve simple conflicts</span>
          </label>
        </div>
      </Card>

      <Card className="p-3">
        <h4 className="font-medium text-sm mb-3">Storage Settings</h4>
        <div className="space-y-3">
          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" defaultChecked className="rounded border-border" />
            <span>Auto-cleanup old completed work</span>
          </label>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-600">Keep work for:</span>
            <select className="px-2 py-1 border border-border rounded text-sm bg-white">
              <option>7 days</option>
              <option>30 days</option>
              <option>90 days</option>
            </select>
          </div>
        </div>
      </Card>
    </div>
  );

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center">
        <Card className="p-4 m-4">
          <div className="flex items-center gap-3">
            <div className="animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full" />
            <span className="text-sm">Loading...</span>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      data-testid="dashboard-modal"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          onClose?.();
        }
      }}
      tabIndex={-1}
    >
      <div
        className={cn(
          "bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-2xl max-h-[85vh] sm:max-h-[80vh] overflow-hidden",
          className
        )}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          e.stopPropagation();
        }}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <h2 className="text-lg font-semibold">Work Dashboard</h2>
            <p className="text-sm text-slate-600">Sync status and pending work</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-100 rounded-full transition-colors"
            data-testid="dashboard-close"
          >
            <span className="text-xl text-slate-400">×</span>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors relative whitespace-nowrap",
                activeTab === tab.id
                  ? "text-primary border-b-2 border-primary bg-slate-50"
                  : "text-slate-600 hover:bg-slate-50"
              )}
              data-testid={`tab-${tab.id}`}
            >
              <span className="text-base">{tab.icon}</span>
              <span>{tab.label}</span>
              {tab.count !== undefined && tab.count > 0 && (
                <Badge variant="pill" tint="primary" className="text-xs">
                  {tab.count}
                </Badge>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto flex-1" style={{ maxHeight: "calc(85vh - 140px)" }}>
          {activeTab === "queue" && renderWorkQueue()}
          {activeTab === "conflicts" && renderConflicts()}
          {activeTab === "storage" && renderStorage()}
          {activeTab === "settings" && renderSettings()}
        </div>
      </div>
    </div>
  );
};
