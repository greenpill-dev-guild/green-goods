import { PostHog } from "posthog-node";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getMessageAnalyticsProperties,
  hashAgentDistinctId,
  initAgentAnalytics,
  resetAgentAnalyticsForTests,
  shutdownAgentAnalytics,
  trackAgentEvent,
} from "../services/analytics";
import type { InboundMessage } from "../types";
import { mockPostHog } from "./setup";

describe("agent analytics", () => {
  beforeEach(() => {
    resetAgentAnalyticsForTests();
    vi.mocked(PostHog).mockClear();
    mockPostHog.capture.mockReset();
    mockPostHog.shutdown.mockReset();
  });

  afterEach(() => {
    resetAgentAnalyticsForTests();
  });

  it("stays disabled without POSTHOG_AGENT_KEY", async () => {
    initAgentAnalytics({ apiKey: undefined, enabled: true });

    await trackAgentEvent("agent_runtime_started", "agent-runtime", {
      mode: "webhook",
    });

    expect(PostHog).not.toHaveBeenCalled();
    expect(mockPostHog.capture).not.toHaveBeenCalled();
  });

  it("constructs PostHog with the agent key and US ingest host", () => {
    initAgentAnalytics({ apiKey: "phc_agent_test", enabled: true });

    expect(PostHog).toHaveBeenCalledWith("phc_agent_test", {
      host: "https://us.i.posthog.com",
    });
  });

  it("hashes platform ids into stable non-raw distinct ids", () => {
    const hashed = hashAgentDistinctId("telegram", "123456789");

    expect(hashed).toBe(hashAgentDistinctId("telegram", "123456789"));
    expect(hashed).not.toContain("123456789");
    expect(hashed).toMatch(/^agent_user_[a-f0-9]{64}$/);
  });

  it("keeps message analytics properties privacy-safe", () => {
    const message: InboundMessage = {
      id: "telegram-message-raw-id",
      platform: "telegram",
      chat: { id: "-1002847752257", type: "supergroup", threadId: "311" },
      sender: { platformId: "123456789", displayName: "Afo" },
      content: { type: "text", text: "private message body" },
      locale: "en",
      timestamp: Date.now(),
    };

    const properties = getMessageAnalyticsProperties(message);
    const serialized = JSON.stringify(properties);

    expect(properties).toMatchObject({
      platform: "telegram",
      chat_type: "supergroup",
      content_type: "text",
      has_thread: true,
      locale: "en",
    });
    expect(serialized).not.toContain("123456789");
    expect(serialized).not.toContain("Afo");
    expect(serialized).not.toContain("private message body");
    expect(serialized).not.toContain("-1002847752257");
    expect(serialized).not.toContain("telegram-message-raw-id");
  });

  it("swallows capture failures", async () => {
    initAgentAnalytics({ apiKey: "phc_agent_test", enabled: true });
    mockPostHog.capture.mockRejectedValueOnce(new Error("network failed"));

    await expect(
      trackAgentEvent("agent_runtime_started", "agent-runtime", { mode: "webhook" })
    ).resolves.toBeUndefined();
  });

  it("flushes PostHog on shutdown", async () => {
    initAgentAnalytics({ apiKey: "phc_agent_test", enabled: true });

    await shutdownAgentAnalytics();

    expect(mockPostHog.shutdown).toHaveBeenCalledTimes(1);
  });
});
