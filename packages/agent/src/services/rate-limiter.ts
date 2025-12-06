/**
 * Rate Limiting Service
 *
 * Provides rate limiting to protect against spam and abuse.
 * Uses a sliding window algorithm with configurable limits.
 *
 * Features:
 * - Per-user rate limiting
 * - Configurable windows and limits
 * - Automatic cleanup of old entries
 * - Support for different limit tiers (commands, messages, etc.)
 */

// ============================================================================
// TYPES
// ============================================================================

export interface RateLimitConfig {
  /** Maximum requests allowed in the window */
  maxRequests: number;
  /** Time window in milliseconds */
  windowMs: number;
  /** Optional message to show when rate limited */
  message?: string;
}

export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Number of remaining requests in the window */
  remaining: number;
  /** Time until the limit resets (ms) */
  resetIn: number;
  /** Total limit for this window */
  limit: number;
}

interface RateLimitEntry {
  timestamps: number[];
  lastCleanup: number;
}

// ============================================================================
// DEFAULT CONFIGURATIONS
// ============================================================================

/**
 * Default rate limit configurations by action type.
 */
export const RATE_LIMITS = {
  /** General messages (text/voice) */
  message: {
    maxRequests: 10,
    windowMs: 60_000, // 10 per minute
    message: "You're sending messages too quickly. Please wait a moment.",
  },

  /** Commands like /start, /join */
  command: {
    maxRequests: 20,
    windowMs: 60_000, // 20 per minute
    message: "Too many commands. Please slow down.",
  },

  /** Work submissions */
  submission: {
    maxRequests: 5,
    windowMs: 300_000, // 5 per 5 minutes
    message: "You've submitted too many works recently. Please wait before submitting again.",
  },

  /** Voice messages (more expensive to process) */
  voice: {
    maxRequests: 3,
    windowMs: 60_000, // 3 per minute
    message: "Voice processing is limited. Please wait before sending another voice message.",
  },

  /** Operator approvals */
  approval: {
    maxRequests: 30,
    windowMs: 60_000, // 30 per minute (operators need higher limits)
    message: "Too many approval actions. Please wait.",
  },

  /** Wallet operations */
  wallet: {
    maxRequests: 5,
    windowMs: 300_000, // 5 per 5 minutes
    message: "Too many wallet operations. Please wait.",
  },
} as const satisfies Record<string, RateLimitConfig>;

export type RateLimitType = keyof typeof RATE_LIMITS;

// ============================================================================
// RATE LIMITER CLASS
// ============================================================================

/**
 * Rate limiter using sliding window algorithm.
 *
 * @example
 * const limiter = new RateLimiter();
 *
 * // Check if user can send a message
 * const result = limiter.check(userId, 'message');
 * if (!result.allowed) {
 *   return ctx.reply(result.message);
 * }
 */
