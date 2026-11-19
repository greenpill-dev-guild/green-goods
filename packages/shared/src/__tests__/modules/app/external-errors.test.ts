import type { CaptureResult } from "posthog-js";
import type { ErrorEvent } from "@sentry/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { tagExternalExceptions } from "../../../modules/app/posthog-browser";
import { tagExternalError } from "../../../modules/app/sentry";

// Messages and script locations as Sentry recorded them in November 2026.
const RELAY_CONNECT_FAILED = "WebSocket connection failed for host: wss://relay.walletconnect.org";
const RELAY_REFUSED_ORIGIN =
  "WebSocket connection closed abnormally with code: 3000 (Unauthorized: origin not allowed)";
const TOOLBAR_SCRIPT = "https://vercel.live/_next-live/feedback/feedback.js";
const OUR_SCRIPT = "https://beta.greengoods.app/assets/chunk-Cak7VX5P.js";

function sentryEvent(value: string, handled: boolean, scripts = [OUR_SCRIPT]): ErrorEvent {
  return {
    type: undefined,
    level: "error",
    exception: {
      values: [
        {
          type: "Error",
          value,
          mechanism: { type: "generic", handled },
          stacktrace: { frames: scripts.map((abs_path) => ({ abs_path, filename: abs_path })) },
        },
      ],
    },
  };
}

function posthogException(value: string, handled: boolean, scripts = [OUR_SCRIPT]) {
  return {
    event: "$exception",
    properties: {
      $exception_level: "error",
      $exception_list: [
        {
          type: "Error",
          value,
          mechanism: { handled },
          stacktrace: { frames: scripts.map((abs_path) => ({ abs_path, filename: abs_path })) },
        },
      ],
    },
  } as unknown as CaptureResult;
}

describe("errors from WalletConnect's relay and the beta toolbar", () => {
  it.each([
    // [case, message, handled, scripts, source, level]
    [
      "an unhandled relay connect failure",
      RELAY_CONNECT_FAILED,
      false,
      [OUR_SCRIPT],
      "walletconnect",
      "warning",
    ],
    [
      "a relay failure our code handled",
      RELAY_CONNECT_FAILED,
      true,
      [OUR_SCRIPT],
      "walletconnect",
      "error",
    ],
    [
      "the relay refusing this origin",
      RELAY_REFUSED_ORIGIN,
      false,
      [OUR_SCRIPT],
      "walletconnect",
      "error",
    ],
    [
      "the toolbar on an older browser",
      "w.hidePopover is not a function",
      false,
      [OUR_SCRIPT, TOOLBAR_SCRIPT],
      "vercel_toolbar",
      "error",
    ],
  ] as const)("tags %s as external in Sentry and PostHog", (_case, message, handled, scripts, source, level) => {
    const sentry = tagExternalError(sentryEvent(message, handled, [...scripts]));
    expect(sentry.tags).toMatchObject({ error_origin: "external", external_source: source });
    expect(sentry.level).toBe(level);

    const posthog = tagExternalExceptions(posthogException(message, handled, [...scripts]));
    expect(posthog?.properties).toMatchObject({
      error_origin: "external",
      external_source: source,
      $exception_level: level,
    });
  });

  it("leaves our own errors as they were", () => {
    const event = sentryEvent("Cannot read properties of undefined", false);
    expect(tagExternalError(event)).toBe(event);
    const exception = posthogException("Cannot read properties of undefined", false);
    expect(tagExternalExceptions(exception)).toBe(exception);
  });
});

describe("error_tracked for external errors", () => {
  // error_tracked goes out only from a production build, decided when the module loads.
  async function lastErrorTracked(
    report: (categories: typeof import("../../../modules/app/error-categories")) => void
  ): Promise<Record<string, unknown> | undefined> {
    vi.resetModules();
    vi.stubEnv("DEV", false);
    const { registerTelemetrySink } = await import("../../../modules/app/telemetry-sink");
    const captured: Record<string, unknown>[] = [];
    const unregister = registerTelemetrySink({
      capture: (event, properties) => {
        if (event === "error_tracked") captured.push(properties);
      },
      isReady: () => true,
    });
    report(await import("../../../modules/app/error-categories"));
    unregister();
    return captured.at(-1);
  }

  afterEach(() => vi.unstubAllEnvs());

  it("drops an unhandled relay reconnect to a warning, tagged external", async () => {
    const properties = await lastErrorTracked(({ trackError }) =>
      trackError(new Error(RELAY_CONNECT_FAILED), { source: "unhandledrejection" })
    );

    expect(properties).toMatchObject({
      severity: "warning",
      error_origin: "external",
      external_source: "walletconnect",
    });
  });

  it("still reports a failed sign-in as an error when the relay caused it", async () => {
    const properties = await lastErrorTracked(({ trackAuthError }) =>
      trackAuthError(new Error(RELAY_CONNECT_FAILED), { source: "useWalletConnect" })
    );

    expect(properties).toMatchObject({
      severity: "error",
      category: "auth",
      error_origin: "external",
      external_source: "walletconnect",
    });
  });
});
