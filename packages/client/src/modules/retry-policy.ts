/**
 * @fileoverview Retry Policy Management for Green Goods Application
 *
 * This module provides intelligent retry mechanisms for failed operations including:
 * - Exponential backoff with jitter
 * - Priority-based retry scheduling
 * - Configurable retry limits and delays
 * - Retry statistics and monitoring
 *
 * The RetryPolicy ensures reliable operation in unstable network conditions
 * and helps maintain data consistency during sync operations.
 *
 * @author Green Goods Team
 * @version 1.0.0
 */

/**
 * Configuration options for retry behavior
 */
export interface RetryConfig {
  /** Maximum number of retry attempts before giving up */
  maxRetries: number;
  /** Initial delay between retries in milliseconds */
  initialDelay: number;
  /** Maximum delay between retries in milliseconds */
  maxDelay: number;
  /** Multiplier for exponential backoff (e.g., 2.0 doubles each time) */
  backoffMultiplier: number;
  /** Whether to add random jitter to prevent thundering herd */
  jitter: boolean;
}

/**
 * Information about a single retry attempt
 */
export interface RetryAttempt {
  /** The attempt number (1-based) */
  attempt: number;
  /** Timestamp when the attempt was made */
  timestamp: number;
  /** Error message if the attempt failed */
  error?: string;
  /** Timestamp when next retry should be attempted */
  nextRetryAt?: number;
}

/**
 * Represents an item that can be retried
 */
export interface RetryableItem {
  /** Unique identifier for the item */
  id: string;
  /** Array of all retry attempts made for this item */
  attempts: RetryAttempt[];
  /** Most recent error message */
  lastError?: string;
  /** Timestamp when next retry should be attempted */
  nextRetryAt?: number;
  /** Priority level affecting retry scheduling */
  priority: "high" | "medium" | "low";
}

/**
 * Manages retry logic for failed operations with intelligent backoff strategies.
 *
 * Features:
 * - Exponential backoff with configurable multipliers
 * - Jitter to prevent thundering herd problems
 * - Priority-based scheduling
 * - Automatic cleanup of successful items
 * - Comprehensive retry statistics
 *
 * @example
 * ```typescript
 * const retryPolicy = new RetryPolicy({
 *   maxRetries: 3,
 *   initialDelay: 1000,
 *   backoffMultiplier: 2
 * });
 *
 * // Record a failed attempt
 * retryPolicy.recordAttempt('work-123', 'Network timeout', 'high');
 *
 * // Check if item should be retried
 * if (retryPolicy.shouldRetry('work-123')) {
 *   // Retry the operation
 *   const success = await performOperation();
 *   if (success) {
 *     retryPolicy.recordSuccess('work-123');
 *   }
 * }
 * ```
 */
export class RetryPolicy {
  private config: RetryConfig;
  private retryQueue: Map<string, RetryableItem> = new Map();

  /**
   * Creates a new RetryPolicy instance with the specified configuration
   *
   * @param config - Partial retry configuration (uses defaults for missing values)
   */
  constructor(config: Partial<RetryConfig> = {}) {
    this.config = {
      maxRetries: 5,
      initialDelay: 1000, // 1 second
      maxDelay: 300000, // 5 minutes
      backoffMultiplier: 2,
      jitter: true,
      ...config,
    };
  }

  /**
   * Determines whether an item should be retried based on current policy
   *
   * @param itemId - Unique identifier for the item to check
   * @returns True if the item should be retried, false otherwise
   */
  shouldRetry(itemId: string): boolean {
    const item = this.retryQueue.get(itemId);
    if (!item) return true; // First attempt

    // Check if we've exceeded max retries
    if (item.attempts.length >= this.config.maxRetries) {
      return false;
    }

    // Check if it's time to retry
    if (item.nextRetryAt && Date.now() < item.nextRetryAt) {
      return false;
    }

    return true;
  }

