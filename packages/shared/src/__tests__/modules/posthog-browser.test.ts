import type { CaptureResult } from "posthog-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  dropDevelopmentHostExceptions,
  dropExtensionExceptions,
  dropSkippedTransitionExceptions,
  initializePostHog,
  protectReportingCeremonies,
} from "../../modules/app/posthog-browser";
import { recordCrash } from "../../modules/app/crash-reports";
import { restoreExceptionTopLevelProps } from "../../modules/app/posthog";

const posthogMock = vi.hoisted(() => ({
  capture: vi.fn(),
  captureException: vi.fn(),
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

describe("dropDevelopmentHostExceptions", () => {
  it("drops an exception raised on localhost", () => {
    const event = makeEvent({
      $current_url: "https://localhost:3001/?mockAuth=1&presentation=1",
      $exception_list: [{ type: "TypeError", value: "Failed to fetch" }],
    });

    expect(dropDevelopmentHostExceptions(event)).toBeNull();
  });

  it("drops an exception raised on a loopback address", () => {
    const event = makeEvent({
      $current_url: "http://127.0.0.1:3001/gardens",
      $exception_list: [{ type: "TypeError", value: "Failed to fetch" }],
    });

    expect(dropDevelopmentHostExceptions(event)).toBeNull();
  });

  it("drops an exception raised on a Cloudflare dev tunnel host", () => {
    const event = makeEvent({
      $current_url: "https://calm-forest-1234.trycloudflare.com/gardens",
      $exception_list: [{ type: "TypeError", value: "Failed to fetch" }],
    });

    expect(dropDevelopmentHostExceptions(event)).toBeNull();
  });

  it("keeps an exception raised on the production host", () => {
    const event = makeEvent({
      $current_url: "https://www.greengoods.app/gardens",
      $exception_list: [{ type: "TypeError", value: "Failed to fetch" }],
    });

    expect(dropDevelopmentHostExceptions(event)).toBe(event);
  });

  it("passes non-exception events through untouched", () => {
    const event = makeEvent({ $current_url: "https://localhost:3001/" }, "$pageview");
    expect(dropDevelopmentHostExceptions(event)).toBe(event);
  });

  it("handles a null event safely", () => {
    expect(dropDevelopmentHostExceptions(null)).toBeNull();
  });
});

describe("dropSkippedTransitionExceptions", () => {
  // posthog-js records a DOMException as type "DOMException" and value "<name>: <message>".
  const makeDomExceptionEvent = (value: string) =>
    makeEvent({
      $exception_list: [
        { type: "DOMException", value, mechanism: { handled: false, synthetic: false } },
      ],
    });

  it.each([
    // Chromium, current and older wording
    "AbortError: Transition was skipped. New ViewTransition started",
    "AbortError: Transition was skipped",
    // WebKit, including Chrome on iOS
    "AbortError: Old view transition aborted by new view transition.",
    "AbortError: Skipping view transition because skipTransition() was called.",
    // Gecko
    "AbortError: Skipped ViewTransition due to another transition starting",
  ])("drops the skipped view transition %s", (value) => {
    expect(dropSkippedTransitionExceptions(makeDomExceptionEvent(value))).toBeNull();
  });

  it.each([
    // Other skip reasons stay visible; a duplicate view-transition-name, for one, is a real bug
    "InvalidStateError: Transition was aborted because of invalid state",
    "InvalidStateError: Skipping view transition because viewport size changed.",
    // An aborted request is not a view transition
    "AbortError: The user aborted a request.",
  ])("keeps %s", (value) => {
    const event = makeDomExceptionEvent(value);
    expect(dropSkippedTransitionExceptions(event)).toBe(event);
  });

  it("keeps a non-DOMException error that quotes the skip message", () => {
    const event = makeEvent({
      $exception_list: [{ type: "Error", value: "Transition was skipped" }],
    });

    expect(dropSkippedTransitionExceptions(event)).toBe(event);
  });

  it("passes non-exception events through untouched", () => {
    const event = makeEvent({ $current_url: "/home" }, "$pageview");
    expect(dropSkippedTransitionExceptions(event)).toBe(event);
  });

  it("leaves the event untouched when there is no $exception_list", () => {
    const event = makeEvent({});
    expect(dropSkippedTransitionExceptions(event)).toBe(event);
  });

  it("handles a null event safely", () => {
    expect(dropSkippedTransitionExceptions(null)).toBeNull();
  });
});

describe("initializePostHog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("protects ceremony pages, then drops development-host exceptions before other filtering", () => {
    initializePostHog("test-project-key");

    expect(posthogMock.init).toHaveBeenCalledWith(
      "test-project-key",
      expect.objectContaining({
        before_send: [
          protectReportingCeremonies,
          dropDevelopmentHostExceptions,
          restoreExceptionTopLevelProps,
          dropExtensionExceptions,
          dropSkippedTransitionExceptions,
        ],
      })
    );
  });

  it("sends a crash kept before the transport connected, at the time it happened", () => {
    // Offline holds the report back, as a crash before analytics loads would.
    vi.stubGlobal("navigator", { onLine: false });
    const error = new Error("Garden screen failed");
    recordCrash(error, { source: "RouteErrorBoundary:unknown" });
    expect(posthogMock.capture).not.toHaveBeenCalled();

    vi.stubGlobal("navigator", { onLine: true });
    initializePostHog("project-key-after-crash");
    vi.unstubAllGlobals();

    expect(posthogMock.capture).toHaveBeenCalledWith(
      "error_tracked",
      expect.objectContaining({ source: "RouteErrorBoundary:unknown" }),
      // Sent at once: the page that shows a crash screen is usually reloaded next.
      { timestamp: expect.any(Date), uuid: expect.any(String), send_instantly: true }
    );
    expect(posthogMock.captureException).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Garden screen failed" }),
      expect.objectContaining({ source: "RouteErrorBoundary:unknown" })
    );
  });
});

describe("protectReportingCeremonies", () => {
  const LOCATOR = "Zm9vYmFyYmF6cXV4MTIzNDU2Nzg5MGFi";

  it("keeps the route but drops chat link locators from every property", () => {
    const out = protectReportingCeremonies({
      event: "page_view",
      properties: {
        $current_url: `https://www.greengoods.app/agent/reporting/${LOCATOR}`,
        path: `/agent/reporting/recover/${LOCATOR}`,
        nested: { $referrer: `https://www.greengoods.app/agent/reporting/${LOCATOR}?x=1` },
      },
      $set_once: { $initial_pathname: `/agent/reporting/${LOCATOR}` },
    } as unknown as CaptureResult);

    expect(JSON.stringify(out)).not.toContain(LOCATOR);
    expect(out?.properties.$current_url).toBe(
      "https://www.greengoods.app/agent/reporting/:requestId"
    );
    expect(out?.properties.path).toBe("/agent/reporting/recover/:requestId");
  });

  it("sends no recordings or element captures from a ceremony page", () => {
    vi.stubGlobal("window", { location: { pathname: `/agent/reporting/${LOCATOR}` } });
    try {
      expect(protectReportingCeremonies(makeEvent({}, "$snapshot"))).toBeNull();
      expect(protectReportingCeremonies(makeEvent({}, "$autocapture"))).toBeNull();
      expect(protectReportingCeremonies(makeEvent({}, "page_view"))).not.toBeNull();
      vi.stubGlobal("window", { location: { pathname: "/agent/reporting/permissions" } });
      expect(protectReportingCeremonies(makeEvent({}, "$snapshot"))).not.toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
