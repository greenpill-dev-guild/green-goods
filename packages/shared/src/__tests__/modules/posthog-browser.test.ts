import type { CaptureResult } from "posthog-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { dropExtensionExceptions, initializePostHog } from "../../modules/app/posthog-browser";
import { restoreExceptionTopLevelProps } from "../../modules/app/posthog";

const posthogMock = vi.hoisted(() => ({
  capture: vi.fn(),
  config: { api_host: "" },
  get_distinct_id: vi.fn(() => "test-distinct-id"),
  identify: vi.fn(),
  init: vi.fn(),
  register: vi.fn(),
  reset: vi.fn(),
}));

vi.mock("posthog-js", () => ({ posthog: posthogMock }));

const makeEvent = (properties: Record<string, unknown>, event = "$exception"): CaptureResult =>
  ({ event, properties }) as unknown as CaptureResult;

describe("dropExtensionExceptions", () => {
  it("drops the verified frameless extension tab error", () => {
    const out = dropExtensionExceptions(
      makeEvent({
        $exception_list: [
          {
            type: "Error",
            value: "No tab with id: 1980836477.",
            mechanism: { handled: false, synthetic: true },
          },
        ],
      })
    );

    expect(out).toBeNull();
  });

  it("keeps unrelated frameless application exceptions", () => {
    const event = makeEvent({
      $exception_list: [
        {
          type: "UnhandledRejection",
          value: "Non-Error promise rejection captured with value: failed",
          mechanism: { handled: false, synthetic: true },
        },
      ],
    });

    expect(dropExtensionExceptions(event)).toBe(event);
  });

  it("keeps a matching message without the extension autocapture mechanism", () => {
    const event = makeEvent({
      $exception_list: [
        {
          type: "Error",
          value: "No tab with id: 1980836477.",
          mechanism: { handled: true, synthetic: false },
        },
      ],
    });

    expect(dropExtensionExceptions(event)).toBe(event);
  });

  it("drops an exception whose frame filename contains extension://", () => {
    const out = dropExtensionExceptions(
      makeEvent({
        $exception_list: [
          {
            type: "TypeError",
            value: "undefined is not an object",
            stacktrace: {
              frames: [{ filename: "chrome-extension://abc/content.js" }],
            },
          },
        ],
      })
    );

    expect(out).toBeNull();
  });

  it("keeps an exception raised by Green Goods code", () => {
    const event = makeEvent({
      $exception_list: [
        {
          type: "TypeError",
          value: "Cannot read properties of null",
          stacktrace: {
            frames: [{ filename: "https://www.greengoods.app/assets/index.js" }],
          },
        },
      ],
    });

    expect(dropExtensionExceptions(event)).toBe(event);
  });

  it("passes non-exception events through untouched", () => {
    const event = makeEvent({ $current_url: "/gardens" }, "$pageview");
    expect(dropExtensionExceptions(event)).toBe(event);
  });

  it("leaves the event untouched when there is no $exception_list", () => {
    const event = makeEvent({});
    expect(dropExtensionExceptions(event)).toBe(event);
  });

  it("handles a null event safely", () => {
    expect(dropExtensionExceptions(null)).toBeNull();
  });
});

describe("initializePostHog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("chains compatibility restoration before extension filtering", () => {
    initializePostHog("test-project-key");

    expect(posthogMock.init).toHaveBeenCalledWith(
      "test-project-key",
      expect.objectContaining({
        before_send: [restoreExceptionTopLevelProps, dropExtensionExceptions],
      })
    );
  });
});
