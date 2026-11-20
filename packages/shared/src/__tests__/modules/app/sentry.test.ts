import { afterEach, describe, expect, it, vi } from "vitest";

const sentry = vi.hoisted(() => ({
  init: vi.fn(),
  setTag: vi.fn(),
  browserTracingIntegration: vi.fn(),
  replayIntegration: vi.fn(),
  captureException: vi.fn(),
  withScope: vi.fn(),
}));
vi.mock("@sentry/react", () => sentry);

const { initBrowserSentry } = await import("../../../modules/app/sentry");
const { captureExternalError } = await import("../../../modules/app/external-error-reporters");

describe("browser Sentry reporter", () => {
  let cleanup = () => {};
  afterEach(() => cleanup());

  it("hands back the id of the report it filed, never an earlier one (PRD-1561)", () => {
    const scope = {
      setLevel: vi.fn(),
      setTag: vi.fn(),
      setFingerprint: vi.fn(),
      setContext: vi.fn(),
    };
    sentry.withScope.mockImplementation((run: (s: typeof scope) => void) => run(scope));
    sentry.captureException.mockReturnValueOnce("report-1").mockReturnValueOnce("report-2");
    cleanup = initBrowserSentry({ dsn: "https://key@sentry.example/1", surface: "client" });

    expect(captureExternalError(new Error("first"), { severity: "error" })).toBe("report-1");
    expect(captureExternalError(new Error("second"), { severity: "error" })).toBe("report-2");
    expect(sentry.captureException).toHaveBeenCalledTimes(2);
  });
});
