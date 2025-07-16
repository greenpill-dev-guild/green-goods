/**
 * @fileoverview Storage Management System for Green Goods Application
 *
 * This module provides comprehensive storage management capabilities including:
 * - Storage quota monitoring and analysis
 * - Automated cleanup policies
 * - Storage breakdown analytics
 * - Performance optimization recommendations
 *
 * The StorageManager helps ensure optimal performance in offline-first environments
 * by proactively managing IndexedDB storage, browser cache, and media files.
 *
 * @author Green Goods Team
 * @version 1.0.0
 */

/**
 * Represents the current storage quota information for the application
 */
export interface StorageQuota {
  /** Amount of storage currently used in bytes */
  used: number;
  /** Total storage quota available in bytes */
  total: number;
  /** Available storage remaining in bytes */
  available: number;
  /** Percentage of quota currently used (0-100) */
  percentage: number;
}

/**
 * Breakdown of storage usage by category
 */
export interface StorageBreakdown {
  /** Storage used by work items and submissions in bytes */
  workItems: number;
  /** Storage used by images and media files in bytes */
  images: number;
  /** Storage used by application cache in bytes */
  cache: number;
  /** Storage used by metadata and configuration in bytes */
  metadata: number;
  /** Total storage used across all categories in bytes */
  total: number;
}

/**
 * Configuration for automated storage cleanup operations
 */
export interface CleanupPolicy {
  /** Maximum age for items before cleanup (milliseconds) */
  maxAge: number;
  /** Maximum number of items to keep before cleanup */
  maxItems: number;
  /** Storage threshold percentage that triggers cleanup */
  thresholdPercentage: number;
  /** Order of cleanup operations by priority */
  priorityOrder: ("old_completed" | "failed_items" | "large_images" | "cache")[];
}

/**
 * Result of a cleanup operation
 */
export interface CleanupResult {
  /** Total number of items removed during cleanup */
  itemsRemoved: number;
  /** Total amount of storage space freed in bytes */
  spaceFreed: number;
  /** Breakdown of cleanup results by category */
  categories: Record<string, { items: number; space: number }>;
}

/**
 * Comprehensive storage analytics and recommendations
 */
export interface StorageAnalytics {
  /** Current storage quota information */
  quota: StorageQuota;
  /** Storage usage breakdown by category */
  breakdown: StorageBreakdown;
  /** Whether cleanup is recommended */
  needsCleanup: boolean;
  /** List of recommended actions for optimization */
  recommendedActions: string[];
  /** Optional usage trends and projections */
  trends?: {
    /** Average daily storage usage in bytes */
    dailyUsage: number;
    /** Weekly growth rate as percentage */
    weeklyGrowth: number;
    /** Projected date when storage will be full */
    projectedFull: Date | null;
  };
}

/**
 * Manages application storage including quota monitoring, cleanup policies,
 * and performance optimization for offline-first functionality.
 *
 * @example
 * ```typescript
 * const storageManager = new StorageManager({
 *   thresholdPercentage: 85,
 *   maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
 * });
 *
 * // Check if cleanup is needed
 * if (await storageManager.shouldPerformCleanup()) {
 *   const result = await storageManager.performCleanup();
 *   console.log(`Freed ${result.spaceFreed} bytes`);
 * }
 * ```
 */
export class StorageManager {
  private policy: CleanupPolicy;
  private isCleanupRunning: boolean = false;
  private lastCleanup: number = 0;
  private cleanupInterval: number = 24 * 60 * 60 * 1000; // 24 hours

  /**
   * Creates a new StorageManager instance with the specified cleanup policy
   *
   * @param policy - Partial cleanup policy configuration (uses defaults for missing values)
   */
  constructor(policy: Partial<CleanupPolicy> = {}) {
    this.policy = {
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      maxItems: 1000,
      thresholdPercentage: 80,
      priorityOrder: ["old_completed", "failed_items", "large_images", "cache"],
      ...policy,
    };
  }

  /**
   * Retrieves current storage quota information from the browser
   *
   * @returns Promise resolving to storage quota details
   * @throws Will not throw but logs errors and returns fallback values
   */
  async getStorageQuota(): Promise<StorageQuota> {
    // Check storage API availability with proper null checking
    if (
      typeof navigator !== "undefined" &&
      "storage" in navigator &&
      navigator.storage &&
      typeof navigator.storage.estimate === "function"
    ) {
      try {
        const estimate = await navigator.storage.estimate();
        const used = estimate.usage || 0;
        const total = estimate.quota || 0;
        const available = total - used;
        const percentage = total > 0 ? (used / total) * 100 : 0;

        return {
          used,
          total,
          available,
          percentage,
        };
      } catch (error) {
        console.error("Error getting storage estimate:", error);
      }
    }

    // Fallback for browsers without storage API
    return {
      used: 0,
      total: 1024 * 1024 * 1024, // 1GB default
      available: 1024 * 1024 * 1024,
      percentage: 0,
    };
  }

