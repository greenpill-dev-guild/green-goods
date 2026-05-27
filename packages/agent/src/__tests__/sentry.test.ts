import { beforeEach, describe, expect, it } from "vitest";
import {
  captureAgentException,
  initAgentSentry,
  resetAgentSentryForTests,
  shutdownAgentSentry,
} from "../services/sentry";
import { mockSentry, mockSentryScope } from "./setup";

describe("agent Sentry", () => {
  beforeEach(() => {
    resetAgentSentryForTests();
    mockSentry.captureException.mockClear();
    mockSentry.flush.mockClear();
    mockSentry.init.mockClear();
    mockSentry.setTag.mockClear();
    mockSentry.withScope.mockClear();
    mockSentryScope.setContext.mockClear();
    mockSentryScope.setTag.mockClear();
  });

  it("stays disabled without an agent DSN", () => {
    initAgentSentry({
      dsn: undefined,
      enabled: true,
      tracesSampleRate: 0.05,
    });

    captureAgentException(new Error("not sent"));

    expect(mockSentry.init).not.toHaveBeenCalled();
    expect(mockSentry.captureException).not.toHaveBeenCalled();
  });

  it("initializes with privacy-safe defaults", () => {
    initAgentSentry({
      dsn: "https://example@sentry.io/1",
      enabled: true,
      environment: "production",
      release: "green-goods-agent@test",
      tracesSampleRate: 0.05,
    });

    expect(mockSentry.init).toHaveBeenCalledWith(
      expect.objectContaining({
        dsn: "https://example@sentry.io/1",
        environment: "production",
        release: "green-goods-agent@test",
        sendDefaultPii: false,
        tracesSampleRate: 0.05,
      })
    );
    expect(mockSentry.setTag).toHaveBeenCalledWith("surface", "agent");
  });

  it("captures exceptions with sanitized operational context", () => {
    initAgentSentry({
      dsn: "https://example@sentry.io/1",
      enabled: true,
      tracesSampleRate: 0.05,
    });

    const error = new Error("failed for alice@example.com");
    captureAgentException(error, {
      source: "handleMessage",
      surface: "handler",
      platform: "telegram",
      contentType: "command",
      commandName: "join",
      metadata: {
        senderPlatformId: "123456789",
        walletAddress: "0x1111111111111111111111111111111111111111",
      },
    });

    expect(mockSentry.withScope).toHaveBeenCalledOnce();
    expect(mockSentryScope.setTag).toHaveBeenCalledWith("green_goods.platform", "telegram");
    expect(mockSentryScope.setContext).toHaveBeenCalledWith(
      "green_goods_agent",
      expect.objectContaining({
        metadata: {
          senderPlatformId: "[REDACTED]",
          walletAddress: "[REDACTED]",
        },
      })
    );
    expect(mockSentry.captureException).toHaveBeenCalledWith(error);
  });

  it("flushes on shutdown", async () => {
    initAgentSentry({
      dsn: "https://example@sentry.io/1",
      enabled: true,
      tracesSampleRate: 0.05,
    });

    await shutdownAgentSentry();

    expect(mockSentry.flush).toHaveBeenCalledWith(2_000);
  });
});
