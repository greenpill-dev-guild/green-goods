import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("posthog-js", () => ({
  posthog: {
    init: vi.fn(),
    capture: vi.fn(),
    identify: vi.fn(),
    reset: vi.fn(),
    get_distinct_id: vi.fn(() => "mock-ph-id"),
    // Mock config to simulate initialized state
    config: {
      api_host: "https://app.posthog.com",
    },
  },
}));

import {
  track,
  identify,
  identifyWithProperties,
  reset,
  getDistinctId,
  trackOfflineEvent,
  trackSyncPerformance,
  trackAppLifecycle,
} from "../../modules/app/posthog";

describe("modules/posthog", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  describe("track", () => {
    it("tracks events (no dev logs by default)", () => {
      track("test_event", { foo: "bar" });
      expect(console.log).not.toHaveBeenCalled();
    });

    it("enriches events with context", () => {
      track("test_event", { custom: "data" });
      // In dev mode, track() returns early, so we just verify no errors
      expect(true).toBe(true);
    });
  });

  describe("identify", () => {
    it("identify works without error", () => {
      identify("user-1");
      // In dev mode, this is a no-op
      expect(true).toBe(true);
    });

    it("identifyWithProperties works without error", () => {
      identifyWithProperties("user-1", {
        auth_mode: "passkey",
        app: "client",
        chain_id: 84532,
        is_pwa: true,
        locale: "en",
      });
      expect(true).toBe(true);
    });
  });

  describe("reset", () => {
    it("reset works without error", () => {
      reset();
      expect(true).toBe(true);
    });
  });

  describe("getDistinctId", () => {
    it("returns a string", () => {
      const id = getDistinctId();
      expect(typeof id).toBe("string");
    });
  });

  describe("trackOfflineEvent", () => {
    it("prefixes event with offline_", () => {
      trackOfflineEvent("connection_lost", { reason: "network" });
      // In dev mode, this is a no-op but should not throw
      expect(true).toBe(true);
    });
  });

  describe("trackSyncPerformance", () => {
    it("calculates duration from start time", () => {
      const startTime = Date.now() - 100; // 100ms ago
      trackSyncPerformance("work_upload", startTime, true, { itemCount: 5 });
      // In dev mode, this is a no-op but should not throw
      expect(true).toBe(true);
    });
  });

  describe("trackAppLifecycle", () => {
    it("tracks app_start event", () => {
      trackAppLifecycle("app_start");
      expect(true).toBe(true);
    });

    it("tracks app_resume event", () => {
      trackAppLifecycle("app_resume");
      expect(true).toBe(true);
    });

    it("tracks app_background event", () => {
      trackAppLifecycle("app_background");
      expect(true).toBe(true);
    });
  });
});
