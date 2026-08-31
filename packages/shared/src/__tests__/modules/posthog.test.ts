import { beforeEach, describe, expect, it, vi } from "vitest";

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
  registerTelemetrySink,
  reset,
  track,
  trackAppLifecycle,
  trackOfflineEvent,
  trackSyncPerformance,
} from "../../modules/app/posthog";
import { trackWorkApprovalPresentationFailed } from "../../modules/app/analytics-events";
import { trackAuthWalletRestore } from "../../modules/app/authWalletRestoreAnalytics";

describe("modules/posthog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  describe("track", () => {
    it("routes enriched events through an injectable telemetry sink", () => {
      const sink = { capture: vi.fn() };
      const unregister = registerTelemetrySink(sink);

      track("work_submitted", { garden: "garden-1" }, { includeSessionId: false });

      expect(sink.capture).toHaveBeenCalledWith(
        "work_submitted",
        expect.objectContaining({
          garden: "garden-1",
          is_online: expect.any(Boolean),
          connection_type: expect.any(String),
          timestamp: expect.any(Number),
        })
      );
      expect(sink.capture.mock.calls[0]?.[1]).not.toHaveProperty("session_id");
      unregister();
    });

    it("replaces persisted user and session identity for anonymous diagnostics", () => {
      const sink = { capture: vi.fn() };
      const unregister = registerTelemetrySink(sink);

      trackAuthWalletRestore({ authMode: "wallet", outcome: "delayed" });
      trackAuthWalletRestore({ authMode: "wallet", outcome: "success" });

      const firstProperties = sink.capture.mock.calls[0]?.[1];
      const secondProperties = sink.capture.mock.calls[1]?.[1];
      expect(firstProperties?.distinct_id).toMatch(/^anonymous_auth_wallet_restore_/);
      expect(secondProperties?.distinct_id).toMatch(/^anonymous_auth_wallet_restore_/);
      expect(firstProperties?.distinct_id).not.toBe(secondProperties?.distinct_id);
      expect(firstProperties).toMatchObject({
        $anon_distinct_id: undefined,
        $device_id: undefined,
        $session_id: undefined,
        $user_id: undefined,
        $window_id: undefined,
      });
      expect(firstProperties).not.toHaveProperty("session_id");
      unregister();
    });

    it("anonymizes post-success work detail failures while preserving diagnostic fields", () => {
      const sink = { capture: vi.fn() };
      const unregister = registerTelemetrySink(sink);

      trackWorkApprovalPresentationFailed({
        approved: false,
        failureReason: "detail-resolution",
        resolutionStatus: "temporarily-absent",
      });

      expect(sink.capture).toHaveBeenCalledWith(
        "work_approval_presentation_failed",
        expect.objectContaining({
          approved: false,
          distinct_id: expect.stringMatching(/^anonymous_work_approval_presentation_failed_/),
          failure_reason: "detail-resolution",
          resolution_status: "temporarily-absent",
        })
      );
      const properties = sink.capture.mock.calls[0]?.[1];
      expect(properties).toMatchObject({
        $anon_distinct_id: undefined,
        $device_id: undefined,
        $session_id: undefined,
        $user_id: undefined,
        $window_id: undefined,
      });
      expect(properties).not.toHaveProperty("session_id");
      unregister();
    });

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
