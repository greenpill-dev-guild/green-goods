/**
 * Analytics Service
 *
 * PostHog integration for measuring bot interactions and performance.
 *
 * Features:
 * - Track bot commands and message handling
 * - Measure response latency and performance
 * - User engagement analytics
 * - Rate limit events
 * - Error tracking
 *
 * Privacy:
 * - User IDs are hashed platform IDs (not raw Telegram IDs)
 * - No PII stored in events
 * - Disabled in development by default
 */

import { PostHog } from "posthog-node";

// ============================================================================
// TYPES
// ============================================================================

export interface AnalyticsConfig {
  /** PostHog API key */
  apiKey?: string;
  /** PostHog host (default: https://us.i.posthog.com) */
  host?: string;
  /** Enable analytics (default: true in production) */
  enabled?: boolean;
  /** Flush interval in milliseconds (default: 10000) */
  flushInterval?: number;
}

export interface TrackEventOptions {
  /** User identifier (hashed platformId) */
  distinctId: string;
  /** Event properties */
  properties?: Record<string, unknown>;
}

export interface PerformanceMetrics {
  /** Time to process message in ms */
  latencyMs: number;
  /** Handler that processed the message */
  handler?: string;
  /** Whether the response was rate limited */
  rateLimited?: boolean;
  /** Whether there was an error */
  hasError?: boolean;
}

// ============================================================================
// EVENT NAMES
// ============================================================================

/**
 * Standard event names for consistent analytics.
 */
export const ANALYTICS_EVENTS = {
  // User lifecycle
  USER_CREATED: "user_created",
  WALLET_CREATED: "wallet_created",

  // Commands
  COMMAND_EXECUTED: "command_executed",
  COMMAND_FAILED: "command_failed",

  // Messages
  MESSAGE_RECEIVED: "message_received",
  MESSAGE_PROCESSED: "message_processed",
  VOICE_TRANSCRIBED: "voice_transcribed",

  // Work flow
  WORK_SUBMITTED: "work_submitted",
  WORK_CONFIRMED: "work_confirmed",
  WORK_CANCELLED: "work_cancelled",
  WORK_APPROVED: "work_approved",
  WORK_REJECTED: "work_rejected",

  // Garden
  GARDEN_JOINED: "garden_joined",

  // Rate limiting
  RATE_LIMITED: "rate_limited",

  // Errors
  ERROR_OCCURRED: "error_occurred",

  // Performance
  PERFORMANCE_MEASURED: "performance_measured",
} as const;

export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];

// ============================================================================
// ANALYTICS SERVICE
// ============================================================================

/**
 * Analytics service for tracking bot interactions.
 *
 * @example
 * const analytics = new Analytics({ apiKey: 'phc_...' });
 *
 * // Track a command
 * analytics.trackCommand('user-123', 'start', { platform: 'telegram' });
 *
 * // Track performance
 * analytics.trackPerformance('user-123', { latencyMs: 150, handler: 'start' });
 *
 * // Shutdown gracefully
 * await analytics.shutdown();
 */
export class Analytics {
  private client: PostHog | null = null;
  private enabled: boolean;

  constructor(config: AnalyticsConfig = {}) {
    const {
      apiKey = process.env.POSTHOG_AGENT_KEY,
      host = "https://us.i.posthog.com",
      enabled = process.env.NODE_ENV === "production",
      flushInterval = 10000,
    } = config;

    this.enabled = enabled && !!apiKey;

    if (this.enabled && apiKey) {
      this.client = new PostHog(apiKey, {
        host,
        flushInterval,
        // Disable automatic feature flag fetching (not needed for analytics)
        featureFlagsPollingInterval: 0,
      });

      console.log("📊 Analytics initialized");
    } else if (!apiKey && process.env.NODE_ENV === "production") {
      console.warn("⚠️ POSTHOG_AGENT_KEY not set. Analytics disabled.");
    }
  }

  // ==========================================================================
  // CORE TRACKING
  // ==========================================================================

  /**
   * Track a generic event.
   */
  track(event: AnalyticsEvent | string, options: TrackEventOptions): void {
    if (!this.enabled || !this.client) return;

    this.client.capture({
      distinctId: options.distinctId,
      event,
      properties: {
        ...options.properties,
        timestamp: new Date().toISOString(),
        source: "agent",
      },
    });
  }

  /**
   * Identify a user with properties.
   */
  identify(distinctId: string, properties: Record<string, unknown> = {}): void {
    if (!this.enabled || !this.client) return;

    this.client.identify({
      distinctId,
      properties: {
        ...properties,
        source: "agent",
      },
    });
  }

  // ==========================================================================
  // CONVENIENCE METHODS
  // ==========================================================================

  /**
   * Track a command execution.
   */
  trackCommand(
    distinctId: string,
    command: string,
    properties: Record<string, unknown> = {}
  ): void {
    this.track(ANALYTICS_EVENTS.COMMAND_EXECUTED, {
      distinctId,
      properties: {
        command,
        ...properties,
      },
    });
  }

  /**
   * Track a command failure.
   */
  trackCommandFailed(
    distinctId: string,
    command: string,
    error: string,
    properties: Record<string, unknown> = {}
  ): void {
    this.track(ANALYTICS_EVENTS.COMMAND_FAILED, {
      distinctId,
      properties: {
        command,
        error,
        ...properties,
      },
    });
  }

