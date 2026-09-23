/** @vitest-environment jsdom */
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useWorkMediaLifecycle } from "../../../hooks/client-ui/work/useWorkMediaLifecycle";
import { getWorkMediaId } from "../../../modules/work/media-processing";

function renderLifecycle() {
  const trackEvent = vi.fn();
  const view = renderHook(() =>
    useWorkMediaLifecycle({
      actionUID: 1,
      authMode: "passkey",
      ensureJourneyId: () => "journey-1",
      setImages: vi.fn(),
      trackEvent,
    })
  );
  return { ...view, trackEvent };
}

describe("work media previews", () => {
  it("never marks a HEIC photo waiting to convert as a broken preview", () => {
    const view = renderLifecycle();
    const waiting = new File(["heic"], "garden.heic", { type: "image/heic" });

    act(() => view.result.current.markMediaPreviewFailed(waiting, "media"));

    expect(view.result.current.brokenMediaIds.size).toBe(0);
    expect(view.trackEvent).not.toHaveBeenCalled();
  });

  it("still marks a photo whose preview really failed", () => {
    const view = renderLifecycle();
    const jpeg = new File(["jpeg"], "garden.jpg", { type: "image/jpeg" });

    act(() => view.result.current.markMediaPreviewFailed(jpeg, "review"));

    expect(view.result.current.brokenMediaIds.has(getWorkMediaId(jpeg))).toBe(true);
    expect(view.trackEvent).toHaveBeenCalledWith(
      "work_media_preview_failed",
      expect.objectContaining({ source: "review" })
    );
  });
});
