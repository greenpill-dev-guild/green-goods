/**
 * @vitest-environment happy-dom
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const STORAGE_KEY = "gg-crash-reports";
const CRASH_TIME = new Date("2026-10-04T09:00:00.000Z");

/** A fresh page: the module's own memory is gone, the device's storage is not. */
async function startPage() {
  vi.resetModules();
  const telemetry = await import("../../../modules/app/telemetry-sink");
  const reports = await import("../../../modules/app/crash-reports");
  return { ...telemetry, ...reports };
}

function transport() {
  const capture = vi.fn();
  const captureException = vi.fn();
  const sink = { capture, captureException, isReady: () => true };
  /** The app also sends lifecycle events through the transport; only crash reports count here. */
  const sent = () => capture.mock.calls.filter(([event]) => event === "error_tracked");
  return { sink, sent, captureException };
}

function setOnline(online: boolean) {
  Object.defineProperty(window.navigator, "onLine", { configurable: true, value: online });
}

function crash(message = "Cannot read properties of undefined") {
  const error = new TypeError(message);
  error.stack = `TypeError: ${message}\n    at Garden (https://www.greengoods.app/assets/Garden.js:1:1)`;
  return error;
}

const PROPERTIES = { source: "AppErrorBoundary:unknown", category: "system", severity: "fatal" };

