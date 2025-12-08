/**
 * Analytics Port
 *
 * Interface for analytics tracking, allowing different implementations
 * (PostHog, custom, mock for testing).
 */

// ============================================================================
// TYPES
// ============================================================================

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
// ANALYTICS PORT INTERFACE
// ============================================================================

/**
 * Analytics port for tracking bot interactions and performance.
 *
 * Implementations:
 * - PostHog adapter (production)
 * - Mock adapter (testing)
 * - No-op adapter (disabled)
 */
export interface AnalyticsPort {
  /**
   * Track a generic event.
   */
  track(event: string, options: { distinctId: string; properties?: Record<string, unknown> }): void;

  /**
   * Identify a user with properties.
   */
  identify(distinctId: string, properties?: Record<string, unknown>): void;

  /**
   * Track a command execution.
   */
  trackCommand(distinctId: string, command: string, properties?: Record<string, unknown>): void;

  /**
   * Track a command failure.
   */
  trackCommandFailed(
    distinctId: string,
    command: string,
    error: string,
    properties?: Record<string, unknown>
  ): void;

  /**
   * Track a message being processed.
   */
  trackMessage(
    distinctId: string,
    messageType: "text" | "voice" | "command" | "callback" | "image",
    properties?: Record<string, unknown>
  ): void;

  /**
   * Track work submission.
   */
  trackWorkSubmitted(distinctId: string, properties?: Record<string, unknown>): void;

  /**
   * Track work confirmation.
   */
  trackWorkConfirmed(distinctId: string, properties?: Record<string, unknown>): void;

  /**
   * Track work approval (by operator).
   */
  trackWorkApproved(distinctId: string, properties?: Record<string, unknown>): void;

  /**
   * Track work rejection (by operator).
   */
  trackWorkRejected(distinctId: string, properties?: Record<string, unknown>): void;

  /**
   * Track garden join.
   */
  trackGardenJoined(
    distinctId: string,
    gardenAddress: string,
    properties?: Record<string, unknown>
  ): void;

  /**
   * Track user creation.
   */
  trackUserCreated(distinctId: string, properties?: Record<string, unknown>): void;

  /**
   * Track rate limiting event.
   */
  trackRateLimited(
    distinctId: string,
    limitType: string,
    properties?: Record<string, unknown>
  ): void;

  /**
   * Track an error.
   */
  trackError(distinctId: string, error: Error | string, context?: Record<string, unknown>): void;

  /**
   * Track performance metrics.
   */
  trackPerformance(distinctId: string, metrics: PerformanceMetrics): void;

  /**
   * Flush any pending events.
   */
  flush(): Promise<void>;

  /**
   * Shutdown the analytics client gracefully.
   */
  shutdown(): Promise<void>;

  /**
   * Check if analytics is enabled.
   */
  isEnabled(): boolean;
}

// ============================================================================
// NO-OP IMPLEMENTATION
// ============================================================================

/**
 * No-op analytics implementation for when analytics is disabled.
 */
export class NoOpAnalytics implements AnalyticsPort {
  track(
    _event: string,
    _options: { distinctId: string; properties?: Record<string, unknown> }
  ): void {
    // No-op
  }

  identify(_distinctId: string, _properties?: Record<string, unknown>): void {
    // No-op
  }

  trackCommand(_distinctId: string, _command: string, _properties?: Record<string, unknown>): void {
    // No-op
  }

  trackCommandFailed(
    _distinctId: string,
    _command: string,
    _error: string,
    _properties?: Record<string, unknown>
  ): void {
    // No-op
  }

  trackMessage(
    _distinctId: string,
    _messageType: "text" | "voice" | "command" | "callback" | "image",
    _properties?: Record<string, unknown>
  ): void {
    // No-op
  }

  trackWorkSubmitted(_distinctId: string, _properties?: Record<string, unknown>): void {
    // No-op
  }

  trackWorkConfirmed(_distinctId: string, _properties?: Record<string, unknown>): void {
    // No-op
  }

  trackWorkApproved(_distinctId: string, _properties?: Record<string, unknown>): void {
    // No-op
  }

  trackWorkRejected(_distinctId: string, _properties?: Record<string, unknown>): void {
    // No-op
  }

  trackGardenJoined(
    _distinctId: string,
    _gardenAddress: string,
    _properties?: Record<string, unknown>
  ): void {
    // No-op
  }

  trackUserCreated(_distinctId: string, _properties?: Record<string, unknown>): void {
    // No-op
  }

  trackRateLimited(
    _distinctId: string,
    _limitType: string,
    _properties?: Record<string, unknown>
  ): void {
    // No-op
  }

  trackError(
    _distinctId: string,
    _error: Error | string,
    _context?: Record<string, unknown>
  ): void {
    // No-op
  }

  trackPerformance(_distinctId: string, _metrics: PerformanceMetrics): void {
    // No-op
  }

  async flush(): Promise<void> {
    // No-op
  }

  async shutdown(): Promise<void> {
    // No-op
  }

  isEnabled(): boolean {
    return false;
  }
}
