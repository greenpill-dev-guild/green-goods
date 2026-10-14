import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("debug error privacy", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("VITE_DEBUG_MODE", "true");
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("drops quoted names and API-bearing URLs from errors and their stacks", async () => {
    const { debugError } = await import("../../utils/debug");
    debugError(
      "Authentication failed",
      new Error(
        'Request failed.\nURL: https://hosted.example/rpc?apikey=synthetic-key\nRequest body: {"userName":"private-name-marker"}\nDetails: That name is already registered.'
      )
    );
    const output = JSON.stringify(vi.mocked(console.error).mock.calls);

    expect(output).not.toContain("synthetic-key");
    expect(output).not.toContain("private-name-marker");
    expect(output).toContain("That name is already registered.");
  });

  it("redacts structured non-Error failures", async () => {
    const { debugError } = await import("../../utils/debug");
    debugError("Authentication failed", {
      userName: "private-name-marker",
      apiKey: "synthetic-key",
      status: 503,
    });
    expect(console.error).toHaveBeenCalledWith("[debug] Authentication failed", {
      error: { userName: "[REDACTED]", apiKey: "[REDACTED]", status: 503 },
    });
  });

  it("redacts error context while preserving useful diagnostics", async () => {
    const { debugError } = await import("../../utils/debug");
    debugError("Authentication failed", "Unavailable", {
      userName: "private-name-marker",
      operation: "create",
    });
    expect(console.error).toHaveBeenCalledWith("[debug] Authentication failed", {
      userName: "[REDACTED]",
      operation: "create",
      error: "Unavailable",
    });
  });

  it("stays silent when debug mode is disabled", async () => {
    vi.stubEnv("VITE_DEBUG_MODE", "false");
    const { debugError } = await import("../../utils/debug");
    debugError("Authentication failed", new Error("Unavailable"));
    expect(console.error).not.toHaveBeenCalled();
  });
});