describe("crash reports", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(CRASH_TIME);
    window.localStorage.clear();
    setOnline(true);
  });

  afterEach(() => {
    vi.useRealTimers();
    setOnline(true);
  });

  it("keeps a crash from before analytics loaded and sends it with the time it happened", async () => {
    const page = await startPage();
    page.recordCrash(crash(), PROPERTIES);

    const { sink, sent, captureException } = transport();
    expect(window.localStorage.getItem(STORAGE_KEY)).toContain("AppErrorBoundary:unknown");

    vi.setSystemTime(new Date(CRASH_TIME.getTime() + 4_000));
    page.registerTelemetrySink(sink);
    page.flushCrashReports();

    expect(sent()).toHaveLength(1);
    const [, properties, timing] = sent()[0];
    expect(properties).toMatchObject({
      ...PROPERTIES,
      crash_path: window.location.pathname,
      delivery_delay_ms: 4_000,
    });
    expect(timing.timestamp).toEqual(CRASH_TIME);
    expect(timing.uuid).toBe(properties.crash_report_id);

    const [filed, context] = captureException.mock.calls[0];
    expect(filed).toBeInstanceOf(Error);
    expect(filed.name).toBe("TypeError");
    expect(filed.stack).toContain("Garden.js");
    expect(context).toMatchObject({
      crash_occurred_at: CRASH_TIME.toISOString(),
      source: PROPERTIES.source,
    });
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("sends a crash kept by an earlier visit on the next start, once", async () => {
    const crashed = await startPage();
    crashed.recordCrash(crash(), PROPERTIES);

    vi.setSystemTime(new Date(CRASH_TIME.getTime() + 60 * 60 * 1000));
    const next = await startPage();
    const { sink, sent, captureException } = transport();
    next.registerTelemetrySink(sink);
    next.flushCrashReports();
    next.flushCrashReports();

    expect(sent()).toHaveLength(1);
    expect(sent()[0][2].timestamp).toEqual(CRASH_TIME);
    expect(captureException).toHaveBeenCalledTimes(1);
  });

  it("waits for a connection, then sends", async () => {
    const page = await startPage();
    const { sink, sent } = transport();
    page.registerTelemetrySink(sink);
    setOnline(false);

    page.recordCrash(crash(), PROPERTIES);
    expect(sent()).toHaveLength(0);
    expect(window.localStorage.getItem(STORAGE_KEY)).not.toBeNull();

    setOnline(true);
    page.flushCrashReports();
    expect(sent()).toHaveLength(1);
  });

  it("still sends, once, when the device refuses to store the report", async () => {
    const page = await startPage();
    const write = vi.spyOn(window.localStorage, "setItem").mockImplementation(() => {
      throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
    });
    try {
      page.recordCrash(crash(), PROPERTIES);
      const { sink, sent } = transport();
      page.registerTelemetrySink(sink);
      page.flushCrashReports();
      page.flushCrashReports();

      expect(sent()).toHaveLength(1);
    } finally {
      write.mockRestore();
    }
  });

  it("keeps a report the transport refused", async () => {
    const page = await startPage();
    const refusing = {
      capture: vi.fn(() => {
        throw new Error("transport closed");
      }),
      isReady: () => true,
    };
    page.registerTelemetrySink(refusing);
    page.recordCrash(crash(), PROPERTIES);

    expect(window.localStorage.getItem(STORAGE_KEY)).toContain("AppErrorBoundary:unknown");

    const { sink, sent } = transport();
    page.registerTelemetrySink(sink);
    page.flushCrashReports();
    expect(sent()).toHaveLength(1);
  });

  it("holds ten reports at most and drops the oldest", async () => {
    const page = await startPage();
    for (let index = 1; index <= 12; index += 1) {
      page.recordCrash(crash(`crash ${index}`), PROPERTIES);
    }

    const { sink, sent } = transport();
    page.registerTelemetrySink(sink);
    page.flushCrashReports();

    expect(sent()).toHaveLength(10);
    expect(sink.captureException.mock.calls.map(([error]) => error.message)).toEqual(
      Array.from({ length: 10 }, (_, index) => `crash ${index + 3}`)
    );
  });

  it("drops what is not a report and a report too old to matter", async () => {
    const stale = {
      id: "1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed",
      occurredAt: CRASH_TIME.getTime() - 31 * 24 * 60 * 60 * 1000,
      properties: PROPERTIES,
      error: { name: "Error", message: "old" },
    };
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([stale, { id: 7 }, "not a report", null])
    );

    const page = await startPage();
    const { sink, sent, captureException } = transport();
    page.registerTelemetrySink(sink);
    page.flushCrashReports();

    expect(sent()).toHaveLength(0);
    expect(captureException).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();

    window.localStorage.setItem(STORAGE_KEY, "{not json");
    expect(() => page.flushCrashReports()).not.toThrow();
  });

  it("keeps what an error boundary reports, outside development", async () => {
    // Development builds send no analytics, so the wiring is exercised as production runs it.
    vi.stubEnv("DEV", false);
    try {
      vi.resetModules();
      const { trackErrorBoundary } = await import("../../../modules/app/error-events");
      trackErrorBoundary(crash(), {
        boundaryName: "RouteErrorBoundary:unknown",
        componentStack: "\n    at Garden\n    at AppShell",
      });

      const [kept] = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
      expect(kept.properties).toMatchObject({
        source: "RouteErrorBoundary:unknown",
        severity: "fatal",
        component_stack: "\n    at Garden\n    at AppShell",
      });
      expect(kept.error.name).toBe("TypeError");
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("names a report with a UUID where the origin offers no randomUUID", async () => {
    // A plain-http origin has `getRandomValues` and nothing more.
    vi.stubGlobal("crypto", {
      getRandomValues: (bytes: Uint8Array) => bytes.map((_, index) => index * 17),
    });
    try {
      const page = await startPage();
      page.recordCrash(crash(), PROPERTIES);

      const [kept] = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
      expect(kept.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("never rests a reporting link on the device", async () => {
    const locator = "Zm9vYmFyYmF6cXV4MTIzNDU2Nzg5MGFi";
    // The shared test setup stands a plain object in for `window.location`.
    const home = window.location.pathname;
    window.location.pathname = `/agent/reporting/${locator}`;
    try {
      const page = await startPage();
      page.recordCrash(crash(`Failed at /agent/reporting/recover/${locator}`), {
        ...PROPERTIES,
        error_message: `Failed at /agent/reporting/recover/${locator}`,
      });

      const kept = window.localStorage.getItem(STORAGE_KEY) ?? "";
      expect(kept).not.toContain(locator);
      expect(kept).toContain("/agent/reporting/:requestId");
      expect(kept).toContain('"crash_path":"/agent/reporting/:requestId"');
    } finally {
      window.location.pathname = home;
    }
  });
});
