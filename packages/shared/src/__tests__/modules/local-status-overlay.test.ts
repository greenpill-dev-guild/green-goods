import { describe, expect, it } from "vitest";
import {
  carryOverlayMarkers,
  clearLapsedOverlay,
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

    it("holds a decision confirmed on chain until the indexer reports it", () => {
      // The receipt proved the attestation exists, so no clock retires it.
      const confirmed = overlay({ status: "approved", _isPending: false, _txHash: "0xabc" });
      expect(isLocalOverlayLive(confirmed, NOW)).toBe(true);
      expect(isLocalOverlayLive(confirmed, NOW + 10 * LOCAL_OVERLAY_GRACE_MS)).toBe(true);
    });

    it("still expires a broadcast decision that is waiting on its receipt", () => {
      const broadcast = overlay({
        status: "approved",
        _isPending: true,
        _txHash: "0xabc",
        _pendingUntilMs: NOW + 1_000,
      });
      expect(isLocalOverlayLive(broadcast, NOW)).toBe(true);
      expect(isLocalOverlayLive(broadcast, NOW + 1_001)).toBe(false);
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

    it("keeps the last displayed status when the approvals read failed", () => {
      // "Approvals unavailable" is not "no approval exists": a reviewed work
      // must not fall back to pending because one request failed.
      expect(resolveWorkStatus(null, overlay({ status: "rejected" }), NOW)).toBe("rejected");
      expect(resolveWorkStatus(null, overlay({ status: "approved", _txHash: "0xabc" }), NOW)).toBe(
        "approved"
      );
    });

    it("falls back to pending on a failed approvals read with nothing cached", () => {
      expect(resolveWorkStatus(null, undefined, NOW)).toBe("pending");
    });
  });

  describe("carryOverlayMarkers", () => {
    const confirmed = overlay({ status: "rejected", _isPending: false, _txHash: "0xabc" });

    it("carries a live overlay onto the indexed row while the indexer still reports pending", () => {
      expect(carryOverlayMarkers(confirmed, "pending", NOW)).toEqual({
        _isPending: false,
        _txHash: "0xabc",
      });
    });

    it("carries a live overlay when the approvals read failed", () => {
      expect(carryOverlayMarkers(confirmed, null, NOW)).toEqual({
        _isPending: false,
        _txHash: "0xabc",
      });
    });

    it("drops the markers once the indexer reports the decision", () => {
      expect(carryOverlayMarkers(confirmed, "rejected", NOW)).toEqual({});
    });

    it("drops the markers once a stamped overlay lapses", () => {
      const lapsed = overlay({ status: "approved", _isPending: true, _pendingUntilMs: NOW - 1 });
      expect(carryOverlayMarkers(lapsed, "pending", NOW)).toEqual({});
    });

    it("carries nothing for a row without an overlay", () => {
      expect(carryOverlayMarkers(undefined, "pending", NOW)).toEqual({});
      expect(carryOverlayMarkers(overlay({ status: "approved" }), "pending", NOW)).toEqual({});
    });
  });

  describe("clearLapsedOverlay", () => {
    it("clears the in-flight flag once a stamped deadline passes", () => {
      const lapsed = overlay({ status: "approved", _isPending: true, _pendingUntilMs: NOW - 1 });
      expect(clearLapsedOverlay(lapsed, NOW)).toEqual({
        ...lapsed,
        _isPending: false,
        _pendingUntilMs: undefined,
      });
    });

    it("leaves a live stamped overlay alone", () => {
      const live = overlay({ status: "approved", _isPending: true, _pendingUntilMs: NOW + 1 });
      expect(clearLapsedOverlay(live, NOW)).toBe(live);
    });

    it("leaves offline jobs and confirmed decisions alone", () => {
      // Neither carries a deadline; only the indexer retires them.
      const offline = overlay({ status: "approved", _isPending: true });
      const confirmed = overlay({ status: "approved", _isPending: false, _txHash: "0xabc" });
      expect(clearLapsedOverlay(offline, NOW)).toBe(offline);
      expect(clearLapsedOverlay(confirmed, NOW)).toBe(confirmed);
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
