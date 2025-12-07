// Offline types for the Green Goods app
declare interface OfflineStatus {
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

declare interface OfflineDashboardData {
  status: OfflineStatus;
  metrics: SyncMetrics;
  workItems: OfflineWorkItem[];
  retryableItems: string[];
  storageInfo: {
    usedSpace: number;
    totalSpace: number;
    needsCleanup: boolean;
  };
}

declare interface OfflineWorkItem {
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
  size: number;
  images?: {
    count: number;
    totalSize: number;
  };
}

declare interface SyncMetrics {
  pendingCount: number;
  syncedCount: number;
  failedCount: number;
  conflictCount: number;
  totalSize: number;
  lastSync?: number;
  avgSyncTime?: number;
  successRate: number;
}

declare interface OfflineSettings {
  autoSync: boolean;
  syncInterval: number; // minutes
  maxRetries: number;
  keepOfflineDataDays: number;
  compressImages: boolean;
  maxImageSize: number; // MB
  syncOnlyOnWifi: boolean;
  enableNotifications: boolean;
  debugMode: boolean;
  maxPendingWorks: number;
  storageQuotaWarning: number; // percentage
  cleanupOldWorksAutomatically: boolean;
  batchSyncSize: number;
  enableConflictResolution: boolean;
  autoRetryFailedItems: boolean;
  backgroundSyncEnabled: boolean;
  compressionQuality: number; // 0-1
  enableDuplicateDetection: boolean;
  showDetailedErrors: boolean;
  enableAnalytics: boolean;
  dataSaverMode: boolean;
  enablePreemptiveSync: boolean;
  syncPriority: "balanced" | "speed" | "reliability";
}

declare interface OfflineCapabilities {
  canStoreWork: boolean;
  canStoreImages: boolean;
  canDetectDuplicates: boolean;
  canResolveConflicts: boolean;
  canCompressImages: boolean;
  maxStorageSize: number;
  supportedImageFormats: string[];
  maxImageCount: number;
  supportsBatchSync: boolean;
  supportsBackgroundSync: boolean;
  supportsProgressTracking: boolean;
  supportsRetryMechanisms: boolean;
  supportsConflictResolution: boolean;
  supportsStorageAnalytics: boolean;
}

declare interface WorkDashboardProps {
  className?: string;
  onClose?: () => void;
}

declare interface ConflictResolutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  conflict: WorkConflict;
  onResolve: (resolution: "keep_local" | "keep_remote" | "merge") => Promise<void>;
}

declare interface DuplicateCheckResult {
  conflictType?: string;
  similarity?: number;
  existingWorkId?: string;
}

// Moved to component file - DuplicateWorkWarningProps is now defined locally
// in /components/UI/DuplicateWorkWarning/DuplicateWorkWarning.tsx
