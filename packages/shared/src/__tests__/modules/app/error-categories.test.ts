import { describe, expect, it, vi } from "vitest";

const sentry = vi.hoisted(() => ({
  init: vi.fn(),
  setTag: vi.fn(),
  browserTracingIntegration: vi.fn(),
  replayIntegration: vi.fn(),
  captureException: vi.fn(),
  withScope: vi.fn(),
}));
vi.mock("@sentry/react", () => sentry);
import {
  registerExternalErrorReporter,
  type ExternalErrorReporterContext,
} from "../../../modules/app/external-error-reporters";
import { trackAuthError, trackContractError } from "../../../modules/app/error-categories";

describe("auth error tracking", () => {
  it("redacts sensitive auth error details before forwarding generic error telemetry", () => {
    const walletAddress = "0x1111111111111111111111111111111111111111";
    const credentialId = "dGVzdC1jcmVkZW50aWFsLWlk";
    const secretApiKey = "secret-pimlico-key";
    const userName = "private-name-marker";
    const calls: Array<{ error: Error; context: ExternalErrorReporterContext }> = [];
    const unregister = registerExternalErrorReporter((error, context) => {
      calls.push({ error, context });
    });

    try {
      const cause = new Error(
        `GET https://api.pimlico.io/v2/42161/rpc?apikey=${secretApiKey} failed credentialId=${credentialId}\nRequest body: ${JSON.stringify({ userName })}`
      );
      const error = new Error(
        `Passkey recovery failed for walletAddress=${walletAddress} at https://api.pimlico.io/v2/42161/rpc?apikey=${secretApiKey}\nRequest body: ${JSON.stringify({ userName })}`
      );
      (error as Error & { cause?: unknown }).cause = cause;

      trackAuthError(error, {
        source: "Login.handleAuthError",
        userAction: "recover with passkey",
        authMode: "passkey",
        metadata: {
          userName,
          credentialId,
          walletAddress,
          recoveryUrl: `https://api.pimlico.io/v2/42161/rpc?apikey=${secretApiKey}`,
        },
      });
    } finally {
      unregister();
    }

    expect(calls).toHaveLength(1);
    const serialized = JSON.stringify({
      message: calls[0]?.error.message,
      stack: calls[0]?.error.stack,
      metadata: calls[0]?.context.metadata,
    });

    expect(serialized).not.toContain(walletAddress);
    expect(serialized).not.toContain(credentialId);
    expect(serialized).not.toContain(secretApiKey);
    expect(serialized).not.toContain(userName);
    expect(serialized).not.toContain("Request body:");
    expect(serialized).not.toContain("apikey=");
    expect(serialized).toContain("[REDACTED]");
  });
});

describe("contract error tracking", () => {
  it("redacts the signer address from a viem wallet error while keeping the garden address", () => {
    // viem prints the signer in the request arguments of wallet errors. Redaction
    // used to be gated to the auth category, so contract telemetry leaked it.
    const signerAddress = "0x2222222222222222222222222222222222222222";
    const gardenAddress = "0x3333333333333333333333333333333333333333";
    const calls: Array<{ error: Error; context: ExternalErrorReporterContext }> = [];
    const unregister = registerExternalErrorReporter((error, context) => {
      calls.push({ error, context });
    });

    try {
      trackContractError(
        new Error(
          `An unknown RPC error occurred.\n\nRequest Arguments:\n  from: ${signerAddress}\n  to: ${gardenAddress}`
        ),
        {
          source: "useJoinGarden",
          gardenAddress,
          authMode: "wallet",
          userAction: "joining garden",
        }
      );
    } finally {
      unregister();
    }

    expect(calls).toHaveLength(1);
    const serialized = JSON.stringify({
      message: calls[0]?.error.message,
      stack: calls[0]?.error.stack,
      metadata: calls[0]?.context.metadata,
    });

    expect(serialized).not.toContain(signerAddress);
    expect(serialized).toContain("[REDACTED_WALLET]");
    // The structured garden address is a public contract address and is tracked
    // deliberately — redaction must not swallow it.
    expect(calls[0]?.context.gardenAddress).toBe(gardenAddress);
  });
});

describe("a PostHog failure and the Sentry report behind it", () => {
  // error_tracked goes out only from a production build, decided when the module loads.
  it("carries the id of the report Sentry filed for that handled error, never an earlier one (PRD-1561)", async () => {
    vi.resetModules();
    vi.stubEnv("DEV", false);
    const scope = {
      setLevel: vi.fn(),
      setTag: vi.fn(),
      setFingerprint: vi.fn(),
      setContext: vi.fn(),
    };
    sentry.withScope.mockImplementation((run: (s: typeof scope) => void) => run(scope));
    sentry.captureException.mockReturnValueOnce("report-1").mockReturnValueOnce("report-2");
    try {
      const { registerTelemetrySink } = await import("../../../modules/app/telemetry-sink");
      const tracked: Record<string, unknown>[] = [];
      const unregisterSink = registerTelemetrySink({
        capture: (event, properties) => {
          if (event === "error_tracked") tracked.push(properties);
        },
        isReady: () => true,
      });
      const { initBrowserSentry } = await import("../../../modules/app/sentry");
      const stopSentry = initBrowserSentry({
        dsn: "https://key@sentry.example/1",
        surface: "client",
      });
      const { trackError } = await import("../../../modules/app/error-categories");

      trackError(new Error("Indexer timed out"), { source: "useGardens", category: "graphql" });
      trackError(new Error("Gateway refused"), { source: "useGardens", category: "graphql" });
      stopSentry();
      trackError(new Error("Indexer timed out again"), {
        source: "useGardens",
        category: "graphql",
      });
      unregisterSink();

      expect(tracked.map((properties) => properties.sentry_event_id)).toEqual([
        "report-1",
        "report-2",
        undefined,
      ]);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
