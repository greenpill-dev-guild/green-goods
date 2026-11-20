import { PostHog } from "posthog-node";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getMessageAnalyticsProperties,
  hashAgentDistinctId,
  initAgentAnalytics,
  resetAgentAnalyticsForTests,
  shutdownAgentAnalytics,
  trackAgentEvent,
  trackGardenJoinRequestEvent,
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

  it("uses one aggregate identity for privacy-safe join-request lifecycle events", async () => {
    initAgentAnalytics({ apiKey: "phc_agent_test", enabled: true });

    await trackGardenJoinRequestEvent("join_request_created", {
      kind: "garden_membership",
      requested_via: "garden_detail",
      is_counterfactual: true,
      retry: false,
    });

    expect(mockPostHog.capture).toHaveBeenCalledWith({
      distinctId: "green-goods-agent-runtime",
      event: "join_request_created",
      properties: {
        kind: "garden_membership",
        requested_via: "garden_detail",
        is_counterfactual: true,
        retry: false,
        environment: "unknown",
        app_surface: "agent",
        release: "unknown",
        is_test_account: "unknown",
        is_test_garden: "unknown",
      },
    });
  });

  it("places each event against the test records and keeps the addresses out", async () => {
    const testAccount = "0x00000000000000000000000000000000000000aa";
    const realAccount = "0x00000000000000000000000000000000000000bb";
    const testGarden = "0x00000000000000000000000000000000000000cc";
    const realGarden = "0x00000000000000000000000000000000000000dd";
    initAgentAnalytics({
      apiKey: "phc_agent_test",
      enabled: true,
      environment: "production",
      release: "fly-v42",
      testAccounts: ` ${testAccount.toUpperCase().replace("0X", "0x")} `,
      testGardens: testGarden,
    });

    // Raw traffic: a tester in a real garden, a gardener in a test garden, a real join, and a
    // runtime event that names nobody.
    const fixtures = [
      { account: testAccount, garden: realGarden },
      { account: realAccount, garden: testGarden },
      { account: realAccount, garden: realGarden },
      undefined,
    ];
    for (const subject of fixtures) {
      await trackGardenJoinRequestEvent(
        "join_request_created",
        { kind: "garden_membership" },
        subject
      );
    }

    const sent = mockPostHog.capture.mock.calls.map(
      ([input]) => (input as { properties: Record<string, unknown> }).properties
    );
    expect(sent).toHaveLength(4);
    expect(sent[0]).toMatchObject({
      environment: "production",
      app_surface: "agent",
      release: "fly-v42",
    });
    expect(sent.map((p) => [p.is_test_account, p.is_test_garden])).toEqual([
      [true, false],
      [false, true],
      [false, false],
      ["unknown", "unknown"],
    ]);
    // A dashboard of real people drops anything marked a test and keeps unknown visible.
    const real = sent.filter((p) => p.is_test_account !== true && p.is_test_garden !== true);
    expect(real).toHaveLength(2);
    const serialized = JSON.stringify(sent);
    for (const address of [testAccount, realAccount, testGarden, realGarden]) {
      expect(serialized).not.toContain(address.slice(2));
    }
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