  /**
   * Analyzes storage usage breakdown by category
   *
   * @returns Promise resolving to detailed storage breakdown
   */
  async getStorageBreakdown(): Promise<StorageBreakdown> {
    try {
      // Get IndexedDB usage approximation
      const workItems = await this.calculateWorkItemsSize();
      const images = await this.calculateImagesSize();
      const cache = await this.calculateCacheSize();
      const metadata = await this.calculateMetadataSize();

      return {
        workItems,
        images,
        cache,
        metadata,
        total: workItems + images + cache + metadata,
      };
    } catch (error) {
      console.error("Error calculating storage breakdown:", error);
      return {
        workItems: 0,
        images: 0,
        cache: 0,
        metadata: 0,
        total: 0,
      };
    }
  }

  /**
   * Performs storage cleanup according to configured policy
   *
   * @returns Promise resolving to cleanup operation results
   * @throws Error if cleanup is already in progress
   */
  async performCleanup(): Promise<CleanupResult> {
    if (this.isCleanupRunning) {
      throw new Error("Cleanup already in progress");
    }

    this.isCleanupRunning = true;
    let totalItemsRemoved = 0;
    let totalSpaceFreed = 0;
    const categories: Record<string, { items: number; space: number }> = {};

    try {
      for (const category of this.policy.priorityOrder) {
        const result = await this.cleanupCategory(category);
        totalItemsRemoved += result.items;
        totalSpaceFreed += result.space;
        categories[category] = result;

        // Check if we've freed enough space
        const quota = await this.getStorageQuota();
        if (quota.percentage < this.policy.thresholdPercentage) {
          break;
        }
      }

      this.lastCleanup = Date.now();
      return {
        itemsRemoved: totalItemsRemoved,
        spaceFreed: totalSpaceFreed,
        categories,
      };
    } finally {
      this.isCleanupRunning = false;
    }
  }

  /**
   * Determines if storage cleanup should be performed based on current conditions
   *
   * @returns Promise resolving to true if cleanup is recommended
   */
  async shouldPerformCleanup(): Promise<boolean> {
    const quota = await this.getStorageQuota();

    // Check percentage threshold
    if (quota.percentage >= this.policy.thresholdPercentage) {
      return true;
    }

    // Check time since last cleanup
    const timeSinceCleanup = Date.now() - this.lastCleanup;
    if (timeSinceCleanup > this.cleanupInterval) {
      return true;
    }

    // Check item count
    const breakdown = await this.getStorageBreakdown();
    const estimatedItemCount = breakdown.total / 10000; // Rough estimate
    if (estimatedItemCount > this.policy.maxItems) {
      return true;
    }

    return false;
  }

  /**
   * Performs cleanup for a specific category
   *
   * @param category - The storage category to clean up
   * @returns Promise resolving to cleanup results for the category
   * @private
   */
  private async cleanupCategory(category: string): Promise<{ items: number; space: number }> {
    switch (category) {
      case "old_completed":
        return await this.cleanupOldCompleted();
      case "failed_items":
        return await this.cleanupFailedItems();
      case "large_images":
        return await this.cleanupLargeImages();
      case "cache":
        return await this.cleanupCache();
      default:
        return { items: 0, space: 0 };
    }
  }

  /**
   * Cleans up old completed work items past the configured age threshold
   *
   * @returns Promise resolving to cleanup results
   * @private
   */
  private async cleanupOldCompleted(): Promise<{ items: number; space: number }> {
    try {
      // This would integrate with your offline DB
      const cutoffDate = Date.now() - this.policy.maxAge;
      // Mock implementation - replace with actual DB calls
      console.log(`Cleaning up completed items older than ${new Date(cutoffDate)}`);
      return { items: 5, space: 50000 }; // Mock result
    } catch (error) {
      console.error("Error cleaning up old completed items:", error);
      return { items: 0, space: 0 };
    }
  }

