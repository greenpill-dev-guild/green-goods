/**
 * Offline Feature Types
 *
 * Type definitions for offline functionality and sync management.
 * Import these explicitly instead of relying on global declarations.
 *
 * @example
 * ```typescript
 * import type { OfflineStatus, SyncMetrics, OfflineWorkItem } from '@green-goods/shared';
 * ```
 */

// ============================================
// Offline Status Types
// ============================================

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
  size: number;
  images?: {
    count: number;
    totalSize: number;
  };
}

export interface SyncMetrics {
  pendingCount: number;
  syncedCount: number;
  failedCount: number;
  conflictCount: number;
  totalSize: number;
  lastSync?: number;
  avgSyncTime?: number;
  successRate: number;
}

// ============================================
// Offline Settings Types
// ============================================

export interface OfflineSettings {
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

export interface OfflineCapabilities {
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

// ============================================
// Conflict Resolution Types
// ============================================

export interface WorkConflict {
  localWork: OfflineWorkItem;
  remoteWork: OfflineWorkItem;
  conflictType: "duplicate" | "modified" | "version_mismatch";
  similarity?: number;
}

export interface DuplicateCheckResult {
  conflictType?: string;
  similarity?: number;
  existingWorkId?: string;
}