  /**
   * Track a message being processed.
   */
  trackMessage(
    distinctId: string,
    messageType: "text" | "voice" | "command" | "callback" | "image",
    properties: Record<string, unknown> = {}
  ): void {
    this.track(ANALYTICS_EVENTS.MESSAGE_PROCESSED, {
      distinctId,
      properties: {
        messageType,
        ...properties,
      },
    });
  }

  /**
   * Track work submission.
   */
  trackWorkSubmitted(distinctId: string, properties: Record<string, unknown> = {}): void {
    this.track(ANALYTICS_EVENTS.WORK_SUBMITTED, {
      distinctId,
      properties,
    });
  }

  /**
   * Track work confirmation.
   */
  trackWorkConfirmed(distinctId: string, properties: Record<string, unknown> = {}): void {
    this.track(ANALYTICS_EVENTS.WORK_CONFIRMED, {
      distinctId,
      properties,
    });
  }

  /**
   * Track work approval (by operator).
   */
  trackWorkApproved(distinctId: string, properties: Record<string, unknown> = {}): void {
    this.track(ANALYTICS_EVENTS.WORK_APPROVED, {
      distinctId,
      properties,
    });
  }

  /**
   * Track work rejection (by operator).
   */
  trackWorkRejected(distinctId: string, properties: Record<string, unknown> = {}): void {
    this.track(ANALYTICS_EVENTS.WORK_REJECTED, {
      distinctId,
      properties,
    });
  }

  /**
   * Track garden join.
   */
  trackGardenJoined(
    distinctId: string,
    gardenAddress: string,
    properties: Record<string, unknown> = {}
  ): void {
    this.track(ANALYTICS_EVENTS.GARDEN_JOINED, {
      distinctId,
      properties: {
        gardenAddress,
        ...properties,
      },
    });
  }

  /**
   * Track user creation.
   */
  trackUserCreated(distinctId: string, properties: Record<string, unknown> = {}): void {
    this.track(ANALYTICS_EVENTS.USER_CREATED, {
      distinctId,
      properties,
    });

    // Also identify the user
    this.identify(distinctId, {
      createdAt: new Date().toISOString(),
      ...properties,
    });
  }

  /**
   * Track rate limiting event.
   */
  trackRateLimited(
    distinctId: string,
    limitType: string,
    properties: Record<string, unknown> = {}
  ): void {
    this.track(ANALYTICS_EVENTS.RATE_LIMITED, {
      distinctId,
      properties: {
        limitType,
        ...properties,
      },
    });
  }

  /**
   * Track an error.
   */
  trackError(
    distinctId: string,
    error: Error | string,
    context: Record<string, unknown> = {}
  ): void {
    const errorMessage = error instanceof Error ? error.message : error;
    const errorStack = error instanceof Error ? error.stack : undefined;

    this.track(ANALYTICS_EVENTS.ERROR_OCCURRED, {
      distinctId,
      properties: {
        error: errorMessage,
        stack: errorStack,
        ...context,
      },
    });
  }

  /**
   * Track performance metrics.
   */
  trackPerformance(distinctId: string, metrics: PerformanceMetrics): void {
    this.track(ANALYTICS_EVENTS.PERFORMANCE_MEASURED, {
      distinctId,
      properties: {
        latency_ms: metrics.latencyMs,
        handler: metrics.handler,
        rate_limited: metrics.rateLimited ?? false,
        has_error: metrics.hasError ?? false,
      },
    });
  }

  // ==========================================================================
  // LIFECYCLE
  // ==========================================================================

  /**
   * Flush any pending events.
   */
  async flush(): Promise<void> {
    if (!this.client) return;
    await this.client.flush();
  }

  /**
   * Shutdown the analytics client gracefully.
   * Call this before process exit.
   */
  async shutdown(): Promise<void> {
    if (!this.client) return;

    try {
      await this.client.shutdown();
      console.log("📊 Analytics shutdown complete");
    } catch (error) {
      console.error("Analytics shutdown error:", error);
    }
  }

  /**
   * Check if analytics is enabled.
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Get stats for monitoring.
   */
  getStats(): { enabled: boolean; pending: number } {
    return {
      enabled: this.enabled,
      pending: 0, // PostHog doesn't expose pending count directly
    };
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Hash a platform ID for privacy.
 * Uses a simple hash to avoid storing raw Telegram IDs.
 */
export function hashPlatformId(platform: string, platformId: string): string {
  // Simple hash using built-in crypto
  const data = `${platform}:${platformId}`;
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return `${platform}_${Math.abs(hash).toString(16)}`;
}

/**
 * Create a performance timer.
 *
 * @example
 * const timer = createTimer();
 * // ... do work ...
 * const metrics = timer.stop('handlerName');
 * analytics.trackPerformance(userId, metrics);
 */
export function createTimer(): {
  stop: (handler?: string) => PerformanceMetrics;
} {
  const startTime = performance.now();

  return {
    stop: (handler?: string): PerformanceMetrics => ({
      latencyMs: Math.round(performance.now() - startTime),
      handler,
    }),
  };
}

// ============================================================================
// SINGLETON
// ============================================================================

/** Singleton analytics instance */
let _analytics: Analytics | null = null;

/**
 * Get or create the singleton analytics instance.
 */
export function getAnalytics(config?: AnalyticsConfig): Analytics {
  if (!_analytics) {
    _analytics = new Analytics(config);
  }
  return _analytics;
}

/**
 * Shutdown the singleton analytics instance.
 */
export async function shutdownAnalytics(): Promise<void> {
  if (_analytics) {
    await _analytics.shutdown();
    _analytics = null;
  }
}