  /**
   * Calculates the delay for the next retry attempt using exponential backoff
   *
   * @param attempt - The attempt number (1-based)
   * @param priority - Priority level affecting delay calculation
   * @returns Delay in milliseconds before next retry
   */
  calculateDelay(attempt: number, priority: "high" | "medium" | "low" = "medium"): number {
    // Base delay calculation with exponential backoff
    const baseDelay = Math.min(
      this.config.initialDelay * Math.pow(this.config.backoffMultiplier, attempt - 1),
      this.config.maxDelay
    );

    // Priority multiplier
    const priorityMultiplier = priority === "high" ? 0.5 : priority === "low" ? 2 : 1;
    let delay = baseDelay * priorityMultiplier;

    // Add jitter to prevent thundering herd
    if (this.config.jitter) {
      delay = delay * (0.5 + Math.random() * 0.5);
    }

    return Math.floor(delay);
  }

  /**
   * Records a retry attempt for an item
   *
   * @param itemId - Unique identifier for the item
   * @param error - Error message if the attempt failed (undefined for success)
   * @param priority - Priority level for retry scheduling
   */
  recordAttempt(
    itemId: string,
    error?: string,
    priority: "high" | "medium" | "low" = "medium"
  ): void {
    let item = this.retryQueue.get(itemId);

    if (!item) {
      item = {
        id: itemId,
        attempts: [],
        priority,
      };
      this.retryQueue.set(itemId, item);
    }

    const attempt: RetryAttempt = {
      attempt: item.attempts.length + 1,
      timestamp: Date.now(),
      error,
    };

    item.attempts.push(attempt);
    item.lastError = error;

    // Calculate next retry time
    if (error && this.shouldRetry(itemId)) {
      const delay = this.calculateDelay(attempt.attempt, priority);
      item.nextRetryAt = Date.now() + delay;
      attempt.nextRetryAt = item.nextRetryAt;
    }
  }

  /**
   * Records a successful operation and removes the item from retry queue
   *
   * @param itemId - Unique identifier for the successfully completed item
   */
  recordSuccess(itemId: string): void {
    this.retryQueue.delete(itemId);
  }

  /**
   * Gets all items that are eligible for retry at the current time
   *
   * @returns Array of retryable items sorted by priority and retry time
   */
  getRetryableItems(): RetryableItem[] {
    const now = Date.now();
    return Array.from(this.retryQueue.values())
      .filter(
        (item) =>
          item.attempts.length < this.config.maxRetries &&
          (!item.nextRetryAt || now >= item.nextRetryAt)
      )
      .sort((a, b) => {
        // Sort by priority, then by next retry time
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
        if (priorityDiff !== 0) return priorityDiff;

        return (a.nextRetryAt || 0) - (b.nextRetryAt || 0);
      });
  }

  /**
   * Gets all items that have exceeded the maximum retry count
   *
   * @returns Array of items that have permanently failed
   */
  getFailedItems(): RetryableItem[] {
    return Array.from(this.retryQueue.values()).filter(
      (item) => item.attempts.length >= this.config.maxRetries
    );
  }

  /**
   * Removes a specific item from the retry queue
   *
   * @param itemId - Unique identifier for the item to remove
   */
  clearItem(itemId: string): void {
    this.retryQueue.delete(itemId);
  }

  /**
   * Removes all permanently failed items from the retry queue
   */
  clearAllFailed(): void {
    const failedItems = this.getFailedItems();
    failedItems.forEach((item) => this.retryQueue.delete(item.id));
  }

  /**
   * Generates comprehensive statistics about retry operations
   *
   * @returns Object containing various retry statistics
   */
  getStats(): {
    pending: number;
    failed: number;
    retryable: number;
    totalAttempts: number;
  } {
    const items = Array.from(this.retryQueue.values());
    const failed = items.filter((item) => item.attempts.length >= this.config.maxRetries);
    const retryable = this.getRetryableItems();
    const totalAttempts = items.reduce((sum, item) => sum + item.attempts.length, 0);

    return {
      pending: items.length,
      failed: failed.length,
      retryable: retryable.length,
      totalAttempts,
    };
  }

  /**
   * Updates the retry policy configuration
   *
   * @param newConfig - Partial configuration to merge with current settings
   */
  setConfig(newConfig: Partial<RetryConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Retrieves the current retry policy configuration
   *
   * @returns Copy of the current configuration
   */
  getConfig(): RetryConfig {
    return { ...this.config };
  }
}

// Default retry policy instance
export const defaultRetryPolicy = new RetryPolicy();