export class RateLimiter {
  private limits: Map<string, RateLimitEntry> = new Map();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Run cleanup every minute to prevent memory leaks
    this.cleanupInterval = setInterval(() => this.cleanup(), 60_000);
  }

  /**
   * Checks if a request is allowed and consumes a token if so.
   *
   * @param userId - The user's Telegram ID
   * @param type - The type of rate limit to check
   * @param config - Optional custom config (defaults to RATE_LIMITS[type])
   * @returns Rate limit result with allowed status and metadata
   */
  check(
    userId: number | string,
    type: RateLimitType,
    config?: Partial<RateLimitConfig>
  ): RateLimitResult & { message?: string } {
    const baseConfig = RATE_LIMITS[type];
    const { maxRequests, windowMs, message } = { ...baseConfig, ...config };

    const key = `${userId}:${type}`;
    const now = Date.now();
    const windowStart = now - windowMs;

    // Get or create entry
    let entry = this.limits.get(key);
    if (!entry) {
      entry = { timestamps: [], lastCleanup: now };
      this.limits.set(key, entry);
    }

    // Remove timestamps outside the window
    entry.timestamps = entry.timestamps.filter((t) => t > windowStart);

    // Check if allowed
    if (entry.timestamps.length >= maxRequests) {
      // Find when the oldest timestamp will expire
      const oldestInWindow = Math.min(...entry.timestamps);
      const resetIn = oldestInWindow + windowMs - now;

      return {
        allowed: false,
        remaining: 0,
        resetIn: Math.max(0, resetIn),
        limit: maxRequests,
        message,
      };
    }

    // Add current timestamp and allow
    entry.timestamps.push(now);

    return {
      allowed: true,
      remaining: maxRequests - entry.timestamps.length,
      resetIn: windowMs,
      limit: maxRequests,
    };
  }

  /**
   * Checks if a request would be allowed WITHOUT consuming a token.
   * Useful for showing warnings before expensive operations.
   */
  peek(userId: number | string, type: RateLimitType): RateLimitResult {
    const { maxRequests, windowMs } = RATE_LIMITS[type];

    const key = `${userId}:${type}`;
    const now = Date.now();
    const windowStart = now - windowMs;

    const entry = this.limits.get(key);
    if (!entry) {
      return {
        allowed: true,
        remaining: maxRequests,
        resetIn: windowMs,
        limit: maxRequests,
      };
    }

    const validTimestamps = entry.timestamps.filter((t) => t > windowStart);

    if (validTimestamps.length >= maxRequests) {
      const oldestInWindow = Math.min(...validTimestamps);
      const resetIn = oldestInWindow + windowMs - now;

      return {
        allowed: false,
        remaining: 0,
        resetIn: Math.max(0, resetIn),
        limit: maxRequests,
      };
    }

    return {
      allowed: true,
      remaining: maxRequests - validTimestamps.length,
      resetIn: windowMs,
      limit: maxRequests,
    };
  }

  /**
   * Resets rate limit for a specific user and type.
   * Useful for admin override or after successful verification.
   */
  reset(userId: number | string, type: RateLimitType): void {
    const key = `${userId}:${type}`;
    this.limits.delete(key);
  }

  /**
   * Resets all rate limits for a user.
   */
  resetAll(userId: number | string): void {
    for (const type of Object.keys(RATE_LIMITS)) {
      this.reset(userId, type as RateLimitType);
    }
  }

  /**
   * Cleans up old entries to prevent memory leaks.
   */
  private cleanup(): void {
    const now = Date.now();
    const maxWindow = Math.max(...Object.values(RATE_LIMITS).map((c) => c.windowMs));

    for (const [key, entry] of this.limits.entries()) {
      // Remove entries that haven't been accessed in 2x the max window
      if (now - entry.lastCleanup > maxWindow * 2) {
        this.limits.delete(key);
        continue;
      }

      // Clean old timestamps
      const cutoff = now - maxWindow;
      entry.timestamps = entry.timestamps.filter((t) => t > cutoff);
      entry.lastCleanup = now;

      // Remove empty entries
      if (entry.timestamps.length === 0) {
        this.limits.delete(key);
      }
    }
  }

  /**
   * Gets current stats (for debugging/monitoring).
   */
  getStats(): { totalEntries: number; totalTimestamps: number } {
    let totalTimestamps = 0;
    for (const entry of this.limits.values()) {
      totalTimestamps += entry.timestamps.length;
    }
    return {
      totalEntries: this.limits.size,
      totalTimestamps,
    };
  }

  /**
   * Stops the cleanup interval.
   * Call this when shutting down the bot.
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.limits.clear();
  }
}

/**
 * Formats remaining time for user display.
 */
export function formatRateLimitWait(resetInMs: number): string {
  const seconds = Math.ceil(resetInMs / 1000);
  if (seconds < 60) {
    return `${seconds} second${seconds !== 1 ? "s" : ""}`;
  }
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} minute${minutes !== 1 ? "s" : ""}`;
}

/** Singleton rate limiter instance */
export const rateLimiter = new RateLimiter();
