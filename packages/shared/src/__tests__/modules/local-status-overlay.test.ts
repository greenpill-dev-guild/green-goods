import { describe, expect, it } from "vitest";
import {
  isLocalOverlayLive,
  LOCAL_OVERLAY_GRACE_MS,
  type OverlayWork,
  overlayDeadline,
  resolveWorkStatus,
} from "../../modules/work/local-status-overlay";

const NOW = 1_700_000_000_000;

function overlay(partial: Partial<OverlayWork>): OverlayWork {
  return { id: "work-1", status: "pending", ...partial } as OverlayWork;
}

describe("local-status-overlay", () => {
  describe("isLocalOverlayLive", () => {
    it("treats a missing cache entry as not live", () => {
      expect(isLocalOverlayLive(undefined, NOW)).toBe(false);
    });

    it("keeps offline jobs live indefinitely", () => {
      const offline = overlay({ _isPending: true, _pendingUntilMs: undefined });
      expect(isLocalOverlayLive(offline, NOW)).toBe(true);
      expect(isLocalOverlayLive(offline, NOW + 10 * LOCAL_OVERLAY_GRACE_MS)).toBe(true);
    });

    it("keeps a stamped overlay live until its deadline passes", () => {
      const live = overlay({ _isPending: false, _pendingUntilMs: NOW + 1_000 });
      expect(isLocalOverlayLive(live, NOW)).toBe(true);
      expect(isLocalOverlayLive(live, NOW + 1_001)).toBe(false);
    });

    it("treats an entry with no overlay markers as not live", () => {
      expect(isLocalOverlayLive(overlay({ status: "approved" }), NOW)).toBe(false);
    });
  });

  describe("resolveWorkStatus", () => {
    it("lets the indexer win as soon as it reports a decision", () => {
      // Even a live overlay must yield — a terminal indexed status is the
      // signal the overlay was waiting for.
      const live = overlay({ status: "rejected", _isPending: true, _pendingUntilMs: NOW + 30_000 });
      expect(resolveWorkStatus("approved", live, NOW)).toBe("approved");
    });

    it("shows a live overlay while the indexer still reports pending", () => {
      const live = overlay({
        status: "approved",
        _isPending: false,
        _pendingUntilMs: NOW + 30_000,
      });
      expect(resolveWorkStatus("pending", live, NOW)).toBe("approved");
    });

    it("falls back to pending once the overlay lapses", () => {
      // This is the dropped-transaction case: nothing ever confirmed it, so the
      // work must not stay resolved forever.
      const stale = overlay({ status: "approved", _pendingUntilMs: NOW - 1 });
      expect(resolveWorkStatus("pending", stale, NOW)).toBe("pending");
    });

    it("does not let a plain cached entry outrank the indexer", () => {
      // Regression: cached status used to win unconditionally, so an indexed
      // approval could never replace a cached pending value.
      const plain = overlay({ status: "pending" });
      expect(resolveWorkStatus("approved", plain, NOW)).toBe("approved");
    });

    it("keeps an offline job pending against a lagging indexer", () => {
      const offline = overlay({ status: "syncing", _isPending: true });
      expect(resolveWorkStatus("pending", offline, NOW)).toBe("syncing");
    });

    it("resolves to the computed status when there is no cache entry", () => {
      expect(resolveWorkStatus("pending", undefined, NOW)).toBe("pending");
    });
  });

  describe("overlayDeadline", () => {
    it("stamps one grace window ahead", () => {
      expect(overlayDeadline(NOW)).toBe(NOW + LOCAL_OVERLAY_GRACE_MS);
    });

    it("outlasts the final indexer-lag follow-up", () => {
      expect(LOCAL_OVERLAY_GRACE_MS).toBeGreaterThan(15_000);
    });
  });
});
