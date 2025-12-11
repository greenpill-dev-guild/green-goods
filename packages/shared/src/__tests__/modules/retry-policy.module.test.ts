import { describe, expect, it } from "vitest";

// TODO: Implement retry-policy module before enabling these tests
// import { RetryPolicy, defaultRetryPolicy } from "../../modules/work/retry-policy";

describe.skip("modules/retry-policy", () => {
  it("calculates backoff and respects max retries", () => {
    const policy = new RetryPolicy({
      maxRetries: 2,
      initialDelay: 100,
      backoffMultiplier: 2,
      jitter: false,
    });
    const id = "item-1";
    expect(policy.shouldRetry(id)).toBe(true);
    policy.recordAttempt(id, "err");
    // Immediately after recording attempt, nextRetryAt is in the future, so shouldRetry is false
    expect(policy.shouldRetry(id)).toBe(false);
    // Simulate waiting until next retry time
    (policy as any).retryQueue.get(id).nextRetryAt = Date.now() - 1;
    expect(policy.shouldRetry(id)).toBe(true);
    policy.recordAttempt(id, "err");
    expect(policy.shouldRetry(id)).toBe(false);
  });

  it("exposes a default instance", () => {
    const cfg = defaultRetryPolicy.getConfig();
    expect(cfg.maxRetries).toBeGreaterThan(0);
  });
});