  /**
   * Cleans up permanently failed items that cannot be retried
   *
   * @returns Promise resolving to cleanup results
   * @private
   */
  private async cleanupFailedItems(): Promise<{ items: number; space: number }> {
    try {
      // Mock implementation
      console.log("Cleaning up permanently failed items");
      return { items: 3, space: 30000 };
    } catch (error) {
      console.error("Error cleaning up failed items:", error);
      return { items: 0, space: 0 };
    }
  }

  /**
   * Optimizes or removes large images to free storage space
   *
   * @returns Promise resolving to cleanup results
   * @private
   */
  private async cleanupLargeImages(): Promise<{ items: number; space: number }> {
    try {
      // Mock implementation
      console.log("Optimizing or removing large images");
      return { items: 10, space: 200000 };
    } catch (error) {
      console.error("Error cleaning up large images:", error);
      return { items: 0, space: 0 };
    }
  }

  /**
   * Clears browser cache to free storage space
   *
   * @returns Promise resolving to cleanup results
   * @private
   */
  private async cleanupCache(): Promise<{ items: number; space: number }> {
    try {
      // Clear browser cache if possible
      if ("caches" in window) {
        const cacheNames = await caches.keys();
        let spaceFreed = 0;
        for (const cacheName of cacheNames) {
          await caches.delete(cacheName);
          spaceFreed += 100000; // Estimate
        }
        return { items: cacheNames.length, space: spaceFreed };
      }
      return { items: 0, space: 0 };
    } catch (error) {
      console.error("Error cleaning up cache:", error);
      return { items: 0, space: 0 };
    }
  }

  /**
   * Calculates storage used by work items
   *
   * @returns Promise resolving to storage size in bytes
   * @private
   */
  private async calculateWorkItemsSize(): Promise<number> {
    // Mock implementation - would integrate with IndexedDB
    return 500000; // 500KB
  }

  /**
   * Calculates storage used by images and media
   *
   * @returns Promise resolving to storage size in bytes
   * @private
   */
  private async calculateImagesSize(): Promise<number> {
    // Mock implementation
    return 2000000; // 2MB
  }

  /**
   * Calculates storage used by application cache
   *
   * @returns Promise resolving to storage size in bytes
   * @private
   */
  private async calculateCacheSize(): Promise<number> {
    // Mock implementation
    return 1000000; // 1MB
  }

  /**
   * Calculates storage used by metadata and configuration
   *
   * @returns Promise resolving to storage size in bytes
   * @private
   */
  private async calculateMetadataSize(): Promise<number> {
    // Mock implementation
    return 100000; // 100KB
  }

  /**
   * Generates comprehensive storage analytics and recommendations
   *
   * @returns Promise resolving to detailed analytics and recommendations
   */
  async getAnalytics(): Promise<StorageAnalytics> {
    const quota = await this.getStorageQuota();
    const breakdown = await this.getStorageBreakdown();
    const needsCleanup = await this.shouldPerformCleanup();

    const recommendedActions: string[] = [];

    if (quota.percentage > 90) {
      recommendedActions.push("Immediate cleanup required - storage critically low");
    } else if (quota.percentage > this.policy.thresholdPercentage) {
      recommendedActions.push("Cleanup recommended - storage usage high");
    }

    if (breakdown.images > breakdown.total * 0.6) {
      recommendedActions.push("Consider optimizing or reducing image quality");
    }

    if (breakdown.cache > breakdown.total * 0.3) {
      recommendedActions.push("Clear browser cache to free space");
    }

    return {
      quota,
      breakdown,
      needsCleanup,
      recommendedActions,
    };
  }

  /**
   * Updates the cleanup policy configuration
   *
   * @param policy - Partial cleanup policy to merge with current configuration
   */
  setCleanupPolicy(policy: Partial<CleanupPolicy>): void {
    this.policy = { ...this.policy, ...policy };
  }

  /**
   * Retrieves the current cleanup policy configuration
   *
   * @returns Copy of the current cleanup policy
   */
  getCleanupPolicy(): CleanupPolicy {
    return { ...this.policy };
  }

  /**
   * Gets the timestamp of the last cleanup operation
   *
   * @returns Timestamp in milliseconds of last cleanup, or 0 if never run
   */
  getLastCleanupTime(): number {
    return this.lastCleanup;
  }

  /**
   * Checks if a cleanup operation is currently in progress
   *
   * @returns True if cleanup is running, false otherwise
   */
  isCleanupInProgress(): boolean {
    return this.isCleanupRunning;
  }
}

// Default storage manager instance
export const defaultStorageManager = new StorageManager();
