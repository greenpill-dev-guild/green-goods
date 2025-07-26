// Enhanced offline types for the comprehensive offline system

export interface OfflineStatus {
  isOnline: boolean;
  hasPendingItems: boolean;
  hasConflicts: boolean;
  isSyncing: boolean;
  needsStorageCleanup: boolean;
  syncProgress?: {
    current: number;
    total: number;
    status: "idle" | "syncing" | "completed" | "error";
  };
}

export interface OfflineDashboardData {
  pendingWork: OfflineWorkItem[];
  conflicts: WorkConflict[];
  retryQueue: RetryableItem[];
  storageInfo: StorageAnalytics;
  syncStatus: {
    lastSync: number;
    nextSync?: number;
    inProgress: boolean;
    errors: string[];
  };
}

export interface OfflineWorkItem {
  id: string;
  type: "work" | "work_approval";
  title: string;
  description?: string;
  gardenId: string;
  status: "pending" | "syncing" | "failed" | "synced";
  priority: "high" | "medium" | "low";
  createdAt: number;
  lastAttempt?: number;
  retryCount: number;
  error?: string;
  contentHash?: string;
  size: number; // estimated size in bytes
  images?: {
    count: number;
    totalSize: number;
  };
}

export interface SyncMetrics {
  successful: number;
  failed: number;
  retries: number;
  totalTime: number;
  averageTime: number;
  errors: Array<{
    timestamp: number;
    error: string;
    workId: string;
  }>;
}

export interface OfflineSettings {
  autoSync: boolean;
  syncInterval: number;
  retryPolicy: {
    maxRetries: number;
    initialDelay: number;
    maxDelay: number;
    backoffMultiplier: number;
  };
  storage: {
    maxAge: number;
    maxItems: number;
    cleanupThreshold: number;
    autoCleanup: boolean;
  };
  deduplication: {
    enabled: boolean;
    checkRemote: boolean;
    timeWindow: number;
  };
  conflictResolution: {
    autoResolve: boolean;
    preferLocal: boolean;
  };
}

export interface OfflineCapabilities {
  hasStorage: boolean;
  hasServiceWorker: boolean;
  hasNotifications: boolean;
  hasBackgroundSync: boolean;
  storageQuota: number;
  storageUsed: number;
}

// Re-export types from modules for convenience
export type { RetryableItem, RetryConfig } from "../modules/retry-policy";
export type { WorkConflict, ConflictType } from "../modules/conflict-resolver";
export type { StorageAnalytics, CleanupResult } from "../modules/storage-manager";
export type { DuplicateCheckResult } from "../modules/deduplication";

// Dashboard component props
export interface OfflineWorkDashboardProps {
  className?: string;
  onClose?: () => void;
  onRetryItem?: (workId: string) => Promise<void>;
  onResolveConflict?: (workId: string, resolution: string) => Promise<void>;
  onStorageCleanup?: () => Promise<void>;
}

export interface ConflictResolutionModalProps {
  conflict: WorkConflict;
  isOpen: boolean;
  onClose: () => void;
  onResolve: (workId: string, resolution: string, data?: any) => Promise<void>;
}

export interface DuplicateWorkWarningProps {
  workData: any;
  duplicateInfo: DuplicateCheckResult;
  onProceed: () => void;
  onCancel: () => void;
  onViewDuplicate?: (workId: string) => void;
}
