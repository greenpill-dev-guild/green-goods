import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockCapture, mockIdentify, mockReset } = vi.hoisted(() => ({
  mockCapture: vi.fn(),
  mockIdentify: vi.fn(),
  mockReset: vi.fn(),
}));

const { mockCapture, mockIdentify, mockReset } = vi.hoisted(() => ({
  mockCapture: vi.fn(),
  mockIdentify: vi.fn(),
  mockReset: vi.fn(),
}));

vi.mock("posthog-js", () => ({
  posthog: {
    init: vi.fn(),
    capture: mockCapture,
    identify: mockIdentify,
    reset: mockReset,
    get_distinct_id: vi.fn(() => "mock-ph-id"),
    // Mock config to simulate initialized state
    config: {
      api_host: "https://app.posthog.com",
    },
  },
}));

import {
  getDistinctId,
  identify,
  identifyWithProperties,
  reset,
  track,
  trackAppLifecycle,
  trackOfflineEvent,
  trackSyncPerformance,
} from "../../modules/app/posthog";

describe("modules/posthog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  describe("track", () => {
    it("does not log to console outside debug mode", () => {
      track("test_event", { foo: "bar" });
      expect(console.log).not.toHaveBeenCalled();
    });

    it("skips posthog.capture in dev mode", () => {
      track("test_event", { custom: "data" });
      expect(mockCapture).not.toHaveBeenCalled();
    });

    it("does not throw when called with no properties", () => {
      expect(() => track("bare_event")).not.toThrow();
    });
  });

  describe("identify", () => {
    it("skips posthog.identify in dev mode", () => {
      identify("user-1");
      expect(mockIdentify).not.toHaveBeenCalled();
    });

    it("skips posthog.identify with properties in dev mode", () => {
      identifyWithProperties("user-1", {
        auth_mode: "passkey",
        app: "client",
        chain_id: 11155111,
        is_pwa: true,
        locale: "en",
      });
      expect(mockIdentify).not.toHaveBeenCalled();
    });
  });

  describe("reset", () => {
    it("skips posthog.reset in dev mode", () => {
      reset();
      expect(mockReset).not.toHaveBeenCalled();
    });
  });

  describe("getDistinctId", () => {
    it("returns dev-user-id in dev mode", () => {
      const id = getDistinctId();
      expect(id).toBe("dev-user-id");
    });
  });

  describe("trackOfflineEvent", () => {
    it("delegates to track with offline_ prefix without calling posthog", () => {
      trackOfflineEvent("connection_lost", { reason: "network" });
      expect(mockCapture).not.toHaveBeenCalled();
    });
  });

  describe("trackSyncPerformance", () => {
    it("delegates to track with sync_ prefix without calling posthog", () => {
      const startTime = Date.now() - 100;
      trackSyncPerformance("work_upload", startTime, true, { itemCount: 5 });
      expect(mockCapture).not.toHaveBeenCalled();
    });
  });

  describe("trackAppLifecycle", () => {
    it("delegates app_start to track without calling posthog", () => {
      trackAppLifecycle("app_start");
      expect(mockCapture).not.toHaveBeenCalled();
    });

    it("delegates app_resume to track without calling posthog", () => {
      trackAppLifecycle("app_resume");
      expect(mockCapture).not.toHaveBeenCalled();
    });

    it("delegates app_background to track without calling posthog", () => {
      trackAppLifecycle("app_background");
      expect(mockCapture).not.toHaveBeenCalled();
    });
  });
});
