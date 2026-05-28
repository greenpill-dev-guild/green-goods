import type { CaptureResult } from "posthog-js";
import { describe, expect, it } from "vitest";
import { restoreExceptionTopLevelProps } from "../../modules/app/posthog";

/**
 * Regression coverage for the "M1 finding" (2026-05-13): posthog-js >= 1.3xx emits
 * exception data in `$exception_list` and no longer sets the legacy top-level
 * `$exception_type` / `$exception_message` fields that the cloud routines query.
 */
const makeEvent = (properties: Record<string, unknown>, event = "$exception"): CaptureResult =>
  ({ event, properties }) as unknown as CaptureResult;

describe("restoreExceptionTopLevelProps", () => {
  it("mirrors $exception_list[0] type/value to the legacy top-level fields", () => {
    const out = restoreExceptionTopLevelProps(
      makeEvent({
        $exception_list: [{ type: "TypeError", value: "Failed to fetch" }],
      })
    );

    expect(out?.properties.$exception_type).toBe("TypeError");
    expect(out?.properties.$exception_message).toBe("Failed to fetch");
  });

  it("does not overwrite top-level fields that are already present", () => {
    const out = restoreExceptionTopLevelProps(
      makeEvent({
        $exception_type: "ExistingType",
        $exception_message: "Existing message",
        $exception_list: [{ type: "TypeError", value: "Failed to fetch" }],
      })
    );

    expect(out?.properties.$exception_type).toBe("ExistingType");
    expect(out?.properties.$exception_message).toBe("Existing message");
  });

  it("passes non-exception events through untouched", () => {
    const event = makeEvent({ $current_url: "/gardens" }, "$pageview");
    expect(restoreExceptionTopLevelProps(event)).toBe(event);
    expect(event.properties.$exception_type).toBeUndefined();
  });

  it("is a no-op when there is no $exception_list or it is empty", () => {
    const noList = makeEvent({});
    expect(restoreExceptionTopLevelProps(noList)?.properties.$exception_type).toBeUndefined();

    const emptyList = makeEvent({ $exception_list: [] });
    expect(restoreExceptionTopLevelProps(emptyList)?.properties.$exception_type).toBeUndefined();
  });

  it("handles a null event (posthog-js may pass null) safely", () => {
    expect(restoreExceptionTopLevelProps(null)).toBeNull();
  });

  it("only fills the field that is missing", () => {
    const out = restoreExceptionTopLevelProps(
      makeEvent({
        $exception_message: "kept",
        $exception_list: [{ type: "RangeError", value: "ignored" }],
      })
    );

    expect(out?.properties.$exception_type).toBe("RangeError");
    expect(out?.properties.$exception_message).toBe("kept");
  });
});
